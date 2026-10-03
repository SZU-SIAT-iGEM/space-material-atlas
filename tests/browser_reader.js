async (page) => {
 const assert=(ok,message)=>{if(!ok)throw Error(message)},errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:8790/atlas.html?guide=0&mode=edit#contribute');
 await page.locator('#canvas svg').waitFor();
 assert(await page.locator('[data-page="contribute"],#bundle-import,.editor-form').count()===0,'Public editor present');
 assert(await page.locator('html').getAttribute('lang')==='en','Not English by default');
 await page.locator('#canvas').screenshot({path:'.state/managed-canvas.png'});
 await page.getByRole('button',{name:'All teams',exact:true}).click();
 assert((await page.locator('#status').textContent()).includes('nodes'),'Atlas status missing');
 await page.getByLabel('Diagram topic').selectOption('water');
 await page.waitForFunction(()=>document.querySelector('#canvas svg')?.dataset.view==='water');
 await page.getByLabel('Language',{exact:true}).selectOption('zh');
 await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');
 await page.getByLabel('语言',{exact:true}).selectOption('en');
 await page.getByRole('button',{name:'Quick guide',exact:true}).click();
 await page.locator('#atlas-guide').waitFor();
 await page.locator('#guide-close').click();
 await page.getByRole('searchbox',{name:'Find a material, process or team',exact:true}).fill('water');
 await page.locator('#node-results button').first().waitFor();
 await page.getByRole('searchbox',{name:'Find a material, process or team',exact:true}).press('ArrowDown');
 await page.getByRole('searchbox',{name:'Find a material, process or team',exact:true}).press('Enter');
 await page.getByRole('button',{name:'Clear focus',exact:true}).click();
 const downloadJSON=page.waitForEvent('download');await page.getByRole('button',{name:'JSON',exact:true}).click();const json=(await downloadJSON).suggestedFilename();
 const downloadSVG=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();const svg=(await downloadSVG).suggestedFilename();
 await page.getByLabel('Diagram topic').selectOption('overview');
 const sizes=[];for(const [name,width,height]of [['desktop',1440,900],['tablet',768,1024],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.locator('#canvas svg').waitFor();
  const rect=await page.locator('#canvas').boundingBox();
  assert(rect.width>100&&rect.height>100,'Canvas collapsed at '+name);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,'Reader overflow '+name);
  await page.screenshot({path:'.state/reader-'+name+'.png'});sizes.push({name,width,height,canvas:rect});
 }
 await page.setViewportSize({width:1440,height:900});
 
 assert(errors.length===0,errors.join('\n'));
 assert(!requests.some(url=>url.includes('/api/')),'Reader depends on API');
 return {no_public_editor:true,english_default:true,language_switch:true,guide:true,search_keyboard:true,downloads:{json,svg},sizes,errors,api_requests:0};
}
