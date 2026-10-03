"""Flow-directed overview with local category envelopes and separated lanes."""
import json, math, subprocess, re, copy
from pathlib import Path
from collections import defaultdict
from organic import hull, octagon, crosses_rect

def overlap(a,b,c,d):
    dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
    if length<1e-6:return 0
    if abs(dx*(c[1]-a[1])-dy*(c[0]-a[0]))/length>.2 or abs(dx*(d[1]-a[1])-dy*(d[0]-a[0]))/length>.2:return 0
    u=((c[0]-a[0])*dx+(c[1]-a[1])*dy)/length;v=((d[0]-a[0])*dx+(d[1]-a[1])*dy)/length
    return max(0,min(length,max(u,v))-max(0,min(u,v)))

def simplify(points):
    result=[]
    for p in points:
        if result and math.dist(p,result[-1])<.05:continue
        if len(result)>1:
            a,b=result[-2:]
            cross=(b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0])
            if abs(cross)<.02:result[-1]=p;continue
        result.append(p)
    return result

def inside_polygon(p,poly):
    signs=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):signs.append((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))
    return all(x>=0 for x in signs) or all(x<=0 for x in signs)

def regions(model,boxes,paths):
    # Only merge nearby same-category nodes when no foreign node is enclosed.
    # One category can occupy several labelled local envelopes in a global flow.
    clusters={};bytheme=defaultdict(list)
    for k,n in model['nodes'].items():bytheme[n['display_theme']].append(k)
    def polygon(ids):return hull([p for k in ids for p in octagon(boxes[k],24)])
    for theme,ids in bytheme.items():
        parts=[{k} for k in sorted(ids)]
        def can_join(a,b):
            dist=min(math.hypot((boxes[x]['x']-boxes[y]['x'])/1.7,boxes[x]['y']-boxes[y]['y']) for x in a for y in b)
            if dist>430:return False
            poly=polygon(a|b)
            for k,r in boxes.items():
                if k in a|b:continue
                if any(inside_polygon(p,poly) for p in octagon(r,5)):return False
                if any(crosses_rect(u,v,r,-4) for u,v in zip(poly,poly[1:]+poly[:1])):return False
            return True
        changed=True
        while changed:
            changed=False
            for i in range(len(parts)):
                for j in range(i+1,len(parts)):
                    if can_join(parts[i],parts[j]):parts[i]|=parts[j];parts.pop(j);changed=True;break
                if changed:break
        for i,part in enumerate(parts):
            poly=polygon(part);xs=[p[0] for p in poly];ys=[p[1] for p in poly]
            # Header placed only in a clear pocket; individual node theme strips
            # cover fragments where there is no room for an extra region title.
            title=None
            if len(part)>=2:
                top=min((boxes[k] for k in part),key=lambda r:r['y'])
                trial={'x':top['x'],'y':top['y']-61,'w':260,'h':27}
                if not any(max(trial['x'],r['x'])<min(trial['x']+trial['w'],r['x']+r['w']) and max(trial['y'],r['y'])<min(trial['y']+trial['h'],r['y']+r['h']) for r in boxes.values()) and not any(crosses_rect(a,b,trial) for pts in paths.values() for a,b in zip(pts,pts[1:])):
                    title=trial;poly=hull(poly+octagon(trial,9))
            clusters[f'{theme}~{i}']={'theme':theme,'members':sorted(part),'x':min(p[0] for p in poly),'y':min(p[1] for p in poly),'w':max(p[0] for p in poly)-min(p[0] for p in poly),'h':max(p[1] for p in poly)-min(p[1] for p in poly),'polygon':poly,'title':title}
    return clusters

def directed_layout(model,lang,digest,node_size):
    q=lambda s:json.dumps(str(s),ensure_ascii=False)
    lines=['digraph G {','graph [rankdir=LR, splines=ortho, nodesep=.5, ranksep=1.8, pad=.7, mclimit=4, concentrate=false];','node [shape=box,fixedsize=true,label=""];']
    for k,n in model['nodes'].items():
        w,h=node_size(n,lang);lines.append(f'{q(k)} [width={w/72:.6f},height={h/72:.6f}];')
    groups=defaultdict(list)
    for e in model['edges']:groups[e['source'],e['target'],e['category']].append(e)
    mapping={}
    for i,(key,es) in enumerate(groups.items()):
        a,b,cat=key;gid='g'+str(i);mapping[gid]=es
        constraint='true'
        weight=1 if es[0].get('owner') else 3
        lines.append(f'{q(a)} -> {q(b)} [id={q(gid)},constraint={constraint},weight={weight}];')
    lines.append('}')
    p=subprocess.run(['node',str(Path(__file__).with_name('graphviz.cjs'))],input=json.dumps({'dot':'\n'.join(lines),'engine':'dot'}),encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90)
    if p.returncode:raise RuntimeError(p.stderr)
    raw=json.loads(p.stdout);x0,y0,W,H=map(float,raw['bb'].split(','));boxes={};paths={}
    for o in raw['objects']:
        if 'pos' not in o:continue
        x,y=map(float,o['pos'].split(','));w,h=node_size(model['nodes'][o['name']],lang)
        boxes[o['name']]={'x':x-w/2+80,'y':H-y-h/2+80,'w':w,'h':h}
    for o in raw.get('edges',[]):
        pts=[]
        for op in o.get('_draw_',[]):
            if op['op']=='b':pts.extend([[x+80,H-y+80] for x,y in op['points']])
        end=re.search(r'e,([\d.-]+),([\d.-]+)',o.get('pos',''))
        if end:pts.append([float(end[1])+80,H-float(end[2])+80])
        pts=simplify(pts)
        for e in mapping[o['id']]:paths[e['id']]=copy.deepcopy(pts)
    # Move detached ground evidence to the side without reranking the main flow.
    ground={k for k,n in model['nodes'].items() if n['layer']=='ground'}
    main=set(boxes)-ground if model['view']!='ground' else set(boxes)
    if not main:main=set(boxes)
    ymin=min(boxes[k]['y'] for k in main)-80
    MW=max(boxes[k]['x']+boxes[k]['w'] for k in main)+80
    MH=max(boxes[k]['y']+boxes[k]['h'] for k in main)-ymin+80
    if ground and ground!=set(boxes):
        dx=MW+150-min(boxes[k]['x'] for k in ground);dy=80-min(boxes[k]['y'] for k in ground)
    else:dx=dy=0
    for k,r in boxes.items():r['x']+=dx if k in ground and ground!=set(boxes) else 0;r['y']+=dy if k in ground and ground!=set(boxes) else -ymin
    for es in groups.values():
        for e in es:
            isg=e['source'] in ground and ground!=set(boxes)
            for pt in paths[e['id']]:pt[0]+=dx if isg else 0;pt[1]+=dy if isg else -ymin
    # Offset overlapping lanes without changing the chosen flow topology.
    previous=[];obstacles=list(boxes.values())
    for es in groups.values():
        e=es[0];base=paths[e['id']];best=base;bestcost=float('inf')
        for offset in [0,6,-6,12,-12,18,-18,24,-24]:
            pts=[[x+offset,y+offset] for x,y in base]
            for index,nid in [(0,e['source']),(-1,e['target'])]:
                r=boxes[nid];orig=base[index]
                if abs(orig[0]-r['x'])<3 or abs(orig[0]-r['x']-r['w'])<3:
                    pts[index][0]=orig[0];pts[index][1]=max(r['y']+8,min(r['y']+r['h']-8,pts[index][1]))
                else:
                    pts[index][1]=orig[1];pts[index][0]=max(r['x']+8,min(r['x']+r['w']-8,pts[index][0]))
            if any(crosses_rect(a,b,r,1) for a,b in zip(pts,pts[1:]) for r in obstacles):continue
            cost=sum(overlap(a,b,c,d) for a,b in zip(pts,pts[1:]) for c,d in previous)+abs(offset)*.1
            if cost<bestcost:bestcost=cost;best=pts
            if cost==0:break
        previous.extend(zip(best,best[1:]))
        for e in es:paths[e['id']]=copy.deepcopy(best)
    clusters=regions(model,boxes,paths)
    W=max(r['x']+r['w'] for r in boxes.values())+80;H=max(r['y']+r['h'] for r in boxes.values())+80
    return {'fingerprint':digest,'algorithm':'directed-layered-separated-lanes-v1','language':lang,'view':model['view'],'width':W,'height':H,'main_width':MW,'main_height':MH,'nodes':boxes,'clusters':clusters,'paths':paths}
