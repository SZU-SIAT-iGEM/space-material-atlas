import copy
import unittest
import atlas
import build_release as release

class ReleaseTests(unittest.TestCase):
 def test_current_artifact(self):release.verify_public()
 def test_historical_field_rejected(self):
  b,p=atlas.load();p['teams'][0]['verification_note']='PRIVATE_SENTINEL'
  with self.assertRaises(ValueError):release.check_data(b,p)
 def test_unknown_field_rejected(self):
  b,p=atlas.load();p['nodes'][0]['unreviewed_draft']='PRIVATE_SENTINEL'
  with self.assertRaises(ValueError):release.check_data(b,p)
 def test_nested_embedded_field_rejected(self):
  with self.assertRaises(ValueError):release.scan({'scenes':{'overview':{'nodes':[{'finding':'PRIVATE_SENTINEL'}]}}})
 def test_preserve_route_semantics(self):
  b,p=atlas.load();self.assertEqual(len(p['teams']),p['coverage']['teams'])
  if not any(t['id']=='2026-6100' for t in p['teams']):return
  b=atlas.read(atlas.HERE/'tests/fixtures/v7/baseline.json');p=atlas.read(atlas.HERE/'tests/fixtures/v7/projects.json')
  v=atlas.visible(atlas.projection(b,p),{'2026-6100'})
  self.assertIn('space_bioreactor',v['nodes']);self.assertNotIn('f_cellulose',v['nodes'])
  self.assertEqual(len(v['badges']['space_bioreactor']),1)

if __name__=='__main__':unittest.main(verbosity=2)
