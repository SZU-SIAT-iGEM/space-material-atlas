"""Search existing nodes, export teams and compile compact route JSON offline."""
import argparse,json,sys,subprocess,copy
from pathlib import Path

def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def bi(x):return {'zh':x,'en':x} if isinstance(x,str) else {'zh':x.get('zh',''),'en':x.get('en') or x.get('zh','')}
def output(path,obj):
 text=json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
 if path:Path(path).parent.mkdir(parents=True,exist_ok=True);Path(path).write_text(text,encoding='utf8')
 else:print(text)

def validate(root,b,p,q):
 # Use both the browser import validator and publication-field rules.
 code="const fs=require('fs'),C=require(process.argv[1]);const x=JSON.parse(fs.readFileSync(0,'utf8'));const e=C.validateBundle(x.b,x.p,x.q);if(e.length){console.error(e.join('\\n'));process.exit(1)}"
 result=subprocess.run(['node','-e',code,str(root/'web/core.js')],input=json.dumps({'b':b,'p':p,'q':q}),text=True,capture_output=True,encoding='utf8')
 if result.returncode:raise ValueError(result.stderr)
 sys.path.insert(0,str(root/'scripts'));import atlas,build_release
 build_release.check_data(b,atlas.upsert_team(b,p,q))

def compile_plan(plan,newnodes,b,p):
 t=plan['team'];tid=t['id'];theme=t['theme'];sid=t.get('source_ids')
 sources=copy.deepcopy(plan['sources']);sid=sid or [s['id'] for s in sources]
 def own(s):return s if s.startswith(tid+':') else tid+':'+s
 routes=[{'id':own(c['id']),'theme':c.get('theme',theme),'label':bi(c['label']),'demonstration':c.get('demonstration',False),'step_ids':[],'edge_ids':[],'dependencies':[]} for c in plan['routes']]
 rmap={c['id']:c for c in routes};nodes=[];aliases={}
 existing={n['id'] for n in b['nodes']+p['nodes'] if n.get('owner')!=tid}
 for n in newnodes:
  if n['id'] in existing:raise ValueError('复用已有节点请直接用作端点，不要放进新增节点 JSON：'+n['id'])
  k=own(n['id']);aliases[n['id']]=k;route=own(n['route']) if n.get('route') else None
  if route and route not in rmap:raise ValueError('Unknown route '+route)
  desc=bi(n.get('description',''));label=bi(n['label'])
  nodes.append({'id':k,'owner':tid,'route':route,'theme':rmap[route]['theme'] if route else theme,'kind':n.get('kind','process'),'label':label,'layer':'project','future':True,'source_ids':n.get('source_ids',sid),'description':desc['zh'],'description_en':desc['en'],'narrative':desc})
  if route:rmap[route]['step_ids'].append(k)
 q={'format':'space-atlas-team-bundle-1','team':{'id':tid,'year':int(tid[:4]),'name':t['name'],'url':t.get('url',''),'role':bi(t['summary']),'description':bi(t['description'])['zh'],'description_en':bi(t['description'])['en'],'narrative':bi(t['description']),'primary_theme':theme,'themes':sorted({theme,*[c['theme'] for c in routes]}),'scenario':'assumed_success','source_ids':sid,'chains':routes},'nodes':nodes,'edges':[],'dependencies':[],'enhancements':[],'sources':sources}
 for i,c in enumerate(plan['connections']):
  cat=c.get('type','material');route=own(c['route']) if c.get('route') else None
  if route and route not in rmap:raise ValueError('Unknown route '+route)
  e={'id':own(c.get('id','edge:'+str(i))),'owner':tid,'source':aliases.get(c['source'],c['source']),'target':aliases.get(c['target'],c['target']),'category':cat,'label':bi(c['label']),'source_ids':c.get('source_ids',sid),'route':route}
  if cat=='enhancement':
   scope=bi(c['scope']);e.update(kind=c.get('kind','process_improvement'),scope=scope['zh'],scope_en=scope['en'],measured_gain=None,scenario='assumed_success');q['enhancements'].append(e)
  elif cat=='dependency':
   e['basis']=c.get('basis','team_supplied');q['dependencies'].append(e)
   if route:rmap[route]['dependencies'].append(e['target'])
  else:
   e.update(layer='project',theme=rmap[route]['theme'] if route else theme,demonstration=rmap[route]['demonstration'] if route else False,scenario='assumed_success');q['edges'].append(e)
   if route:rmap[route]['edge_ids'].append(e['id'])
 return q

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--atlas',type=Path,default=Path(__file__).resolve().parents[3]);sub=parser.add_subparsers(dest='command',required=True)
 s=sub.add_parser('catalog');s.add_argument('--query',default='');s.add_argument('--out')
 s=sub.add_parser('export-team');s.add_argument('--id',required=True);s.add_argument('--out',required=True)
 s=sub.add_parser('compile');s.add_argument('--plan',required=True);s.add_argument('--nodes',required=True);s.add_argument('--out',required=True)
 s=sub.add_parser('validate');s.add_argument('--bundle',required=True)
 args=parser.parse_args();root=args.atlas.resolve()
 if (root/'content/manifest.json').exists():
  sys.path.insert(0,str(root))
  from cms.content import compile_modules,load_modules
  docs=compile_modules(load_modules(root/'content'));b=docs['baseline.json'];p=docs['projects.json']
 else:b=read(root/'data/baseline.json');p=read(root/'data/projects.json')
 if args.command=='catalog':
  nodes=[{k:n.get(k) for k in ['id','label','kind','theme','owner','description']} for n in b['nodes']+p['nodes'] if args.query.casefold() in json.dumps(n,ensure_ascii=False).casefold()]
  output(args.out,{'nodes':nodes,'themes':b['themes'],'teams':[{'id':t['id'],'name':t['name']} for t in p['teams']]});return
 if args.command=='export-team':
  t=next(t for t in p['teams'] if t['id']==args.id);q={'format':'space-atlas-team-bundle-1','team':copy.deepcopy(t)}
  for k in ['nodes','edges','dependencies','enhancements']:q[k]=[x for x in p[k] if x.get('owner')==args.id]
  used={sid for x in [t,*q['nodes'],*q['edges'],*q['dependencies'],*q['enhancements']] for sid in x.get('source_ids',[])}
  q['sources']=[s for s in p['sources'] if s['id'] in used]
 elif args.command=='compile':q=compile_plan(read(args.plan),read(args.nodes),b,p)
 else:q=read(args.bundle)
 validate(root,b,p,q)
 if args.command!='validate':output(args.out,q)
 print('Valid team bundle: '+q['team']['id'],file=sys.stderr)

if __name__=='__main__':
 try:main()
 except (ValueError,KeyError,StopIteration) as e:print('ERROR:',str(e),file=sys.stderr);sys.exit(1)
