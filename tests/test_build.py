import copy
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from cms.content import ROOT, load_modules, save_modules
from cms.build import build, copy_sources, export_source, hashes, release, release_modules, release_identity, releases
from cms.store import Store


class BuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='atlas-build-')
        cls.root = Path(cls.temp.name) / 'project'
        copy_sources(ROOT, cls.root)
        cls.modules = load_modules(ROOT / 'content')
        save_modules(cls.root / 'content', cls.modules)
        cls.built = build(cls.root, cls.modules, cls.root / 'public')

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def test_clean_export_rebuild_matches_static_hashes(self):
        archive = export_source(self.root, self.modules, self.root / 'dist/source.zip')
        fresh = Path(self.temp.name) / 'fresh'
        with zipfile.ZipFile(archive) as z:
            self.assertFalse(any(n.startswith(('.state/', '.venv/', 'public/', '.build/')) for n in z.namelist()))
            z.extractall(fresh)
        run = subprocess.run([sys.executable, '-B', 'manage.py', 'build'], cwd=fresh, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(hashes(fresh / 'public'), hashes(self.root / 'public'))

    def test_failed_build_preserves_previous_public(self):
        before = hashes(self.root / 'public')
        with patch('cms.build.run', side_effect=ValueError('Layout failed')):
            with self.assertRaises(ValueError): build(self.root, self.modules, self.root / 'public')
        self.assertEqual(before, hashes(self.root / 'public'))

    def test_immutable_release_and_content_restore(self):
        manifest = release(self.root, 'i2026.P0.1', 'Test snapshot', self.modules)
        with self.assertRaisesRegex(ValueError, '已存在'): release(self.root, 'i2026.P0.1')
        expected = copy.deepcopy(self.modules); expected['site/config']['version'] = 'i2026.P0.1'
        self.assertEqual(release_modules(self.root, 'i2026.P0.1'), expected)
        store = Store(self.root)
        config = copy.deepcopy(self.modules['site/config']);config['about']['en'] += ' Later revision.'
        store.apply(store.snapshot()['revision'], {'site/config':config}, 'Later revision')
        proposal = store.restore_updates(release_modules(self.root, 'i2026.P0.1'))
        store.apply(proposal['revision'], proposal['updates'], 'Restore snapshot')
        self.assertEqual(store.snapshot()['revision'], manifest['revision'])

    def test_future_year_and_new_topic_build(self):
        modules = copy.deepcopy(self.modules)
        original = next(v for k,v in modules.items() if k.startswith('teams/') and v['team'])
        tid = original['team']['id'];newid='2027-growth'
        team = json.loads(json.dumps(original).replace(tid,newid))
        team['team']['year']=team['roster']['year']=2027
        modules['teams/2027/'+newid]=team
        source=next(s for s in modules['sources/projects'] if s['id']=='team:'+tid)
        modules['sources/projects'].append(json.loads(json.dumps(source).replace(tid,newid)))
        modules['baseline/themes'].append({'id':'future-topic','label':{'zh':'新增主题','en':'New topic'},'color':'#edf8f3'})
        modules['baseline/nodes'].append({'id':'future-node','kind':'process','theme':'future-topic','layer':'baseline','future':False,'label':{'zh':'新增工艺','en':'New process'},'description':'','description_en':'','source_ids':[]})
        modules['baseline/edges'].append({'id':'future-edge','source':'water','target':'future-node','category':'material','label':{'zh':'新联系','en':'New connection'},'layer':'baseline','views':['future-topic'],'source_ids':[]})
        result=build(self.root,modules)
        self.assertEqual(result['report']['counts']['teams'],self.built['report']['counts']['teams']+1)
        self.assertEqual(result['report']['counts']['roster'],self.built['report']['counts']['roster']+1)
        self.assertIn(2027,result['report']['counts']['years'])
        self.assertIn('future-topic-en',result['report']['layouts'])
        self.assertEqual(result['report']['geometry']['issue_count'],0)

    def test_version_format_and_numeric_order(self):
        self.assertEqual(release_identity('i2027.R2.10'), {'year':2027,'phase':'R','baseline_round':2,'submission_round':10})
        for name in ['2026.1','i2026.X0.1','i2026.P01.1','i2026.P0','../i2026.P0.2']:
            with self.assertRaises(ValueError): release_identity(name)
        with tempfile.TemporaryDirectory() as tmp:
            for name in ['i2026.P0.2','i2026.P0.10','i2026.R0.10','i2027.P0.0']:
                path=Path(tmp)/'releases'/name/'manifest.json';path.parent.mkdir(parents=True)
                path.write_text(json.dumps({'name':name}),encoding='utf8')
            self.assertEqual([x['name'] for x in releases(tmp)], ['i2027.P0.0','i2026.R0.10','i2026.P0.10','i2026.P0.2'])

if __name__ == '__main__': unittest.main()
