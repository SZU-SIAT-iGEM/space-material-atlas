const fs = require('fs');
const Viz = require('../vendor/viz.cjs');
(async () => {
  const {dot, engine='dot'} = JSON.parse(fs.readFileSync(0, 'utf8'));
  const viz = await Viz.instance();
  process.stdout.write(viz.renderString(dot, {format:'json', engine}));
})().catch(e => { console.error(e.message); process.exit(1); });
