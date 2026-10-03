"""Build only the explicitly selected Pages files from publication data."""
import json
import shutil
from pathlib import Path
import atlas
import build_viewer

ALLOWED={
 'nodes':set('id label kind theme layer future owner route demonstration description description_en narrative source_ids boundary_role'.split()),
 'edges':set('id source target label category owner source_ids layer views route demonstration scenario theme scope scope_en'.split()),
 'dependencies':set('id source target label category owner source_ids route demonstration basis layer theme scenario scope scope_en'.split()),
 'enhancements':set('id source target label category owner source_ids kind scope scope_en measured_gain scenario route layer theme demonstration'.split()),
 'sources':set('id title url publisher accessed event_or_publication_date description display_kind display_url retrieved_at kind'.split()),
 'teams':set('id year name url location organizer_type description description_en narrative role primary_theme themes scenario source_ids chains'.split()),
 'chains':set('id theme demonstration label step_ids edge_ids dependencies'.split()),
 'themes':set('id label color'.split())}
BASE_TOP=set('schema_version as_of themes nodes edges sources overview_edge_ids'.split())
PROJECT_TOP=set('schema_version as_of coverage nodes edges dependencies enhancements teams sources presentation_version'.split())
PUBLIC_FILES={'index.html','atlas.html','atlas.json','iframe-demo.html'}
FORBIDDEN={'verification','verification_note','verification_note_en','experimental_claim','finding','review_summary','review_status','reviewed_at','evidence_note','evidence_status','migration','legacy_views','source_flow','scope_note','relevance'}

def check_keys(obj,allowed,path):
 extra=set(obj)-allowed
 if extra:raise ValueError(f'{path}: non-public fields {sorted(extra)}')

def check_data(b,p):
 for name,d,top in [('baseline',b,BASE_TOP),('projects',p,PROJECT_TOP)]:
  check_keys(d,top,name)
  for key,allowed in ALLOWED.items():
   for i,obj in enumerate(d.get(key,[])):
    check_keys(obj,allowed,f'{name}/{key}/{i}')
    for j,c in enumerate(obj.get('chains',[])):check_keys(c,ALLOWED['chains'],f'{name}/teams/{i}/chains/{j}')
 check_keys(p['coverage'],{'teams','years'},'coverage')
 atlas.assert_valid(b,p)

def scan(obj,path='payload'):
 if isinstance(obj,dict):
  for k,v in obj.items():
   if k in FORBIDDEN:raise ValueError(f'Historical field leaked: {path}/{k}')
   scan(v,path+'/'+k)
 elif isinstance(obj,list):
  for i,v in enumerate(obj):scan(v,path+'/'+str(i))

def verify_public():
 public=atlas.HERE/'public'
 actual={f.name for f in public.iterdir()}
 if actual!=PUBLIC_FILES:raise ValueError(f'Unexpected publish files: {actual ^ PUBLIC_FILES}')
 for name in ['atlas.html','index.html']:
  html=(public/name).read_text(encoding='utf8')
  payload=html.split('<script id="atlas-data" type="application/json">',1)[1].split('</script>',1)[0]
  scan(json.loads(payload))
  if '__ATLAS_DATA__' in html or '__BRAND_ICON__' in html:raise ValueError('Unexpanded template')
 scan(atlas.read(public/'atlas.json'))
 html=(public/'atlas.html').read_text(encoding='utf8')
 for forbidden in ['function openEditor(', 'function renderEditor(', 'id="bundle-import"', 'data-page="contribute"', 'proofreader.html']:
  if forbidden in html:raise ValueError('Editor capability leaked into public reader: '+forbidden)

def build():
 b,p=atlas.load();check_data(b,p)
 public=atlas.HERE/'public'
 if public.exists():
  extra={x.name for x in public.iterdir()}-PUBLIC_FILES
  if extra:raise ValueError(f'public contains unexpected files; inspect and remove them manually: {sorted(extra)}')
 for lang in ['zh','en']:
  for view in ['overview','effects']+list(atlas.theme_views(b)):
   atlas.layout(atlas.projection(b,p,view),lang,atlas.HERE/f'layouts/{view}-{lang}.json',True)
 build_viewer.build()
 public.mkdir(exist_ok=True)
 for name in ['atlas.html','atlas.json','iframe-demo.html']:shutil.copyfile(atlas.HERE/name,public/name)
 shutil.copyfile(atlas.HERE/'atlas.html',public/'index.html')
 verify_public()
 print('Release validated: '+', '.join(sorted(PUBLIC_FILES)))

if __name__=='__main__':build()
