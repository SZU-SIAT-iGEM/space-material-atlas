import unittest,sys,copy
from pathlib import Path
import atlas
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/atlas-json-author/scripts'))
import atlas_json as tool

class SkillTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.b=atlas.read(ROOT/'tests/fixtures/v7/baseline.json');cls.p=atlas.read(ROOT/'tests/fixtures/v7/projects.json');a=ROOT/'skills/atlas-json-author/assets'
  cls.plan=tool.read(a/'team-plan.example.json');cls.nodes=tool.read(a/'nodes.example.json')
 def test_compile_importable(self):
  q=tool.compile_plan(self.plan,self.nodes,self.b,self.p);tool.validate(ROOT,self.b,self.p,q)
  self.assertEqual(len(q['edges']),2);self.assertEqual(q['enhancements'][0]['target'],'space_bioreactor')
  self.assertEqual(q['team']['chains'][0]['step_ids'],['2026-example:recovery'])
 def test_shared_node_recreation_rejected(self):
  n=copy.deepcopy(self.nodes);n[0]['id']='water'
  with self.assertRaises(ValueError):tool.compile_plan(self.plan,n,self.b,self.p)
 def test_missing_endpoint_rejected(self):
  p=copy.deepcopy(self.plan);p['connections'][0]['source']='missing-water'
  with self.assertRaises(ValueError):tool.validate(ROOT,self.b,self.p,tool.compile_plan(p,self.nodes,self.b,self.p))
 def test_private_note_rejected(self):
  q=tool.compile_plan(self.plan,self.nodes,self.b,self.p);q['team']['finding']='internal draft'
  with self.assertRaises(ValueError):tool.validate(ROOT,self.b,self.p,q)
 def test_demonstration_preserved(self):
  p=copy.deepcopy(self.plan);p['routes'][0]['demonstration']=True
  q=tool.compile_plan(p,self.nodes,self.b,self.p)
  self.assertTrue(q['team']['chains'][0]['demonstration']);self.assertTrue(all(e['demonstration'] for e in q['edges']))

if __name__=='__main__':unittest.main(verbosity=2)
