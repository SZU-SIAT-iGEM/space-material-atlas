/* Canvas interaction stays local to the diagram; documents and panels scroll normally. */
window.AtlasViewport=(()=>{
  'use strict';
  const V=AtlasViewportCore,canvas=$('#canvas'),gesture=new V.Gesture();
  const coarse=matchMedia('(any-pointer: coarse)'),compact=matchMedia('(max-width:800px), (max-width:1000px) and (max-height:600px) and (orientation:landscape)'),nav=$('.nav'),tools=$('.canvas-tools');
  let previousRect=null,ignoreClickUntil=0,resizeFrame=0;
  const rect=()=>{const r=canvas.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
  const touch=()=>coarse.matches||navigator.maxTouchPoints>0;
  function fitScale(){
    if(!scene)return 1;
    const rs=Object.keys(visibility().nodes).map(k=>scene.geometry.nodes[k]).filter(Boolean),r=rect();
    if(!rs.length)return V.scale([0,0,1000,600],r);
    const left=Math.max(0,Math.min(...rs.map(n=>n.x))-40),top=Math.max(0,Math.min(...rs.map(n=>n.y))-10);
    return V.scale([left,top,Math.max(...rs.map(n=>n.x+n.w))+120-left,Math.max(...rs.map(n=>n.y+n.h))+220-top],r);
  }
  const limits=()=>({min:.12,max:Math.max(16,fitScale()*5)});
  function cameraChanged(){
    if(!svg||!rect().width)return;
    const current=V.scale(box,rect()),bounds=limits();
    $('#zoom-level').textContent=Math.round(100*fitScale()/current)+'%';
    $('#zoom-in').disabled=current<=bounds.min*1.001;
    $('#zoom-out').disabled=current>=bounds.max*.999;
    $('#toggle-detail').setAttribute('aria-expanded',String(!$('#graph-shell').classList.contains('closed')));
  }
  function normalize(destination){const r=rect();return r.width&&r.height?V.normalize(destination,r):destination;}
  function commit(destination){box=normalize(destination);camera();}
  function zoomBy(factor,point,animate=true){
    if(!svg)return;
    window.AtlasExperience?.cancelCamera();
    const r=rect(),p=point||{x:r.left+r.width/2,y:r.top+r.height/2};
    const next=V.anchored(box,r,p,p,factor,limits());
    if(animate)window.AtlasExperience.moveCamera(next);else commit(next);
  }
  function capturePointers(){for(const id of gesture.points.keys())try{if(!canvas.hasPointerCapture(id))canvas.setPointerCapture(id);}catch{}}
  function releasePointer(id){try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}}
  function cancelGesture(){
    const ids=[...gesture.points.keys()];if(gesture.moved)ignoreClickUntil=performance.now()+450;
    gesture.cancel();drag=null;canvas.classList.remove('is-dragging');ids.forEach(releasePointer);
  }
  canvas.addEventListener('pointerdown',event=>{
    if((event.pointerType==='mouse'&&event.button!==0)||!svg)return;
    window.AtlasExperience?.cancelCamera();
    if(!gesture.points.size){ignoreClickUntil=0;previousRect=rect();}
    gesture.begin(event.pointerId,event.clientX,event.clientY,event.pointerType,box,rect());
    drag={};
    // Capture only after movement. A light tap retains its actual SVG target.
    if(gesture.points.size>1){capturePointers();canvas.classList.add('is-dragging');}
  });
  window.addEventListener('pointermove',event=>{
    if(!gesture.points.has(event.pointerId))return;
    if(event.pointerType==='mouse'&&event.buttons===0){cancelGesture();return;}
    const next=gesture.move(event.pointerId,event.clientX,event.clientY,limits());
    if(!next)return;
    if(event.cancelable)event.preventDefault();capturePointers();canvas.classList.add('is-dragging');commit(next);
  },{passive:false});
  window.addEventListener('pointerup',event=>{
    if(!gesture.points.has(event.pointerId))return;
    const state=gesture.end(event.pointerId,box,rect());
    if(state.moved)ignoreClickUntil=performance.now()+450;
    releasePointer(event.pointerId);
    if(!state.active){drag=null;canvas.classList.remove('is-dragging');}
  });
  window.addEventListener('pointercancel',event=>{if(gesture.points.has(event.pointerId))cancelGesture();});
  canvas.addEventListener('lostpointercapture',event=>{
    // Touch starts with implicit capture on the SVG target. Its bubbled loss is
    // expected when an actual drag transfers capture to the canvas.
    if(event.target===canvas&&gesture.points.has(event.pointerId)&&!canvas.hasPointerCapture(event.pointerId))cancelGesture();
  });
  window.addEventListener('blur',cancelGesture);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
  canvas.addEventListener('click',event=>{
    if(event.detail!==0&&performance.now()<ignoreClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  canvas.addEventListener('wheel',event=>{
    if(embedded&&!event.ctrlKey&&!event.metaKey)return;
    if(!svg)return;event.preventDefault();cancelGesture();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect().height:1);
    zoomBy(Math.exp(Math.max(-.3,Math.min(.3,delta*(event.ctrlKey ? .008 : .0015)))),{x:event.clientX,y:event.clientY},false);
  },{passive:false});
  canvas.addEventListener('dragstart',event=>event.preventDefault());
  $('#zoom-in').addEventListener('click',()=>zoomBy(1/1.4));
  $('#zoom-out').addEventListener('click',()=>zoomBy(1.4));
  $('#reset-view').addEventListener('click',()=>{cancelGesture();fit(true);});
  function resized(){
    const next=rect();if(!next.width||!next.height)return;
    if(previousRect&&(Math.abs(previousRect.width-next.width)>.5||Math.abs(previousRect.height-next.height)>.5)){
      cancelGesture();window.AtlasExperience?.cancelCamera();
      box=V.resize(box,previousRect,next);camera();
    }
    previousRect=next;cameraChanged();positionMenus();
  }
  function restoreView(saved,oldRect){
    cancelGesture();window.AtlasExperience?.cancelCamera();previousRect=rect();
    commit(oldRect?V.resize(saved,oldRect,previousRect):saved);
  }
  function ensureNodeVisible(id){
    resized();const node=scene?.geometry.nodes[id];if(!node)return;
    const cx=node.x+40+node.w/2,cy=node.y+140+node.h/2,margin=24*V.scale(box,rect());
    const left=cx-node.w/2-margin,right=cx+node.w/2+margin,top=cy-node.h/2-margin,bottom=cy+node.h/2+margin;
    let [x,y,w,h]=box;
    if(right-left>w||left<x||right>x+w)x=cx-w/2;
    if(bottom-top>h||top<y||bottom>y+h)y=cy-h/2;
    if(x!==box[0]||y!==box[1])window.AtlasExperience.moveCamera([x,y,w,h]);
  }
  function sceneChanged(){cancelGesture();previousRect=rect();if(!picked)fit();else{box=normalize(box);svg?.setAttribute('viewBox',box.join(' '));cameraChanged();}}
  function setTools(expanded){tools.classList.toggle('is-expanded',expanded);$('#more-tools').setAttribute('aria-expanded',String(expanded));positionMenus();}
  function setNav(expanded){nav.classList.toggle('is-expanded',expanded);$('#nav-toggle').setAttribute('aria-expanded',String(expanded));}
  function visibleViewport(){const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};}
  function positionMenus(){
    const menu=$('.team-menu'),picker=$('.team-picker'),v=visibleViewport();
    if(picker.open){
      const r=picker.getBoundingClientRect(),width=Math.min(320,v.width-24);
      Object.assign(menu.style,{position:'fixed',width:width+'px',left:Math.max(v.left+12,Math.min(r.left,v.left+v.width-width-12))+'px',top:(r.bottom+6)+'px',maxHeight:Math.max(80,v.top+v.height-r.bottom-18)+'px'});
    }
    if(tools.classList.contains('is-expanded')){const r=$('#more-tools').getBoundingClientRect();tools.style.maxHeight=Math.max(90,v.top+v.height-r.bottom-16)+'px';}
  }
  function languageChanged(){
    const labels={'zoom-in':L('放大图谱','Zoom in'),'zoom-out':L('缩小图谱','Zoom out'),'zoom-level':L('当前缩放比例，相对于全景','Current zoom relative to fit'),'reset-view':L('显示全图','Fit diagram'),'nav-toggle':L('导航菜单','Navigation menu'),'more-tools':L('更多工具','More tools')};
    for(const [id,label] of Object.entries(labels)){const el=$('#'+id);el.setAttribute('aria-label',label);el.title=label;}
    $('#reset-view').textContent=L('全景','Fit');$('#more-tools').textContent=L('更多','More');$('#nav-toggle').textContent=L('菜单','Menu');
    $('#guide-start').setAttribute('aria-label',L('使用指引','Quick guide'));
    $('#graph-hint').textContent=touch()?L('单指拖动 · 双指缩放 · 点选节点或连线查看介绍','Drag with one finger · Pinch to zoom · Tap nodes or links for details'):embedded?L('Ctrl / ⌘ + 滚轮缩放 · 拖动平移 · 点选查看介绍','Ctrl / ⌘ + wheel to zoom · Drag to pan · Select for details'):L('滚轮缩放 · 拖动平移 · 点选节点或连线查看介绍','Wheel to zoom · Drag to pan · Select nodes or links for details');
    $('.viewport-controls').setAttribute('aria-label',L('缩放与浏览','Zoom and navigation'));
    canvas.setAttribute('aria-description',L('方向键平移，加减键缩放。触屏可单指拖动、双指缩放。','Arrow keys pan; plus and minus zoom. Touch supports one-finger panning and pinch zoom.'));
    cameraChanged();
  }
  $('#nav-toggle').addEventListener('click',()=>{setTools(false);$('.team-picker').open=false;setNav(!nav.classList.contains('is-expanded'));});
  $('#more-tools').addEventListener('click',()=>{setNav(false);$('.team-picker').open=false;setTools(!tools.classList.contains('is-expanded'));});
  $('.team-picker').addEventListener('toggle',()=>{if($('.team-picker').open){setTools(false);setNav(false);}positionMenus();});
  document.addEventListener('click',event=>{
    if(event.target.closest('#atlas-guide'))return;
    if(!event.target.closest('.canvas-tools,#more-tools'))setTools(false);
    if(!event.target.closest('.team-picker'))$('.team-picker').open=false;
    if(!event.target.closest('.nav,#nav-toggle')||event.target.closest('[data-page]'))setNav(false);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){setTools(false);setNav(false);$('.team-picker').open=false;}});
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resized);});observer.observe(canvas);
  const panelObserver=new MutationObserver(cameraChanged);panelObserver.observe($('#graph-shell'),{attributes:true,attributeFilter:['class']});
  window.visualViewport?.addEventListener('resize',positionMenus);window.visualViewport?.addEventListener('scroll',positionMenus);
  window.addEventListener('resize',()=>{positionMenus();if(innerWidth>1000)setNav(false);if(!compact.matches)setTools(false);});
  coarse.addEventListener('change',languageChanged);
  previousRect=rect();languageChanged();if(svg)commit(box);
  return {ensureNodeVisible,syncLayout:resized,normalize,cameraChanged,sceneChanged,restoreView,zoomBy,cancelGesture,languageChanged,visibleViewport,setTools,rect,touch};
})();
