import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path
from cms.content import ROOT, compile_modules, load_legacy, load_modules, read, save_modules, split
from cms.store import Store, Conflict

class TeamImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='atlas-import-')
        self.root = Path(self.temp.name)
        self.modules = split(load_legacy(ROOT/'tests/fixtures/v7'))
        save_modules(self.root/'content', self.modules)
        self.store = Store(self.root)
        self.bundle = read(ROOT/'tests/fixtures/team-import.json')

    def tearDown(self): self.temp.cleanup()

    def test_trial_preserves_original_and_reuses_identity(self):
        before = self.store.snapshot()
        proposal = self.store.import_updates(self.bundle)
        self.assertEqual(self.store.snapshot(), before)
        self.assertEqual(proposal['preview']['counts'], {'teams':23,'roster':38,'nodes':174,'relations':258,'sources':85,'years':[2024,2025,2026]})
        self.store.apply(proposal['revision'], proposal['updates'], 'Test document import')
        after = self.store.snapshot()['modules']
        for key,value in self.modules.items():
            if key not in ('teams/2026/2026-6273','sources/projects','manifest'):
                self.assertEqual(after[key],value,key)
        self.assertEqual(after['teams/2026/2026-6273']['roster'],{**self.modules['teams/2026/2026-6273']['roster'],'integrated':True})
        self.assertFalse(self.store.import_updates(self.bundle)['preview']['changes'])

    def test_broken_connection_rejected_without_writes(self):
        before=self.store.snapshot()
        self.bundle['edges'][0]['source']='missing-input'
        with self.assertRaises(ValueError): self.store.import_updates(self.bundle)
        self.assertEqual(before,self.store.snapshot())

    def test_stale_review_rejected(self):
        proposal=self.store.import_updates(self.bundle)
        config=copy.deepcopy(self.modules['site/config']);config['version']='test-new'
        self.store.apply(proposal['revision'],{'site/config':config},'Concurrent edit')
        with self.assertRaises(Conflict):self.store.apply(proposal['revision'],proposal['updates'],'Stale import')

    def test_compact_route_has_only_supported_shared_connections(self):
        self.assertEqual(len(self.bundle['nodes']),4)
        self.assertEqual(len(self.bundle['team']['chains']),1)
        relations=[*self.bundle['edges'],*self.bundle['dependencies'],*self.bundle['enhancements']]
        self.assertEqual(len(relations),6)
        own={n['id'] for n in self.bundle['nodes']}
        external={e[k] for e in relations for k in ('source','target') if e[k] not in own}
        self.assertEqual(external,{'marsco2','sun','space_bioreactor'})

    def test_docx_extraction_preserves_tables_notes_and_links(self):
        import zipfile
        spec=importlib.util.spec_from_file_location('team_import',ROOT/'skills/atlas-team-import/scripts/team_import.py')
        helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
        source=self.root/'sample.docx'
        with zipfile.ZipFile(source,'w') as z:
            z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>table evidence</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
            z.writestr('word/footnotes.xml','<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote><w:p><w:r><w:t>note</w:t></w:r></w:p></w:footnote></w:footnotes>')
            z.writestr('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" TargetMode="External" Target="https://example.org/source"/></Relationships>')
            z.writestr('word/media/image1.png',b'placeholder')
        result=helper.extract(source)
        self.assertEqual([p['text'] for p in result['paragraphs']],['table evidence','note'])
        self.assertEqual(result['links'][0]['url'],'https://example.org/source')
        self.assertEqual(result['nontext_parts'],['word/media/image1.png'])
        self.assertEqual(len(result['sha256']),64)

if __name__=='__main__':unittest.main()
