import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class ProvenanceTests(unittest.TestCase):
    def test_reviews_reference_known_teams_and_statuses(self):
        config = json.loads((ROOT / 'content/site/config.json').read_text(encoding='utf-8-sig'))
        provenance = config['provenance']
        team_ids = {p.stem for p in (ROOT / 'content/teams').glob('*/*.json')}
        self.assertIn(provenance['default_status'], provenance['statuses'])
        for status in provenance['statuses'].values():
            for field in ('label', 'detail'):
                self.assertTrue(status[field]['zh'] and status[field]['en'])
        for team_id, review in provenance['reviews'].items():
            self.assertIn(team_id, team_ids)
            self.assertIn(review['status'], provenance['statuses'])
            if review['status'] == 'team_verified':
                self.assertTrue(review.get('basis'), team_id + ' needs a recorded basis')

if __name__ == '__main__':
    unittest.main()
