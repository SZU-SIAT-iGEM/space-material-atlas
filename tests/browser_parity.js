async (page) => {
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)},results=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewportSize({width:1440,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 // The same host protocol is exercised against v7 and the managed reader.
 for(const port of [8791,8790]){
  const base=`http://127.0.0.1:${port}`;
  await page.goto(base+'/iframe-demo.html');
  await page.locator('iframe').waitFor();
  await page.evaluate(()=>{window.testEvents=[];window.addEventListener('message',e=>{const f=document.querySelector('iframe');if(e.source===f.contentWindow&&e.origin===new URL(f.src).origin)window.testEvents.push(e.data)});});
  await page.locator('#language').selectOption('en');
  await page.locator('#reload').click();
  await page.waitForFunction(()=>window.testEvents.some(e=>e.type==='space-atlas:ready'));
  const frame=page.frames().find(f=>f!==page.mainFrame());
  async function command(type,data={}){
   await page.evaluate(({type,data})=>{window.testEvents=[];const f=document.querySelector('iframe');f.contentWindow.postMessage({type:'space-atlas:'+type,version:1,...data},new URL(f.src).origin)},{type,data});
  }
  async function expectState(expected){
   await page.waitForFunction(expected=>{const f=document.querySelector('iframe');f.contentWindow.postMessage({type:'space-atlas:get-state',version:1},new URL(f.src).origin);return window.testEvents.some(e=>e.type==='space-atlas:state'&&Object.entries(expected).every(([k,v])=>JSON.stringify(e[k])===JSON.stringify(v)))},expected,{polling:100,timeout:10000});
   return page.evaluate(()=>{const e=window.testEvents.filter(x=>x.type==='space-atlas:state').at(-1);return Object.fromEntries(['view','lang','mode','teams','ground','teamScope','focus'].map(k=>[k,e[k]]))});
  }
  const states=[];
  await command('set-teams',{teams:['2026-6100'],focus:true});states.push(await expectState({teams:['2026-6100'],teamScope:'2026-6100'}));
  await command('set-view',{view:'bioreactor'});states.push(await expectState({view:'bioreactor'}));
  await command('focus-node',{id:'friskoli'});states.push(await expectState({focus:'friskoli'}));
  assert(await frame.locator('.node.picked').count()===1,'Iframe did not highlight node');
  await command('reset-focus');states.push(await expectState({focus:null,teamScope:null}));
  await command('set-language',{lang:'zh'});states.push(await expectState({lang:'zh'}));
  await frame.waitForFunction(()=>document.documentElement.lang==='zh-CN');
  await command('set-language',{lang:'en'});await expectState({lang:'en'});
  await command('set-ground',{ground:true});states.push(await expectState({ground:true}));
  const boxBefore=await frame.locator('#canvas svg').getAttribute('viewBox');
  await command('fit');await expectState({ground:true});
  assert((await frame.locator('#canvas svg').getAttribute('viewBox')).split(' ').every(x=>Number.isFinite(Number(x))),'Invalid fit box');
  await command('set-teams',{teams:['2026-6100','2025-5983'],focus:false});states.push(await expectState({teams:['2026-6100','2025-5983'],teamScope:null}));
  await command('set-teams',{teams:['missing-team']});await expectState({teams:['2026-6100','2025-5983']});
  await page.evaluate(()=>{const f=document.querySelector('iframe');f.contentWindow.postMessage({type:'space-atlas:set-language',version:99,lang:'zh'},new URL(f.src).origin)});
  await expectState({lang:'en'});
  // Wrong origin and wrong window source must be ignored.
  await frame.evaluate(()=>{window.dispatchEvent(new MessageEvent('message',{data:{type:'space-atlas:set-language',version:1,lang:'zh'},origin:'https://untrusted.example',source:parent}));window.dispatchEvent(new MessageEvent('message',{data:{type:'space-atlas:set-language',version:1,lang:'zh'},origin:location.origin,source:window}));});
  await expectState({lang:'en'});
  assert(!await page.evaluate(()=>window.testEvents.some(e=>e.type==='space-atlas:error')),'Iframe error');
  results.push({port,states,commands:8,rejects:['unknown-team','wrong-version','wrong-origin','wrong-window'],fitBox:boxBefore});
 }
 assert(JSON.stringify(results[0].states)===JSON.stringify(results[1].states),'Reader protocol differs from v7');
 // UI focus and exports on the managed build.
 await page.goto('http://127.0.0.1:8790/atlas.html?guide=0&lang=en#teams');
 await page.locator('[data-team-page="2026-6273"]').click();
 assert((await page.locator('#content-page').innerText()).includes('Awaiting additions'),'Listed team misclassified');
 assert(await page.locator('#content-page [data-team-focus]').count()===0,'Pending team has a route button');
 await page.locator('[data-page="teams"]').first().click();
 await page.locator('[data-team-page="2026-6100"]').click();
 await page.locator('[data-team-focus="2026-6100"]').click();
 await page.locator('#canvas svg').waitFor();
 assert((await page.locator('#detail').innerText()).includes('SZU-SIAT'),'Team focus details missing');
 await page.locator('#clear-focus').click();
 assert(await page.locator('.node.picked').count()===0,'Clear focus did not clear highlight');
 await page.locator('#node-search').fill('water');await page.locator('#node-results button').first().waitFor();
 await page.locator('#node-search').press('ArrowDown');await page.locator('#node-search').press('Enter');
 await page.locator('.node.picked').waitFor();
 await page.locator('[data-page="teams"]').first().click();await page.locator('[data-team-page="2026-6100"]').click();
 const download=page.waitForEvent('download');await page.locator('[data-export-team="2026-6100"]').click();
 assert((await download).suggestedFilename()==='2026-6100.json','Team bundle export missing');
 // Trial build: the imported team can be reached through URL parameters and iframe.
 await page.goto('http://127.0.0.1:8792/atlas.html?guide=0&lang=en&team=2026-6273&focusTeam=1&view=energy');
 await page.locator('#canvas svg').waitFor();
 assert((await page.locator('#status').innerText()).includes('nodes'),'Trial graph failed');
 await page.locator('#node-search').fill('Methanol');await page.locator('#node-results button').first().click();
 await page.locator('.node.picked').waitFor();
 assert((await page.locator('#detail').innerText()).includes('HiZJU-China'),'Trial node owner missing');
 await page.screenshot({path:'.state/hizju-trial.png'});
 await page.goto('http://127.0.0.1:8792/iframe-demo.html');
 await page.locator('#teams input[value="2026-6273"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#teams input[value="2026-6100"]').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#reload').click();
 await page.waitForFunction(()=>{try{const s=JSON.parse(document.querySelector('#state').textContent);return s.teams?.length===1&&s.teams[0]==='2026-6273'&&s.teamScope==='2026-6273'}catch{return false}});
 assert(errors.length===0,errors.join('\n'));
 return {protocolParity:results,reader:{teamFocus:true,nodeSearchFocus:true,clearFocus:true,teamExport:true,awaitingStatus:true},trial:{compactTeam:true,nodeFocus:true,iframeTeamFocus:true},errors};
}
