async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const assert=(condition,message)=>{if(!condition)throw Error(message)};
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:8765');
 await page.getByRole('button',{name:'Nanjing-China 2024 · Routes available · 2024-5034',exact:true}).click();
 await page.getByRole('button',{name:'Review & apply',exact:true}).waitFor();
 const before=await page.locator('#raw').inputValue();
 const description=page.getByRole('textbox',{name:'Description · English description_en',exact:true});
 const old=await description.inputValue();await description.fill(old+' QA draft text.');
 const edited=await page.locator('#raw').inputValue();
 await page.getByLabel('Interface language').selectOption('zh');
 await page.getByRole('button',{name:'检查并应用',exact:true}).waitFor();
 assert(await page.locator('#raw').inputValue()===edited,'Language switch lost edited content');
 await page.getByLabel('Interface language').selectOption('en');
 await page.getByRole('button',{name:'Review & apply',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert((await page.locator('#diff').textContent()).includes('QA draft text.'),'Missing review diff');
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 await page.waitForFunction(expected=>document.querySelector('#raw').value===expected,before);
 assert(await page.locator('#raw').inputValue()===before,'Discard changed source data');
 const sizes=[['desktop',1440,900],['tablet',768,1024],['landscape',844,390],['portrait',390,844]];
 const results=[];
 for(const [name,width,height]of sizes){await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
  assert(dimensions.width<=width,`Horizontal overflow: ${name}`);
  await page.screenshot({path:'.state/studio-'+name+'-en.png'});results.push({name,...dimensions});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:'03 Import & review'}).click();
 assert(await page.getByRole('button',{name:'Review import',exact:true}).isVisible(),'Import page missing');
 await page.getByRole('button',{name:'04 Versions & releases'}).click();
 await page.getByRole('button',{name:'Validate & release',exact:true}).waitFor();
 return {language_preserves_draft:true,diff:true,discard:true,sizes:results,errors};
}
