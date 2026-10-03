async page => {
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)},errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewportSize({width:1440,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:8793/atlas.html?guide=0&lang=en&team=2026-6055&focusTeam=1&view=bioreactor');
 await page.locator('#canvas svg').waitFor();
 assert(await page.locator('html').getAttribute('lang')==='en','English default');
 await page.locator('#fit').click();
 assert(await page.locator('#status').innerText()==='9 nodes · 8 connections','Unexpected trial size');
 await page.screenshot({path:'.state/buct-document/preview-en.png'});
 await page.locator('#node-search').fill('L-carnosine');
 await page.locator('#node-results button').first().click();
 assert((await page.locator('#detail').innerText()).includes('BUCT'),'Node focus owner missing');
 await page.locator('#detail [data-team-page="2026-6055"]').click();
 assert((await page.locator('#content-page').innerText()).includes('Air2Protein'),'Team narrative missing');
 const download=page.waitForEvent('download');await page.locator('[data-export-team="2026-6055"]').click();
 assert((await download).suggestedFilename()==='2026-6055.json','Team export failed');
 await page.locator('#content-page [data-team-focus="2026-6055"]').click();
 assert((await page.locator('#detail').innerText()).includes('Air2Protein'),'Team focus failed');
 await page.locator('#lang').selectOption('zh');
 await page.locator('#view').selectOption('bioreactor');
 await page.waitForFunction(()=>document.querySelector('#canvas svg')?.dataset.view==='bioreactor'&&document.documentElement.lang==='zh-CN');
 await page.locator('#fit').click();
 await page.screenshot({path:'.state/buct-document/preview-zh.png'});
 await page.goto('http://127.0.0.1:8793/iframe-demo.html');
 await page.locator('#teams input[value="2026-6055"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#teams input[value="2026-6100"]').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#reload').click();
 await page.waitForFunction(()=>{try{const s=JSON.parse(document.querySelector('#state').textContent);return s.teams?.length===1&&s.teams[0]==='2026-6055'&&s.teamScope==='2026-6055'}catch{return false}});
 await page.evaluate(()=>localStorage.clear());
 await page.goto('http://127.0.0.1:8793/atlas.html?guide=0&team=2026-6055&focusTeam=1&view=bioreactor');
 await page.locator('#canvas svg').waitFor();
 assert(await page.locator('html').getAttribute('lang')==='en','Fresh visit must default to English');
 for(const [name,width,height] of [['phone-portrait',390,844],['phone-landscape',844,390],['tablet',768,1024],['desktop',1440,900]]){
  await page.setViewportSize({width,height});
  await page.locator('#reset-view').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal page overflow: '+name);
  assert(await page.locator('#canvas svg').isVisible(),'Canvas missing: '+name);
  await page.screenshot({path:'.state/buct-document/'+name+'.png'});
 }
 assert(!errors.length,errors.join('\n'));
 return {bilingual:true,defaultEnglish:true,nodeFocus:true,teamFocus:true,bundleExport:true,iframeTeamFocus:true,viewportSizes:4,errors};
}
