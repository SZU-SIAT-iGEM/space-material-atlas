async page => {
 const assert=(v,m)=>{if(!v)throw Error(m)},results=[];
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
 for(const port of [8791,8790]){
  await page.goto(`http://127.0.0.1:${port}/atlas.html?mode=display&guide=0&lang=en&view=water&focus=wrs`);
  await page.locator('.node.picked').waitFor();
  if(await page.locator('#motion-toggle').getAttribute('aria-pressed')==='true')await page.locator('#motion-toggle').click();
  await page.waitForFunction(()=>!document.querySelector('#route-play').disabled);
  await page.locator('#route-play').click();await page.locator('[data-motion-layer]').first().waitFor();
  assert(await page.locator('#flow-note').isVisible(),'Flow explanation missing');
  await page.locator('#motion-toggle').click();
  assert(await page.locator('[data-motion-layer]').count()===0,'Pause did not stop flow');
  assert(await page.locator('#motion-toggle').getAttribute('aria-pressed')==='true','Pause state wrong');
  // Use reduced motion for exact camera checks, after checking live animations.
  await page.emulateMedia({reducedMotion:'reduce'});
  const before=await page.locator('#canvas svg').getAttribute('viewBox');
  await page.locator('#zoom-in').click();
  const zoomed=await page.locator('#canvas svg').getAttribute('viewBox');assert(zoomed!==before,'Zoom in failed');
  await page.locator('#zoom-out').click();
  const canvas=await page.locator('#canvas').boundingBox();
  const panBefore=await page.locator('#canvas svg').getAttribute('viewBox');
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width/2+70,canvas.y+canvas.height/2+35,{steps:5});await page.mouse.up();
  assert((await page.locator('#canvas svg').getAttribute('viewBox'))!==panBefore,'Mouse pan failed');
  await page.locator('#reset-view').click();
  await page.locator('#canvas').focus();
  const keyBefore=await page.locator('#canvas svg').getAttribute('viewBox');await page.keyboard.press('ArrowRight');
  assert((await page.locator('#canvas svg').getAttribute('viewBox'))!==keyBefore,'Keyboard pan failed');
  await page.locator('#reset-view').click();
  await page.locator('#canvas .edge').filter({visible:true}).first().click({force:true});
  assert((await page.locator('#detail').innerText()).length>50,'Edge detail missing');
  await page.locator('#toggle-detail').click();assert(await page.locator('#graph-shell').evaluate(e=>e.classList.contains('closed')),'Detail close failed');
  await page.locator('#toggle-detail').click();
  results.push({port,animation:true,pause:true,zoom:true,mousePan:true,keyboardPan:true,fit:true,edgeDetails:true});
  await page.emulateMedia({reducedMotion:'no-preference'});
 }
 return results;
}
