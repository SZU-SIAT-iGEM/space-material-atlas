const assert=require('node:assert/strict'),C=require('../web/core.js');
const p={teams:[{id:'2026-modeled'}]},roster={teams:[{id:'2026-modeled'},{id:'2026-listed'}]};
assert.equal(C.teamStatus(p,roster,'2026-modeled'),'integrated');
assert.equal(C.teamStatus(p,roster,'2026-listed'),'awaiting_additions');
assert.equal(C.teamStatus(p,roster,'2027-prospect'),'future_outlook');
const team={id:'2026-modeled',source_ids:['team-source']};
const bundle=C.teamBundle({teams:[team],nodes:[{owner:team.id,source_ids:['node-source']}],edges:[],dependencies:[],enhancements:[],sources:[{id:'team-source'},{id:'node-source'},{id:'unrelated'}]},team.id);
assert.deepEqual(bundle.sources.map(s=>s.id),['team-source','node-source']);
console.log('Team status and full-source export: 4 checks passed');
