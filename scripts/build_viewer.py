"""Package existing graph functions in a standalone, offline HTML viewer."""
import json
import base64
import html
import xml.etree.ElementTree as ET
import atlas
import reader_bundle

def build():
    b,p=atlas.load();teams={t['id'] for t in p['teams']}
    views=['overview','effects']+list(atlas.theme_views(b));scenes={}
    for lang in ['zh','en']:
        for view in views:
            root,_,g,_=atlas.render(b,p,view,lang,teams,ground=True)
            scenes[f'{view}-{lang}']={'svg':ET.tostring(root,encoding='unicode'),'geometry':g,'model':atlas.projection(b,p,view)}
    payload={'baseline':b,'projects':p,'views':views,'scenes':scenes,
             'config':json.loads((atlas.HERE/'data/site-config.json').read_text(encoding='utf-8')),
             'roster':json.loads((atlas.HERE/'data/roster.json').read_text(encoding='utf-8'))}
    template=reader_bundle.reader_template((atlas.HERE/'web/template.html').read_text(encoding='utf-8'))
    embedded=json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    parts={'__STYLE__':'web/style.css','__VIZ__':'vendor/viz.cjs','__CORE__':'web/core.js',
           '__RUNTIME__':'web/runtime-graph.js','__APP__':'web/app.js',
           '__DOWNLOAD_UTILS__':'web/download-utils.js','__TEAM_REPORT__':'web/team-report.js',
           '__EXPERIENCE__':'web/experience.js',
           '__VIEWPORT_CORE__':'web/viewport-core.js','__VIEWPORT__':'web/viewport.js','__LAYOUT__':'web/layout-core.js'}
    for token,path in parts.items():
        source=(atlas.HERE/path).read_text(encoding='utf-8')
        if token=='__APP__':source=reader_bundle.reader_app(source)
        if token=='__STYLE__':
            for sheet in ['web/experience.css','web/responsive.css','web/comfort.css']:
                source+='\n'+(atlas.HERE/sheet).read_text(encoding='utf-8')
        template=template.replace(token,source)
    deployment=atlas.read(atlas.HERE/'deployment.json') if (atlas.HERE/'deployment.json').exists() else {}
    icon=deployment.get('brand_asset_url') or 'data:image/svg+xml;base64,'+base64.b64encode((atlas.HERE/'assets/steward.svg').read_bytes()).decode('ascii')
    template=template.replace('__BRAND_ICON__',html.escape(icon,quote=True))
    (atlas.HERE/'atlas.html').write_text(template.replace('__ATLAS_DATA__',embedded),encoding='utf-8')
    atlas.write(atlas.HERE/'atlas.json',{'baseline':b,'projects':p,'layouts':{k:v['geometry'] for k,v in scenes.items()}})
    def core(t):
        effects=[e['source'] for e in p['enhancements'] if e['owner']==t['id'] and any(n['id']==e['source'] and n.get('owner')==t['id'] for n in p['nodes'])]
        routes=[c for c in t['chains'] if not c['demonstration']]
        return effects[0] if effects else next((c['step_ids'][0] for c in routes if c['theme']==t['primary_theme']),routes[0]['step_ids'][0] if routes else t['chains'][0]['step_ids'][0])
    relationships=p['edges']+p['dependencies']+p['enhancements']
    demo={'teams':[{'id':t['id'],'year':t['year'],'name':t['name'],'core':core(t)} for t in p['teams']],
          'nodes':[{'id':n['id'],'label':n['label'],'description':n.get('description',''),'related_teams':sorted({e['owner'] for e in relationships if n['id'] in [e['source'],e['target']]}|({n['owner']} if n.get('owner') else set()))} for n in b['nodes']+p['nodes']],
          'views':views,'themes':b['themes']}
    demo_json=json.dumps(demo,ensure_ascii=False).replace('<','\\u003c')
    (atlas.HERE/'iframe-demo.html').write_text(reader_bundle.reader_demo((atlas.HERE/'web/iframe-demo.template.html').read_text(encoding='utf8')).replace('__DEMO_DATA__',demo_json).replace('__DEMO_I18N__',(atlas.HERE/'web/demo-i18n.js').read_text(encoding='utf8')),encoding='utf8')
    proof=json.dumps({name:atlas.read(atlas.HERE/'data'/name) for name in ['baseline.json','projects.json','roster.json','site-config.json']},ensure_ascii=False).replace('<','\\u003c')
    proof_template=(atlas.HERE/'web/proofreader.template.html').read_text(encoding='utf8')
    (atlas.HERE/'proofreader.html').write_text(proof_template.replace('__PROOF_DATA__',proof).replace('__DOWNLOAD_UTILS__',(atlas.HERE/'web/download-utils.js').read_text(encoding='utf8')),encoding='utf8')
    print('Standalone HTML and editable JSON generated.')

if __name__=='__main__':build()
