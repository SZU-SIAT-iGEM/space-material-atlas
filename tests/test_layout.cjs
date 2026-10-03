const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const C=require('../web/core.js'),L=require('../web/layout-core.js'),Viz=require('../vendor/viz.cjs');
const base=path.join(__dirname,'fixtures/v7'),read=n=>JSON.parse(fs.readFileSync(path.join(base,n),'utf8'));
(async()=>{
 const b=read('baseline.json'),p=read('projects.json'),viz=await Viz.instance();
 const browser={crypto:webcrypto,TextEncoder,console};browser.globalThis=browser;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/layout-core.js'),'utf8'),browser);
 let passed=0;
 for(const lang of ['zh','en'])for(const view of ['overview','effects',...Object.keys(C.themeViews)]){
  const model=C.project(b,p,view),node=await L.layout(model,lang,viz),front=await browser.AtlasLayout.layout(model,lang,viz);
  assert.deepEqual(JSON.parse(JSON.stringify(front)),node,`browser/Node ${view}/${lang}`);
  const prior=read(`layouts/${view}-${lang}.json`);
  for(const [id,rect]of Object.entries(prior.nodes))for(const key of ['x','y','w','h'])assert(Math.abs(rect[key]-node.nodes[id][key])<1e-7,`${view}/${lang}/${id}/${key}`);
  const revised=structuredClone(model);for(const n of Object.values(revised.nodes))n.description='Changed prose';for(const e of revised.edges)e.label={zh:'新说明',en:'Revised description'};
  assert.equal(await L.signature(revised,lang),await L.signature(model,lang));
  passed++;
 }
 const empty=await L.layout({view:'overview',nodes:{},edges:[]},'en',viz);assert.equal(empty.width,1000);
 console.log(`${passed} bilingual scene contracts: original coordinates, browser/Node parity, prose-only geometry reuse; empty graph passed`);
})().catch(e=>{console.error(e);process.exit(1);});
