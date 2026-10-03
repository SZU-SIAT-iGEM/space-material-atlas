import copy
import shutil
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from cms.api import create_app
from cms.content import ROOT, load_legacy, save_modules, split

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='atlas-api-');self.root=Path(self.temp.name)
        save_modules(self.root/'content',split(load_legacy(ROOT/'tests/fixtures/v7')))
        shutil.copytree(ROOT/'admin',self.root/'admin')
        shutil.copytree(ROOT/'assets',self.root/'assets')
        self.client=TestClient(create_app(self.root))
    def tearDown(self):self.client.close();self.temp.cleanup()
    def test_edit_preview_apply_conflict_and_draft(self):
        current=self.client.get('/api/modules/site/config').json()
        value=copy.deepcopy(current['data']);value['about']['zh']+=' 修订。'
        proposal={'revision':current['revision'],'updates':{'site/config':value}}
        self.assertEqual(self.client.post('/api/preview',json=proposal).status_code,200)
        self.assertEqual(self.client.put('/api/drafts/site/config',json={'data':value,'revision':current['revision']}).status_code,200)
        self.assertEqual(self.client.post('/api/apply',json={**proposal,'reason':'API edit'}).status_code,200)
        self.assertEqual(self.client.post('/api/apply',json={**proposal,'reason':'stale'}).status_code,409)
    def test_cross_origin_mutation_blocked(self):
        self.assertEqual(self.client.post('/api/build',json={},headers={'Origin':'https://example.com'}).status_code,403)
    def test_reader_paths_do_not_serve_source_or_editor(self):
        self.assertEqual(self.client.get('/preview/x/proofreader.html').status_code,422)
        self.assertEqual(self.client.get('/content/manifest.json').status_code,404)
        self.assertEqual(self.client.get('/').status_code,200)
    def test_validation_error_retains_previous_content(self):
        current=self.client.get('/api/state').json()
        result=self.client.post('/api/apply',json={'revision':current['revision'],'reason':'bad','updates':{'shared/nodes':[]}})
        self.assertEqual(result.status_code,422)
        self.assertEqual(current['revision'],self.client.get('/api/state').json()['revision'])

    def test_new_team_draft_can_be_discovered_without_applying(self):
        current=self.client.get('/api/state').json()
        key='teams/2027/2027-draft'
        value={'roster':{'id':'2027-draft','year':2027,'name':'Draft only'},'team':None,
               'nodes':[],'edges':[],'dependencies':[],'enhancements':[]}
        result=self.client.put('/api/drafts/'+key,json={'data':value,'revision':current['revision']})
        self.assertEqual(result.status_code,200)
        next_state=self.client.get('/api/state').json()
        self.assertIn(key,[d['id'] for d in next_state['drafts']])
        self.assertEqual(next_state['revision'],current['revision'])
        self.assertEqual(self.client.get('/api/modules/'+key).json()['data'],value)

if __name__=='__main__':unittest.main()
