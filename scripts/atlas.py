"""Material-flow atlas: projection, validation, stable SVG and editing.

The SVG engine is also used by the standalone offline HTML graph viewer.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import heapq
import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

HERE=Path(__file__).resolve().parents[1]
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
THEME_VIEWS={'water':['water'],'air':['air'],'agriculture':['plants','aquatic'],
 'materials':['logistics'],'bioreactor':[],'human':['overview'],'logistics':['logistics'],
 'energy':['energy'],'ground':['ground'],'heritage':['other']}
CATEGORIES={'material','energy','support','information','dependency','enhancement'}

def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,d):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(d,ensure_ascii=False,indent=2)+'\n'
    temp=p.with_suffix(p.suffix+'.tmp');temp.write_text(text,encoding='utf-8');temp.replace(p)
def load(root=HERE):return read(root/'data/baseline.json'),read(root/'data/projects.json')
def theme_views(b):
    return {t['id']: THEME_VIEWS.get(t['id'], [t['id']]) for t in b['themes']}

def all_relations(b,p):return b['edges']+p['edges']+p['dependencies']+p['enhancements']
def tx(value,lang):return value.get(lang,value.get('zh','')) if isinstance(value,dict) else str(value)
def label_ok(x):return isinstance(x,dict) and all(isinstance(x.get(k),str) and x[k].strip() for k in ['zh','en'])

def validate(b,p):
    errors=[]
    if not isinstance(b,dict) or not isinstance(p,dict):return ['Data documents must be objects']
    if b.get('schema_version')!='space-atlas-baseline-4': errors.append('baseline.schema_version: migrate old files first')
    if p.get('schema_version')!='space-atlas-projects-4':errors.append('projects.schema_version: migrate old files first')
    if errors:return errors
    for obj,keys,name in [(b,['themes','nodes','edges','sources','overview_edge_ids'],'baseline'),(p,['nodes','edges','sources','teams','dependencies','enhancements'],'projects')]:
        for key in keys:
            if not isinstance(obj.get(key),list):errors.append(f'{name}.{key}: expected list')
    if errors:return errors
    themes={t['id'] for t in b['themes']}; teams={t['id'] for t in p['teams']}
    if len(teams)!=len(p['teams']):errors.append('teams: duplicate ID')
    if p.get('coverage',{}).get('teams')!=len(p['teams']):errors.append('coverage.teams: inconsistent count')
    sources={s['id'] for s in b['sources']+p['sources']}
    nodes={}; ids=set(); routes={}
    for n in b['nodes']+p['nodes']:
        k=n.get('id')
        if not k or k in nodes:errors.append(f'node {k}: duplicate / empty ID')
        nodes[k]=n
        if n.get('kind') not in {'actor','material','process','energy','boundary','category','state','information','resource'}:errors.append(f'node {k}: invalid kind')
        if not label_ok(n.get('label')):errors.append(f'node {k}: missing bilingual label')
        if n.get('theme') not in themes:errors.append(f'node {k}: unknown theme')
        if n.get('owner') and n['owner'] not in teams:errors.append(f'node {k}: missing team')
        if n.get('layer')=='project' and not n.get('future'):errors.append(f'node {k}: project scenario must be marked Future')
    for t in p['teams']:
        if t.get('primary_theme') not in themes:errors.append(f'team {t["id"]}: unknown primary theme')
        if not label_ok(t.get('role')):errors.append(f'team {t["id"]}: missing bilingual role')
        if not t.get('source_ids'):errors.append(f'team {t["id"]}: missing source')
        for source in t.get('source_ids',[]):
            if source not in sources:errors.append(f'team {t["id"]}: unknown source {source}')
        for c in t['chains']:
            if c['id'] in routes:errors.append(f'route {c["id"]}: duplicate')
            routes[c['id']]=c
            if c.get('theme') not in themes:errors.append(f'route {c["id"]}: unknown theme')
            for sid in c['step_ids']:
                if sid not in nodes:errors.append(f'route {c["id"]}: missing step {sid}')
                elif nodes[sid].get('owner')!=t['id']:errors.append(f'route {c["id"]}: step owned by another team')
    for e in all_relations(b,p):
        k=e['id']
        if k in ids:errors.append(f'relation {k}: duplicate ID')
        ids.add(k)
        for end in ['source','target']:
            if e[end] not in nodes:errors.append(f'{k}.{end}: dangling node {e[end]}')
        if e.get('owner') and e['owner'] not in teams:errors.append(f'{k}: missing team')
        if e.get('route') and e['route'] not in routes:errors.append(f'{k}: unknown route')
        if e.get('category') not in CATEGORIES:errors.append(f'{k}: invalid category')
        if not label_ok(e.get('label')):errors.append(f'{k}: missing bilingual label')
        for s in e.get('source_ids',[]):
            if s not in sources:errors.append(f'{k}: unknown source {s}')
        if e['category'] in {'dependency','enhancement'} and nodes.get(e['target'],{}).get('kind')!='process':
            errors.append(f'{k}: effect/dependency target must be a process')
        if e['category']=='enhancement' and e.get('measured_gain') is not None:
            errors.append(f'{k}: numerical gain is unsupported in the current corpus')
    for c in routes.values():
        for eid in c['edge_ids']:
            if eid not in ids:errors.append(f'{c["id"]}: missing edge {eid}')
    return errors

def assert_valid(b,p):
    errors=validate(b,p)
    if errors:raise ValueError('\n'.join(errors))

def projection(b,p,view='overview'):
    """Full-corpus projection; never depends on selected teams or ground switch."""
    src={n['id']:n for n in b['nodes']+p['nodes']}
    teams={t['id']:t for t in p['teams']}
    chains={c['id']:c for t in p['teams'] for c in t['chains']}
    edges=[]
    for e in b['edges']:
        keep=e['id'] in b['overview_edge_ids'] or e['layer']=='ground' if view=='overview' else any(v in theme_views(b).get(view,[]) for v in e['views'])
        if view=='human':keep=keep and 'crew' in [e['source'],e['target']]
        if view=='materials':keep=keep and any(src[n]['theme']=='materials' for n in [e['source'],e['target']])
        if view in theme_views(b) and any(src[n]['theme']==view for n in [e['source'],e['target']]):keep=True
        if keep:edges.append(copy.deepcopy(e))
    eligible=set()
    for t in p['teams']:
        for c in t['chains']:
            if view=='overview':keep=not c['demonstration']
            elif view=='bioreactor':keep='space_bioreactor' in c['dependencies']
            else:keep=c['theme']==view
            if keep:eligible.add(c['id'])
    for e in p['edges']+p['dependencies']:
        boundary=view in theme_views(b) and any(src[n]['theme']==view for n in [e['source'],e['target']])
        if e.get('route') in eligible or boundary or (not e.get('route') and (view=='overview' or e.get('theme')==view)):
            edges.append(copy.deepcopy(e))
    for e in p['enhancements']:
        if view=='overview' or src[e['target']]['theme']==view:
            edges.append(copy.deepcopy(e))
    if view=='effects':
        edges=[copy.deepcopy(e) for e in p['enhancements']]
        # Three complete example routes show dependence vs. improvement together.
        example={'2025-5781','2024-5260','2025-5893'}
        edges += [copy.deepcopy(e) for e in p['edges']+p['dependencies'] if e.get('owner') in example and not e.get('demonstration')]
    compact=view in {'overview','effects'}
    step_map={sid:c['step_ids'][0] for c in chains.values() for sid in c['step_ids']} if compact else {}
    # In an effect-only comparison, collapse contributing projects without adding
    # their unrelated routes. Their contribution remains explicitly annotated.
    nodes={}; projected=[]
    for e in edges:
        mapped={}
        for side in ['source','target']:
            logical=step_map.get(e[side],e[side]);n=copy.deepcopy(src[logical]);n['logical_id']=logical
            if compact and n.get('route'):
                team=teams[n['owner']]
                n['label']=team['role'] if len(team['chains'])==1 else chains[n['route']].get('label',n['label'])
                n['kind']='process';n['summary']=True
            force_local=(n.get('route') in eligible or view=='effects')
            remote=view not in {'overview','effects'} and n['theme']!=view and not force_local
            display_id=f'remote:{view}:{logical}' if remote else logical
            n['id']=display_id;n['remote']=remote
            n['target_view']=n['theme'] if remote or (compact and n.get('owner')) else None
            n['display_theme']='remote' if remote else view if view not in {'overview','effects'} else n['theme']
            nodes[display_id]=n;mapped[side]=display_id
        if mapped['source']==mapped['target']:continue
        e.update(mapped);projected.append(e)
    # Nodes are the projection of actual relations, not every catalog entry.
    used={x for e in projected for x in [e['source'],e['target']]}
    return {'view':view,'nodes':{k:n for k,n in nodes.items() if k in used},'edges':projected}

def visible(model,active,ground=False):
    edges=[e for e in model['edges'] if (not e.get('owner') or e['owner'] in active) and (ground or e.get('layer')!='ground')]
    used={x for e in edges for x in [e['source'],e['target']]}
    nodes={k:n for k,n in model['nodes'].items() if k in used and (not n.get('owner') or n['owner'] in active)}
    edges=[e for e in edges if e['source'] in nodes and e['target'] in nodes]
    badges=defaultdict(list)
    for e in edges:
        if e['category']=='enhancement':badges[e['target']].append(e)
    return {'view':model['view'],'nodes':nodes,'edges':edges,'badges':dict(badges)}

def wrap(s,width=22):
    lines=[];line='';size=0
    for ch in s.replace('\n',' '):
        w=2 if ord(ch)>255 else 1
        if size+w>width and line:lines.append(line.strip());line='';size=0
        line+=ch;size+=w
    if line:lines.append(line.strip())
    return lines or ['']

def node_lines(n,lang):return wrap(tx(n['label'],lang),26 if lang=='zh' else 30)
def node_size(n,lang):
    lines=node_lines(n,lang)
    return 266, max(112, 53+len(lines)*21+(20 if n.get('owner') or n.get('remote') else 0))
def fingerprint(model,lang):
    from managed_layout import fingerprint as shared_fingerprint
    return shared_fingerprint(model,lang)

def layout(model,lang,cache,refresh=False):
    from managed_layout import layout as shared_layout, reference
    digest=fingerprint(model,lang);cache=Path(cache)
    if cache.exists():
        old=read(cache)
        if old['fingerprint']==digest:return old
        if not refresh:raise ValueError('Data changed. Run layout to update geometry explicitly.')
    elif not refresh:raise ValueError('Layout missing. Run layout first.')
    result=reference(model,lang) or shared_layout(model,lang,digest)
    write(cache,result);return result


def el(parent,tag,attrs=None,text=None):
    n=ET.SubElement(parent,'{'+NS+'}'+tag,{k:str(v) for k,v in (attrs or {}).items()})
    if text is not None:n.text=str(text)
    return n

def render(b,p,view='overview',lang='zh',active=None,ground=False,refresh=False,out=None):
    assert_valid(b,p);active=set(active or [])
    unknown=active-{t['id'] for t in p['teams']}
    if unknown:raise ValueError('Unknown team selection: '+','.join(sorted(unknown)))
    full=projection(b,p,view);vis=visible(full,active,ground)
    geom=layout(full,lang,HERE/f'layouts/{view}-{lang}.json',refresh)
    pad=40;top=140;w=max(1000,(geom['width'] if ground else geom.get('main_width',geom['width']))+pad*2)
    h=(geom['height'] if ground else geom.get('main_height',geom['height']))+top+100
    root=ET.Element('{'+NS+'}svg',{'viewBox':f'0 0 {w:.2f} {h:.2f}','width':f'{w:.2f}','height':f'{h:.2f}',
     'role':'img','aria-label':view,'data-view':view,'data-language':lang,'data-layout':geom['fingerprint']})
    style=el(root,'style',text='text{font-family:Manrope,"Segoe UI","Noto Sans SC","Microsoft YaHei",sans-serif} a{cursor:pointer} .node:target rect{stroke:#c78516;stroke-width:5} .node:hover rect{stroke-width:3}')
    el(root,'rect',{'width':w,'height':h,'fill':'#f9fcfa'})
    defs=el(root,'defs')
    palette={'material':'#557b96','energy':'#b87500','support':'#678799','information':'#678799','dependency':'#7c9890','enhancement':'#b87500'}
    for k,c in dict(palette,project='#149b80').items():
        mark=el(defs,'marker',{'id':'arrow-'+k,'viewBox':'0 0 10 10','refX':9,'refY':5,'markerWidth':6,'markerHeight':6,'orient':'auto-start-reverse'})
        el(mark,'path',{'d':'M0 1L9 5L0 9Z','fill':c})
    themes={t['id']:t for t in b['themes']};themes['remote']={'label':{'zh':'远端 · 其他主题','en':'Remote · other themes'},'color':'#f5f7f8'}
    title={'overview':{'zh':'太空物质循环 · 基础与 iGEM','en':'Space material flows · baseline & iGEM'},
           'effects':{'zh':'工艺依赖与改良 · 关系示例','en':'Process dependence & improvement · examples'}}
    title=tx(title.get(view,themes.get(view,{}).get('label',view)),lang)
    el(root,'text',{'x':40,'y':45,'font-size':29,'fill':'#0c2f5f','font-weight':600},title)
    shown_owners={e['owner'] for e in vis['edges'] if e.get('owner')}
    el(root,'text',{'x':40,'y':76,'font-size':15,'fill':'#526d7b'},
      f'选中 {len(active)} / {len(p["teams"])} 队 · 本图涉及 {len(shown_owners)} 队 · 项目按目标成功情景绘制' if lang=='zh' else f'{len(active)} / {len(p["teams"])} selected · {len(shown_owners)} teams in view · Project-success scenario')
    legend='灰蓝：基础物质流   青绿：项目路线   点线：工艺联系   金色／角标：工艺改良   切角：系统边界   Future：项目太空应用' if lang=='zh' else 'Blue-grey: baseline   Teal: project routes   Dotted: process links   Gold: improvements   Cut corner: system boundary   Future: space applications'
    el(root,'text',{'x':40,'y':105,'font-size':13,'fill':'#526d7b'},legend)
    graph=el(root,'g',{'transform':f'translate({pad},{top})'})
    active_groups={n['display_theme'] for n in vis['nodes'].values()}
    for k,r in geom['clusters'].items():
        theme=r.get('theme',k)
        if theme not in active_groups:continue
        if not any(n in vis['nodes'] for n in r.get('members',[])):continue
        g=el(graph,'g',{'class':'cluster','data-theme':theme,'data-members':' '.join(r.get('members',[]))})
        from organic import hull,octagon
        members=[n for n in r['members'] if n in vis['nodes']]
        polygon=r['polygon'] if len(members)==len(r['members']) else hull([pt for n in members for pt in octagon(geom['nodes'][n],24)])
        el(g,'polygon',{'points':' '.join(f'{x:.2f},{y:.2f}' for x,y in polygon),'fill':themes[theme]['color'],'fill-opacity':.65,'stroke':'#b7d4c6','stroke-width':1.3,'stroke-linejoin':'round'})
        if r.get('title') and len(members)==len(r['members']):el(g,'text',{'x':r['title']['x'],'y':r['title']['y']+24,'font-size':22,'font-weight':600,'fill':'#365b71'},tx(themes[theme]['label'],lang))
    owners={t['id']:t for t in p['teams']}
    # Parallel routes with identical geometry share one line; tooltip lists owners.
    drawing=defaultdict(list)
    for e in vis['edges']:drawing[(e['source'],e['target'],e['category'])].append(e)
    for (a,d,cat),es in drawing.items():
        e=es[0];pts=geom['paths'].get(e['id'],[])
        if not pts:continue
        col='project' if e.get('owner') and cat=='material' else cat
        color='#149b80' if col=='project' else palette[cat]
        g=el(graph,'g',{'class':'edge','data-ids':' '.join(x['id'] for x in es),'data-category':cat,'data-source':a,'data-target':d})
        el(g,'title',text='\n'.join(tx(x['label'],lang)+((' · '+owners[x['owner']]['name']) if x.get('owner') else '') for x in es))
        attrs={'points':' '.join(f'{x:.2f},{y:.2f}' for x,y in pts),'fill':'none','stroke':color,
               'stroke-width':2.2 if cat=='enhancement' else 1.8,'marker-end':'url(#arrow-'+col+')'}
        if cat in {'dependency','support','information','energy','enhancement'}:attrs['stroke-dasharray']='3 5' if cat=='dependency' else '7 5'
        el(g,'polyline',dict(attrs,stroke='#f9fcfa',**{'stroke-width':5.8,'marker-end':'none','stroke-dasharray':'none','class':'crossing-clearance'}))
        el(g,'polyline',attrs)
    for k,n in vis['nodes'].items():
        r=geom['nodes'][k];x,y=r['x'],r['y'];nw,nh=r['w'],r['h']
        parent=graph;target=n.get('target_view')
        if target:
            anchor=n['logical_id']
            parent=el(graph,'a',{'href':f'{target}-{lang}-all.svg#'+quote(anchor,safe=''),'data-target-node':anchor,'data-target-view':target})
        g=el(parent,'g',{'id':n['logical_id'],'class':'node','data-node':k,'data-owner':n.get('owner',''),
            'data-future':str(n.get('future',False)).lower(),'data-remote':str(n.get('remote',False)).lower(),'data-boundary-role':n.get('boundary_role','')})
        future=n.get('future',False);process=n['kind']=='process'
        role=n.get('boundary_role');colors={'earth_input':('#e0efe9','#287667'),'earth_return':('#e4edf9','#496a94'),'disposal':('#f5e5dc','#9a593a'),'discharge':('#ede9e5','#7c695b'),'energy_sink':('#f4edde','#947439'),'local_resource':('#efe8dc','#927c51'),'crew':('#e6edf2','#2c4d64')}
        fill,stroke=colors.get(role,('#fbfdfc','#169475' if n.get('owner') else '#7b99aa'))
        if role and role!='crew':
            el(g,'polygon',{'points':f'{x},{y} {x+nw-22},{y} {x+nw},{y+22} {x+nw},{y+nh} {x},{y+nh}','fill':fill,'stroke':stroke,'stroke-width':2})
            el(g,'path',{'d':f'M{x+nw-22},{y} V{y+22} H{x+nw}','stroke':stroke,'fill':'none','stroke-width':1.3})
        else:el(g,'rect',{'x':x,'y':y,'width':nw,'height':nh,'rx':28 if role=='crew' else 3 if process else 15,'fill':fill,
          'stroke':stroke,'stroke-width':2 if role=='crew' else 1.7 if process else 1.3,'stroke-dasharray':'6 4' if n.get('remote') else 'none'})
        if process:el(g,'rect',{'x':x+1,'y':y+1,'width':nw-2,'height':25,'fill':'#d8f1e5' if future else '#e0eef4'})
        tag='↗ '+('远端' if lang=='zh' else 'REMOTE') if n.get('remote') else '示范 · Future' if n.get('demonstration') and lang=='zh' else 'Demo · Future' if n.get('demonstration') else 'Future' if future else '地面验证' if n['layer']=='ground' and lang=='zh' else 'Ground' if n['layer']=='ground' else '工艺' if process and lang=='zh' else 'PROCESS' if process else ''
        if role:tag={'earth_input':('地球输入','EARTH INPUT'),'earth_return':('返回地球','EARTH RETURN'),'disposal':('离开循环 · 处置','DISPOSAL'),'discharge':('离开系统 · 排放','DISCHARGE'),'crew':('乘员','CREW'),'energy_sink':('热量输出','HEAT OUTPUT'),'local_resource':('当地资源','LOCAL RESOURCE')}[role][0 if lang=='zh' else 1]
        if tag:el(g,'text',{'x':x+12,'y':y+18,'font-size':11,'fill':'#437767'},tag)
        for li,line in enumerate(node_lines(n,lang)):
            el(g,'text',{'x':x+nw/2,'y':y+49+li*21,'font-size':17,'text-anchor':'middle','fill':'#0c2f5f','font-weight':500 if process else 400},line)
        subtitle=(owners[n['owner']]['name']+' · '+str(owners[n['owner']]['year'])) if n.get('owner') else tx(themes[n['theme']]['label'],lang) if n.get('remote') else ''
        if subtitle:
            # Small labels use a fixed-width line; names are never silently cut.
            el(g,'text',{'x':x+nw/2,'y':y+nh-13,'font-size':12,'text-anchor':'middle','fill':'#526d7b'},subtitle)
        detail=[tx(n['label'],lang),n.get('description_en',n.get('description','')) if lang=='en' else n.get('description','')]
        if n.get('owner'):
            t=owners[n['owner']];detail += [t.get('description_en',t.get('description','')) if lang=='en' else t.get('description',''),t.get('url','')]
        el(g,'title',text='\n'.join(str(x) for x in detail if x))
        badge_slots=[e['id'] for e in full['edges'] if e['category']=='enhancement' and e['target']==k]
        for effect in vis['badges'].get(k,[]):
            index=badge_slots.index(effect['id'])
            bx=x+nw-15-index*25;by=y+12
            effect_source=vis['nodes'][effect['source']]
            badge=el(g,'a',{'class':'badge','data-effect-owner':effect['owner'],'data-effect-id':effect['id'],'href':f'{effect_source["theme"]}-{lang}-all.svg#'+quote(effect_source['logical_id'],safe='')})
            el(badge,'circle',{'cx':bx,'cy':by,'r':10,'fill':'#f4ce72','stroke':'#aa7927','data-effect':effect['id']})
            symbol='↑' if effect['kind']=='mass_transfer' else '+'
            el(badge,'text',{'x':bx,'y':by+4,'font-size':14,'text-anchor':'middle','fill':'#714b15','font-weight':700},symbol)
            el(badge,'title',text=owners[effect['owner']]['name']+' · '+tx(effect['label'],lang)+'\n'+(effect.get('scope_en',effect['scope']) if lang=='en' else effect['scope']))
    el(root,'text',{'x':40,'y':h-40,'font-size':13,'fill':'#62767b'},
       '定性图谱 · 项目按目标实现后的情景展开 · 来源见节点介绍与引用页' if lang=='zh' else 'Qualitative atlas · Routes follow a project-goal scenario · Sources accompany nodes and references')
    metadata={'view':view,'language':lang,'active_teams':sorted(active),'ground':ground,'layout':geom['fingerprint'],
              'nodes':len(vis['nodes']),'relations':len(vis['edges']),'enhancements':sum(map(len,vis['badges'].values()))}
    el(root,'metadata',text=json.dumps(metadata,ensure_ascii=False))
    if out:
        out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);ET.ElementTree(root).write(out,encoding='utf-8',xml_declaration=True)
    return root,metadata,geom,vis

def delete_team(b,p,tid):
    candidate=copy.deepcopy(p)
    if not any(t['id']==tid for t in candidate['teams']):raise ValueError('Unknown team '+tid)
    candidate['teams']=[t for t in candidate['teams'] if t['id']!=tid]
    for k in ['nodes','edges','dependencies','enhancements']:
        candidate[k]=[x for x in candidate[k] if x.get('owner')!=tid]
    candidate['defaults']['active_teams']=[x for x in candidate['defaults']['active_teams'] if x!=tid]
    candidate['coverage']['teams']=len(candidate['teams'])
    assert_valid(b,candidate);return candidate

def upsert_team(b,p,bundle):
    """Bundle: team + owned nodes/edges/dependencies/enhancements + sources.
    Shared nodes may be supplied explicitly; IDs cannot overwrite other owners.
    The complete candidate is checked before saving.
    """
    tid=bundle['team']['id'];candidate=copy.deepcopy(p)
    old_team=next((t for t in p['teams'] if t['id']==tid),{})
    foreign_sources={s for t in p['teams'] if t['id']!=tid for s in t.get('source_ids',[])}
    owned_sources=set(old_team.get('source_ids',[]))-foreign_sources
    exists=any(t['id']==tid for t in p['teams'])
    if exists:
        candidate['teams']=[t for t in candidate['teams'] if t['id']!=tid]
        for k in ['nodes','edges','dependencies','enhancements']:
            candidate[k]=[x for x in candidate[k] if x.get('owner')!=tid]
    candidate['teams'].append(copy.deepcopy(bundle['team']))
    for k in ['nodes','edges','dependencies','enhancements','sources']:
        byid={x['id']:x for x in candidate[k]}
        for x in bundle.get(k,[]):
            if k!='sources' and x.get('owner') not in {None,tid}:raise ValueError('Bundle contains another team owner')
            if x['id'] in byid and byid[x['id']]!=x and not(k=='sources' and x['id'] in owned_sources):raise ValueError('Conflicting shared ID '+x['id'])
            byid[x['id']]=copy.deepcopy(x)
        candidate[k]=list(byid.values())
    candidate['coverage']['teams']=len(candidate['teams']);candidate['coverage']['years']=sorted({t['year'] for t in candidate['teams']})
    assert_valid(b,candidate);return candidate

def delete_node(b,p,nid):
    if any(n['id']==nid for n in b['nodes']):raise ValueError('Baseline nodes require evidence maintenance, not project editing')
    refs=[e['id'] for e in all_relations(b,p) if nid in [e['source'],e['target']]]
    refs += [c['id'] for t in p['teams'] for c in t['chains'] if nid in c['step_ids']]
    if refs:raise ValueError('Node is referenced by: '+', '.join(refs))
    candidate=copy.deepcopy(p);candidate['nodes']=[n for n in p['nodes'] if n['id']!=nid]
    assert_valid(b,candidate);return candidate

def update_node(b,p,nid,changes):
    if set(changes)&{'id','owner','layer','route'}:raise ValueError('Node identity, ownership and layer are not editable through update-node')
    candidate=copy.deepcopy(p);node=next((n for n in candidate['nodes'] if n['id']==nid),None)
    if node is None:raise ValueError('Unknown project node '+str(nid))
    node.update(copy.deepcopy(changes));assert_valid(b,candidate);return candidate

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['validate','layout','render','delete-team','upsert-team','delete-node','update-node','package'])
    parser.add_argument('--view',default='overview',help='overview, effects, or a topic ID')
    parser.add_argument('--lang',choices=['zh','en'],default='zh');parser.add_argument('--teams',default='none',help='none, all, or comma-separated year-ID')
    parser.add_argument('--ground',action='store_true');parser.add_argument('--out',type=Path);parser.add_argument('--id');parser.add_argument('--bundle',type=Path)
    args=parser.parse_args();b,p=load();assert_valid(b,p)
    if args.command=='validate':print(json.dumps({'valid':True,'teams':len(p['teams']),'effects':len(p['enhancements'])}));return
    if args.command=='package':
        out=args.out or HERE.parent/'space-atlas-v6.zip'
        with tempfile.TemporaryDirectory() as temp:
            dest=Path(temp)/'space-atlas-v6';shutil.copytree(HERE,dest,ignore=shutil.ignore_patterns('__pycache__','*.tmp'))
            shutil.make_archive(str(out.with_suffix('')),'zip',temp)
        print(out);return
    if args.command in {'delete-team','upsert-team','delete-node','update-node'}:
        if not args.out:raise ValueError('Editing requires --out; live data is not overwritten implicitly')
        candidate=upsert_team(b,p,read(args.bundle)) if args.command=='upsert-team' else update_node(b,p,args.id,read(args.bundle)) if args.command=='update-node' else delete_team(b,p,args.id) if args.command=='delete-team' else delete_node(b,p,args.id)
        write(args.out,candidate);print('Validated edit saved:',args.out);return
    model=projection(b,p,args.view)
    if args.command=='layout':
        g=layout(model,args.lang,HERE/f'layouts/{args.view}-{args.lang}.json',True)
        print(json.dumps({'view':args.view,'language':args.lang,'nodes':len(g['nodes']),'width':g['width'],'height':g['height']}));return
    active={t['id'] for t in p['teams']} if args.teams=='all' else set() if args.teams=='none' else set(args.teams.split(','))
    out=args.out or HERE/f'graphs/{args.view}-{args.lang}-{args.teams}.svg'
    _,metadata,_,_=render(b,p,args.view,args.lang,active,args.ground,out=out)
    print(json.dumps(metadata))

if __name__=='__main__':
    if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
    try:main()
    except (ValueError,KeyError,RuntimeError) as e:print('ERROR:',e,file=sys.stderr);sys.exit(1)
