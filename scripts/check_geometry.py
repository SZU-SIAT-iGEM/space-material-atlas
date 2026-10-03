"""Verify routed lines against visible node interiors and graph navigation."""
import json
import sys
from pathlib import Path
from itertools import combinations
from urllib.parse import unquote
import xml.etree.ElementTree as ET
sys.path.insert(0,str(Path(__file__).parent))
import atlas
from organic import crosses_rect, crossing
import math

def crosses(a,b,r,margin=1):
 return crosses_rect(a,b,r,margin)

def shared_length(a,b,c,d,tolerance=.15):
 dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
 if length<1e-6:return 0
 if abs(dx*(c[1]-a[1])-dy*(c[0]-a[0]))/length>tolerance or abs(dx*(d[1]-a[1])-dy*(d[0]-a[0]))/length>tolerance:return 0
 u=((c[0]-a[0])*dx+(c[1]-a[1])*dy)/length;v=((d[0]-a[0])*dx+(d[1]-a[1])*dy)/length
 return max(0,min(length,max(u,v))-max(0,min(u,v)))

def metrics(g,model):
 unique={}
 for e in model['edges']:
  if e.get('layer')=='ground':continue
  unique.setdefault((e['source'],e['target'],e['category']),g['paths'][e['id']])
 segments=[(k,a,b) for k,pts in unique.items() for a,b in zip(pts,pts[1:])]
 repeated=0;repeat_pairs=0;crossings=0
 for (k,a,b),(l,c,d) in combinations(segments,2):
  if k==l:continue
  n=shared_length(a,b,c,d)
  if n>1:repeated+=n;repeat_pairs+=1
  crossings+=crossing(a,b,c,d)
 return {'drawn_routes':len(unique),'route_length':round(sum(math.dist(a,b) for _,a,b in segments),1),'collinear_overlap_pairs_over_1px':repeat_pairs,'pairwise_overlap_length':round(repeated,1),'geometric_crossings':crossings}

def check():
 b,p=atlas.load();issues=[];checked=0
 for file in (atlas.HERE/'layouts').glob('*.json'):
  g=atlas.read(file);model=atlas.projection(b,p,g['view']);boxes=g['nodes']
  for a,c in combinations(boxes,2):
   r,s=boxes[a],boxes[c]
   if max(r['x'],s['x'])<min(r['x']+r['w'],s['x']+s['w'])-.5 and max(r['y'],s['y'])<min(r['y']+r['h'],s['y']+s['h'])-.5:
    issues.append({'view':file.name,'type':'node_overlap','nodes':[a,c]})
  for cluster,r in g['clusters'].items():
   t=r.get('title')
   if not t:continue
   for node,s in boxes.items():
    if max(t['x'],s['x'])<min(t['x']+t['w'],s['x']+s['w'])-.5 and max(t['y'],s['y'])<min(t['y']+t['h'],s['y']+s['h'])-.5:
     issues.append({'view':file.name,'type':'title_node_overlap','cluster':cluster,'node':node})
  for e in model['edges']:
   pts=g['paths'].get(e['id'],[]);checked+=1
   if len(pts)<2:issues.append({'view':file.name,'type':'missing_path','edge':e['id']})
   for a,d in zip(pts,pts[1:]):
    for nid,r in boxes.items():
     if crosses(a,d,r):issues.append({'view':file.name,'type':'node_crossing','edge':e['id'],'node':nid})
    for theme,r in g['clusters'].items():
     label=next((t['label'][g['language']] for t in b['themes'] if t['id']==theme),'Remote · other themes')
     length=sum(19 if ord(c)>255 else 10 for c in label)
     title=r.get('title',{'x':r['x']+18,'y':r['y']+8,'w':min(length,r['w']-36),'h':24})
     if title and crosses(a,d,title):issues.append({'view':file.name,'type':'title_crossing','edge':e['id'],'theme':theme})
 for file in (atlas.HERE/'graphs').glob('*.svg'):
  root=ET.parse(file).getroot()
  for a in root.findall('.//{'+atlas.NS+'}a'):
   href=a.get('href','')
   if '.svg#' not in href:continue
   name,anchor=href.split('#',1);dest=file.parent/name
   if not dest.exists():issues.append({'file':file.name,'type':'missing_link_file','href':href});continue
   ids={n.get('id') for n in ET.parse(dest).getroot().iter()}
   if unquote(anchor) not in ids:issues.append({'file':file.name,'type':'missing_link_anchor','href':href})
 overview=atlas.projection(b,p)
 comparison={'v6':metrics(atlas.read(atlas.HERE/'layouts/overview-zh.json'),overview)}
 old=atlas.HERE.parent/'space-atlas-v4/layouts/overview-zh.json'
 if old.exists():comparison['v4']=metrics(atlas.read(old),overview)
 report={'routed_relations_checked':checked,'issues':issues,'issue_count':len(issues),'overview_comparison':comparison}
 atlas.write(atlas.HERE/'geometry-check.json',report)
 print(json.dumps({'routed_relations_checked':checked,'issue_count':len(issues),'sample':issues[:12]},ensure_ascii=False))
 return report

if __name__=='__main__':
 sys.stdout.reconfigure(encoding='utf-8');report=check();sys.exit(bool(report['issues']))
