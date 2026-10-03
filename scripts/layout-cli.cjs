const fs=require('node:fs'),L=require('../web/layout-core.js'),Viz=require('../vendor/viz.cjs');
(async()=>{const request=JSON.parse(fs.readFileSync(0,'utf8'));const requests=Array.isArray(request)?request:[request];let viz;
const results=[];for(const r of requests){const key=await L.signature(r.model,r.lang);results.push(r.signatureOnly?{key}:await L.layout(r.model,r.lang,viz??=await Viz.instance(),key));}
process.stdout.write(JSON.stringify(Array.isArray(request)?results:results[0]));})().catch(e=>{console.error(e.stack);process.exit(1);});
