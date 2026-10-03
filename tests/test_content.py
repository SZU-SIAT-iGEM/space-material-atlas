import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from cms.content import (ROOT, compile_modules, digest, load_legacy, load_modules, save_modules,
                         split, validate, write)
from cms.store import Store, Conflict

class ContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.documents = load_legacy(ROOT / 'tests/fixtures/v7')
        cls.modules = split(cls.documents)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='atlas-test-')
        self.root = Path(self.temp.name)
        save_modules(self.root / 'content', self.modules)
        self.store = Store(self.root)

    def tearDown(self): self.temp.cleanup()

    def test_lossless_roundtrip_all_fields_and_order(self):
        self.assertEqual(compile_modules(self.modules), self.documents)
        self.assertEqual(validate(self.documents), {'teams':22,'roster':38,'nodes':170,'relations':252,'sources':84,'years':[2024,2025,2026]})

    def test_new_year_roster_only_preserved_and_later_integrated(self):
        snap = self.store.snapshot()
        key = 'teams/2027/2027-new'
        value = {'roster': {'id':'2027-new','year':2027,'name':'New team','integrated':False},
                 'team':None,'nodes':[],'edges':[],'dependencies':[],'enhancements':[]}
        self.store.apply(snap['revision'], {key:value}, 'Add next year')
        self.assertEqual(self.store.overview()['counts']['roster'],39)
        self.assertEqual(self.store.overview()['counts']['teams'],22)
        old = copy.deepcopy(next(v for k,v in self.modules.items() if k.startswith('teams/') and v['team']))
        tid = old['team']['id']
        cloned = json.loads(json.dumps(old).replace(tid,'2027-new'))
        cloned['team']['year'] = cloned['roster']['year'] = 2027
        sources = copy.deepcopy(self.modules['sources/projects'])
        original_source = next(s for s in sources if s['id']=='team:'+tid)
        sources.append(json.loads(json.dumps(original_source).replace(tid,'2027-new')))
        self.store.apply(self.store.snapshot()['revision'], {key:cloned,'sources/projects':sources}, 'Integrate route')
        self.assertEqual(self.store.overview()['counts']['teams'],23)
        self.assertIn(2027,self.store.overview()['counts']['years'])

    def test_revisions_conflicts_and_history_restore(self):
        snap = self.store.snapshot(); config = copy.deepcopy(snap['modules']['site/config'])
        config['about']['zh'] += ' 修订说明。'
        self.store.apply(snap['revision'], {'site/config':config}, 'Revise About')
        with self.assertRaises(Conflict): self.store.apply(snap['revision'], {'site/config':config}, 'Stale')
        h = self.store.history()[0]
        before = load_modules(self.root / '.state/history' / h['id'] / 'before')
        proposal = self.store.restore_updates(before)
        self.store.apply(proposal['revision'],proposal['updates'],'Restore')
        self.assertEqual(self.store.snapshot()['revision'],snap['revision'])

    def test_invalid_edit_is_atomic_and_does_not_create_history(self):
        snap=self.store.snapshot(); nodes=copy.deepcopy(self.modules['shared/nodes'])
        nodes=[n for n in nodes if n['id']!='space_bioreactor']
        with self.assertRaises(ValueError): self.store.apply(snap['revision'],{'shared/nodes':nodes},'Delete referenced node')
        self.assertEqual(self.store.snapshot(),snap)
        self.assertEqual(self.store.history(),[])

    def test_shared_revision_reports_affected_teams_and_views(self):
        snap=self.store.snapshot(); nodes=copy.deepcopy(self.modules['shared/nodes'])
        next(n for n in nodes if n['id']=='space_bioreactor')['description']='Revised process description'
        result=self.store.preview(snap['revision'],{'shared/nodes':nodes})
        self.assertIn('2026-6100',result['impact']['teams'])
        self.assertIn('overview',result['impact']['views'])

    def test_draft_does_not_enter_build_content(self):
        before=self.store.snapshot()
        self.store.draft('site/config',{'data':{'incomplete':'draft'},'revision':before['revision']})
        self.assertEqual(before,self.store.snapshot())

    def test_incomplete_routes_and_unsafe_topic_names_remain_drafts(self):
        snap=self.store.snapshot()
        key=next(k for k,v in self.modules.items() if k.startswith('teams/') and v['team'])
        module=copy.deepcopy(self.modules[key]);module['team']['chains'][0]['step_ids']=[]
        with self.assertRaisesRegex(ValueError,'at least one step'):
            self.store.preview(snap['revision'],{key:module})
        themes=copy.deepcopy(self.modules['baseline/themes'])
        themes.append({'id':'topic:invalid','label':{'en':'New','zh':'新主题'},'color':'#abcdef'})
        with self.assertRaises(ValueError):self.store.preview(snap['revision'],{'baseline/themes':themes})

    def test_committed_interrupted_history_is_recovered(self):
        snap=self.store.snapshot();config=copy.deepcopy(snap['modules']['site/config'])
        config['about']['en']+=' Revision.'
        self.store.apply(snap['revision'],{'site/config':config},'Revision')
        record=self.store.history()[0];folder=self.root/'.state/history'/record['id']
        (folder/'record.json').rename(folder/'prepared.json')
        write(self.root/'.state/pending.json',{'id':record['id']})
        self.assertEqual(Store(self.root).history()[0]['next_revision'],record['next_revision'])

    def test_business_and_atlas_import_preserve_untouched_documents(self):
        b=copy.deepcopy(self.documents['baseline.json']);b['nodes'][0]['description']='Revised'
        result=self.store.import_updates({'filename':'baseline.json','data':b})
        self.store.apply(result['revision'],result['updates'],'Baseline revision')
        docs=compile_modules(self.store.snapshot()['modules'])
        for name in ('projects.json','roster.json','site-config.json'):self.assertEqual(docs[name],self.documents[name])
        result=self.store.import_updates({'baseline':docs['baseline.json'],'projects':docs['projects.json'],'layouts':{}})
        self.assertEqual(result['preview']['changes'],[])

    def test_duplicate_sources_and_foreign_owner_rejected(self):
        docs=copy.deepcopy(self.documents);docs['projects.json']['sources'].append(docs['projects.json']['sources'][0])
        with self.assertRaisesRegex(ValueError,'duplicate'):validate(docs)
        snap=self.store.snapshot();key=next(k for k,v in self.modules.items() if k.startswith('teams/') and v['nodes'])
        module=copy.deepcopy(self.modules[key]);module['nodes'][0]['owner']='2027-other'
        with self.assertRaises(ValueError):self.store.preview(snap['revision'],{key:module})

    def test_import_bundle_preserves_other_team_and_shared_records(self):
        p=self.documents['projects.json'];t=p['teams'][0]
        bundle={'format':'space-atlas-team-bundle-1','team':copy.deepcopy(t),
                **{k:[x for x in p[k] if x.get('owner')==t['id']] for k in ('nodes','edges','dependencies','enhancements')},
                'sources':[s for s in p['sources'] if s['id'] in t['source_ids']]}
        bundle['team']['description']='New description'
        result=self.store.import_updates(bundle)
        self.store.apply(result['revision'],result['updates'],'Team revision')
        updated=compile_modules(self.store.snapshot()['modules'])['projects.json']
        self.assertEqual(updated['nodes'],p['nodes']);self.assertEqual(updated['teams'][1:],p['teams'][1:])

    def test_merge_checks_existing_references(self):
        proposal=self.store.merge_node_updates('f_waste','f_sugars')
        self.assertGreater(len(proposal['preview']['impact']['teams']),0)
        self.store.apply(proposal['revision'],proposal['updates'],'Merge material')
        docs=compile_modules(self.store.snapshot()['modules'])
        self.assertNotIn('f_waste',[n['id'] for n in docs['projects.json']['nodes']])
        validate(docs)

    def test_interrupted_directory_swap_recovers(self):
        before=self.store.snapshot()['revision'];tx=self.root/'.state/transactions/interrupted';tx.mkdir(parents=True)
        write(self.root/'.state/pending.json',{'id':'interrupted'})
        (self.root/'content').rename(tx/'before')
        recovered=Store(self.root)
        self.assertEqual(recovered.snapshot()['revision'],before)

    def test_module_path_traversal_rejected(self):
        with self.assertRaises(ValueError):self.store.preview(self.store.snapshot()['revision'],{'../bad':{}})

if __name__=='__main__':unittest.main()
