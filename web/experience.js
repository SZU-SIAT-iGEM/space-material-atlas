/* Reading and editing have separate, versioned first-use guides.
   This layer changes presentation only; it never writes project data. */
window.AtlasExperience = (() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const memory = new Set();
  const keys = {reading:'space-atlas-reading-guide-v1', editor:'space-atlas-editor-guide-v1', motion:'space-atlas-motion-paused'};
  const read = key => { try { return localStorage.getItem(key); } catch { return memory.has(key) ? '1' : null; } };
  const write = (key,value) => { if(value==='1')memory.add(key);else memory.delete(key);try {localStorage.setItem(key,value);}catch{ /* The current visit still works. */ } };
  let userPaused = read(keys.motion)==='1', cameraFrame=0, cameraDestination=null, cameraDone=null;
  let flowFrame=0, flowTimer=0, guide=null, guideEpoch=0, restoring=false, detailAnimation=null;
  const modal=$('#atlas-guide'), card=modal.querySelector('.guide-card'), spot=$('#guide-spotlight');
  const reduced=()=>userPaused||media.matches;
  const compact=()=>matchMedia('(max-width:800px), (max-width:1000px) and (max-height:600px) and (orientation:landscape)').matches;
  const screen=()=>window.AtlasViewport?.visibleViewport()||{left:0,top:0,width:innerWidth,height:innerHeight};

  function cancelCamera(finish=false) {
    cancelAnimationFrame(cameraFrame); cameraFrame=0;
    if(finish&&cameraDestination&&svg){box=[...cameraDestination];svg.setAttribute('viewBox',box.join(' '));window.AtlasViewport?.cameraChanged();}
    cameraDestination=null;
    if(cameraDone){cameraDone();cameraDone=null;}
  }
  function moveCamera(destination) {
    cancelCamera();
    if(!svg)return Promise.resolve();
    window.AtlasViewport?.syncLayout();
    destination=window.AtlasViewport?.normalize(destination)||destination;
    if(reduced()||restoring){box=[...destination];svg.setAttribute('viewBox',box.join(' '));window.AtlasViewport?.cameraChanged();return Promise.resolve();}
    const from=[...box], start=performance.now(), targetSVG=svg;
    cameraDestination=destination;
    return new Promise(resolve=>{
      cameraDone=resolve;
      const frame=now=>{
        if(svg!==targetSVG){cancelCamera();return;}
        const t=Math.min(1,(now-start)/380),ease=1-Math.pow(1-t,3);
        box=from.map((x,i)=>x+(destination[i]-x)*ease);
        targetSVG.setAttribute('viewBox',box.join(' '));
        window.AtlasViewport?.cameraChanged();
        if(guide)positionGuide();
        if(t<1)cameraFrame=requestAnimationFrame(frame);else cancelCamera(true);
      };
      cameraFrame=requestAnimationFrame(frame);
    });
  }
  function stopFlow() {
    cancelAnimationFrame(flowFrame);clearTimeout(flowTimer);flowFrame=0;
    document.querySelectorAll('[data-motion-layer]').forEach(n=>n.remove());
    $('#flow-note').hidden=true;
  }
  function materialLinks() {
    if(!svg||picked?.kind!=='node')return [];
    return [...svg.querySelectorAll('.edge.related[data-category="material"]')]
      .filter(e=>e.style.display!=='none').slice(0,8)
      .map(e=>e.querySelector('polyline:not(.crossing-clearance)')).filter(Boolean);
  }
  function flowAvailable() {
    $('#route-play').disabled=reduced()||!materialLinks().length;
    $('#route-play').title=reduced()?L('动态已暂停','Motion is paused'):L('选中节点后，播放它相邻的物质连线','Select a node to trace its adjacent material links');
  }
  function playFlow(manual=false) {
    stopFlow();flowAvailable();
    if(reduced()||restoring||pageName!=='graph')return;
    const paths=materialLinks();if(!paths.length)return;
    const NS='http://www.w3.org/2000/svg';
    const dots=paths.map(path=>{
      const group=document.createElementNS(NS,'g');group.setAttribute('data-motion-layer','');group.setAttribute('aria-hidden','true');group.style.pointerEvents='none';
      const dot=document.createElementNS(NS,'circle');dot.setAttribute('class','route-signal');dot.setAttribute('r','5');dot.setAttribute('fill','#f8a621');dot.setAttribute('stroke','#f9fcfa');dot.setAttribute('stroke-width','2');group.append(dot);path.parentElement.append(group);
      return {path,dot,length:path.getTotalLength()};
    });
    $('#flow-note').textContent=L('方向示意 · 动画速度不表示流量','Direction only · Animation speed does not represent flow rate');
    $('#flow-note').hidden=false;
    const start=performance.now(),delay=manual?0:250,duration=2200;
    const frame=now=>{
      const progress=Math.max(0,Math.min(1,(now-start-delay)/duration));
      for(const {path,dot,length} of dots){const point=path.getPointAtLength(progress*length);dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);dot.style.opacity=progress>=1?'0':'1';}
      if(progress<1)flowFrame=requestAnimationFrame(frame);else {flowFrame=0;flowTimer=setTimeout(stopFlow,450);}
    };
    flowFrame=requestAnimationFrame(frame);
  }
  function selectionChanged() { flowAvailable();playFlow(); }
  function detailReady() {
    detailAnimation?.cancel();
    if(!reduced()&&!restoring)detailAnimation=$('#detail').animate([{opacity:.8},{opacity:1}],{duration:160,easing:'ease-out'});
  }
  function graphReady() {
    if(!svg)return;
    svg.setAttribute('role','group');svg.setAttribute('aria-label',tx(names[view]));
    svg.querySelectorAll('.node').forEach(node=>{
      node.setAttribute('tabindex','0');node.setAttribute('role','button');
      node.setAttribute('aria-label',tx(scene.model.nodes[node.dataset.node]?.label||node.dataset.node));
      if(node.parentElement.tagName.toLowerCase()==='a')node.parentElement.setAttribute('tabindex','-1');
    });
    if(!reduced()&&!restoring)svg.classList.add('scene-arrive');
    if(compact()&&!picked&&!guide)$('#graph-shell').classList.add('closed');
    flowAvailable();positionSearch();window.AtlasViewport?.sceneChanged();
  }
  function languageChanged() {
    $('#motion-toggle').textContent=media.matches?L('静态模式','Static mode'):userPaused?L('▷ 开启动画','▷ Enable motion'):L('Ⅱ 暂停动画','Ⅱ Pause motion');
    $('#motion-toggle').setAttribute('aria-pressed',String(reduced()));
    $('#motion-toggle').disabled=media.matches;
    $('#motion-toggle').title=media.matches?L('跟随系统的减少动态设置','Following the system reduced-motion preference'):L('记住本浏览器的动画偏好','Remember this browser’s motion preference');
    document.body.classList.toggle('motion-paused',reduced());
    $('#node-search').setAttribute('aria-label',L('查找物质、工艺或队伍','Find a material, process or team'));
    $('#view').setAttribute('aria-label',L('图谱主题','Diagram topic'));
    $('#lang').setAttribute('aria-label',L('语言','Language'));
    $('.nav').setAttribute('aria-label',L('主导航','Main navigation'));
    $('#canvas').setAttribute('aria-label',L('物质循环图谱','Material flow diagram'));
    flowAvailable();
    window.AtlasViewport?.languageChanged();
    if(guide)renderGuide();
  }
  function positionSearch(){
    const input=$('#node-search').getBoundingClientRect(),results=$('#node-results'),v=screen();
    const width=Math.min(360,v.width-24),below=v.top+v.height-input.bottom-20,above=input.top-v.top-20;
    const upward=below<140&&above>below,available=Math.max(60,Math.min(320,upward?above:below));
    results.style.width=width+'px';results.style.maxHeight=available+'px';
    results.style.left=Math.max(v.left+12,Math.min(input.left,v.left+v.width-width-12))+'px';
    results.style.top=(upward?Math.max(v.top+8,input.top-Math.min(results.scrollHeight,available)-8):input.bottom+8)+'px';
  }

  const readingSteps=[
    {target:'#view',title:['总图与主题分图','Overview and topic diagrams'],text:['左上角菜单用于切换总图和主题分图。总图展示系统之间的关系；水、空气、食物等分图展示对应主题的物质与工艺。','The topic menu switches between the overview and individual diagrams. The overview shows relationships between systems; topic diagrams show the materials and processes within each area.'],tip:['阅读指引共六步，可随时关闭；工具栏中的“使用指引”可再次打开。','This six-step reading guide can be closed at any point and reopened with Quick guide.']},
    {target:'.node.picked',title:['节点与连接','Nodes and connections'],text:['触屏支持单指拖动、双指缩放；鼠标支持拖动和滚轮缩放。点选节点后，相关连接会突出显示，介绍面板显示节点说明；节点过小时，画面会适当放大。当前示例为水回收系统。','On touchscreens, one finger pans and two fingers zoom. A mouse supports dragging and wheel zoom. Selecting a node highlights its connections and opens the details panel. Small nodes are enlarged for reading. The example is the water recovery system.'],tip:['画布右下角的加减按钮调整倍率，“全景”显示整图；“取消聚焦”清除当前选择。','The + and − controls adjust zoom; Fit shows the whole diagram. Clear focus removes the current selection.'],prepare:async()=>{selected=new Set();teamScope=null;picked=null;ground=false;$('#ground').checked=false;view='water';await showGraph('wrs');if(compact())$('#graph-shell').classList.add('closed');}},
    {target:'#node-search',title:['名称检索','Search by name'],text:['搜索框支持物质、工艺和队伍名称。点选搜索结果后，视图定位到对应节点；当前分图不包含该节点时，自动切换主题。','Search accepts material, process and team names. Selecting a result locates the corresponding node and switches topic if the node is absent from the current diagram.'],tip:['检索示例：可用水、水回收系统、SZU-SIAT。','Example queries: water, water recovery, SZU-SIAT.']},
    {target:'.team-picker',title:['队伍路线','Team routes'],text:['“队伍开关”用于逐队显示或隐藏项目路线，“全部队伍”显示所有已收录路线。当前示例为 SZU-SIAT China 的生物反应器相关连接。','The Teams menu shows or hides individual project routes. All teams displays every included route. The example shows SZU-SIAT China’s connections in the bioreactor diagram.'],tip:['队伍开关只改变显示范围，不重新排列节点。','Team toggles change visibility without rearranging nodes.'],prepare:async()=>{selected=new Set(['2026-6100']);teamScope=null;picked=null;view='bioreactor';await showGraph(teamCore('2026-6100'));if(compact())$('#graph-shell').classList.add('closed');}},
    {target:'#detail .source-link',title:['介绍、来源与标记','Descriptions, sources and labels'],text:['介绍面板列出节点说明、上下游联系及资料来源。点选连线可查看关系说明。Future 标记表示项目设想中的太空应用，不代表已完成在轨验证。','The details panel lists descriptions, connected nodes and sources. Selecting a connection opens its explanation. Future denotes a proposed space application, not completed in-orbit validation.'],tip:['“联系修改”提供资料补充和更正的联系地址。','Corrections provides a contact address for additions and corrections.'],prepare:()=>{$('#graph-shell').classList.remove('closed');$('#detail .source-link')?.scrollIntoView({block:'center',behavior:'instant'});}},
    {target:'.canvas-tools',title:['动画与导出','Motion and export'],text:['“连线动画”显示所选节点相邻物质流的方向，动画速度不表示流量。“暂停动画”停止动态效果。SVG 导出当前图形，JSON 导出图谱数据。','Trace links indicates the direction of material flow adjacent to the selected node; its speed does not represent flow rate. Pause motion stops motion effects. SVG exports the diagram; JSON exports the atlas data.'],tip:['关闭后恢复原来的视图和队伍选择。动画偏好保存在当前浏览器。','Closing the guide restores the previous view and team selection. The motion preference is saved in this browser.'],prepare:async()=>{await readingSteps[1].prepare();}}
  ];
  const editorSteps=[
    {target:'.editor-form fieldset:nth-of-type(1) legend',title:['队伍与项目信息','Team and project details'],text:['表单用于填写队伍信息、所属主题和项目介绍。“导入已有资料”可载入队伍 JSON，继续修改其中的内容。','The form records team details, topics and the project description. Import a bundle loads a team JSON file for further editing.'],tip:['编辑指引仅在编辑页面触发，不改变表单内容。','The editing guide appears only in the editor and does not change form values.']},
    {target:'[data-add-node]',title:['路线与节点','Routes and nodes'],text:['一个项目可以包含多条路线。新增节点用于记录图谱尚未收录的工艺、物质或状态；已有节点可在填写连接时直接选用。','A project may contain several routes. New nodes describe processes, materials or states absent from the atlas. Existing nodes can be reused when defining connections.'],tip:['示范路线应单独标记，与平台的通用作用分开描述。','Demonstration routes are marked separately from the platform’s general role.']},
    {target:'[data-add-edge]',title:['连接与分支','Connections and branches'],text:['每条连接包含上游节点、下游节点、联系类型和说明。同一节点可以连接多个下游；工艺改良关系指向被改良的工艺。','Each connection specifies an upstream node, a downstream node, a type and a description. A node may connect to multiple downstream nodes. Improvement links point to the affected process.'],tip:['端点输入框支持按名称选择已有节点和本队新增步骤。','Endpoint fields search both existing atlas nodes and new team steps by name.']},
    {target:'[data-add-source]',title:['项目来源','Project sources'],text:['来源记录包含资料标题、原始链接和内容说明。每条连接可选择对应来源；中英文描述分别填写。','Source records contain a title, original link and description. Each connection can reference a source. Chinese and English descriptions are entered separately.'],tip:['项目设想、已完成工作和待验证内容应分别说明。','Proposals, completed work and unverified claims should be identified separately.']},
    {target:'.save-bar',title:['预览、保存与导出','Preview, save and export'],text:['“预览路线”检查当前连接。“保存到本机图谱”仅更新当前浏览器；“导出队伍资料”生成可再次编辑的 JSON，“导出队伍描述”生成图形与文字资料包。','Preview route displays the current connections. Save to local atlas updates this browser only. Export team bundle creates editable JSON; Export team description creates a package of diagrams and text.'],tip:['本机保存不会自动发布到公共图谱。','Local saving does not publish changes to the shared atlas.']}
  ];
  function snapshot(){return {view,selected:[...selected],ground,teamScope,picked:C.clone(picked),box:[...box],viewport:window.AtlasViewport?.rect(),tools:$('.canvas-tools').classList.contains('is-expanded'),closed:$('#graph-shell').classList.contains('closed'),detail:$('#detail').innerHTML,detailScroll:$('#detail').scrollTop,scroll:scrollY,focus:document.activeElement};}
  async function startGuide(kind){
    if(guide||(kind==='editor'&&(readOnly||pageName!=='contribute'))||(kind==='reading'&&pageName!=='graph'))return;
    stopFlow();cancelCamera(true);window.AtlasViewport?.cancelGesture();$('.team-picker').open=false;$('#node-results').hidden=true;
    guide={kind,index:0,saved:snapshot(),busy:false};guideEpoch++;
    if(document.activeElement?.matches('input,textarea,select'))document.activeElement.blur();
    window.AtlasViewport?.setTools(false);
    modal.showModal();await showStep(0);
  }
  function renderGuide(){
    if(!guide)return;
    const steps=guide.kind==='reading'?readingSteps:editorSteps,step=steps[guide.index],choose=x=>x[lang==='zh'?0:1];
    modal.dataset.guide=guide.kind;
    $('#guide-kind').textContent=guide.kind==='reading'?L('首次使用 · 阅读图谱','FIRST VISIT · READING'):L('编辑指引 · 填写路线','EDITOR · CONTRIBUTING');
    $('#guide-number').textContent=String(guide.index+1).padStart(2,'0');
    $('#guide-title').textContent=choose(step.title);$('#guide-description').textContent=choose(step.text);$('#guide-tip').textContent=choose(step.tip);
    if(embedded&&guide.kind==='reading'&&guide.index===1)$('#guide-tip').textContent=L('嵌入图谱使用 Ctrl / ⌘ + 滚轮缩放；普通滚轮用于滚动外层网页。加减按钮和双指缩放同样可用。','In embedded diagrams, Ctrl / ⌘ + wheel zooms; the wheel alone scrolls the surrounding page. The + / − controls and pinch zoom remain available.');
    $('#guide-close').setAttribute('aria-label',L('关闭指引','Close guide'));
    $('#guide-skip').textContent=L('跳过指引','Skip guide');$('#guide-prev').textContent=L('上一步','Back');
    $('#guide-next').textContent=guide.index===steps.length-1?L('完成指引','Finish'):L('下一步 →','Next →');
    if(guide.kind==='editor'&&guide.index===steps.length-1)$('#guide-next').textContent=L('继续编辑','Continue editing');
    $('#guide-prev').hidden=guide.index===0;$('#guide-prev').disabled=guide.busy;$('#guide-next').disabled=guide.busy;
    $('#guide-progress').innerHTML=steps.map((_,i)=>`<span class="${i===guide.index?'current':i<guide.index?'done':''}"></span>`).join('');
    $('#guide-progress').setAttribute('aria-label',L(`第 ${guide.index+1} 步，共 ${steps.length} 步`,`Step ${guide.index+1} of ${steps.length}`));
  }
  async function showStep(index){
    if(!guide||guide.busy)return;
    const epoch=++guideEpoch;guide.index=index;guide.busy=true;renderGuide();positionGuide();
    try{
      const steps=guide.kind==='reading'?readingSteps:editorSteps,step=steps[index];
      // Returning to a prior reading step also restores its prerequisite scene.
      if(guide.kind==='reading'&&index===2)await readingSteps[1].prepare();
      if(guide.kind==='reading'&&index===4)await readingSteps[3].prepare();
      if(step.prepare)await step.prepare();
      if(!guide||guideEpoch!==epoch)return;
      if(guide.kind==='editor'){
        document.querySelector(step.target)?.scrollIntoView({block:compact()?'start':'center',behavior:'instant'});
        if(compact())window.scrollBy({top:-18,behavior:'instant'});
      }
      if(guide.kind==='reading'&&index!==4&&compact())$('#graph-shell').classList.add('closed');
      window.AtlasViewport?.setTools(guide.kind==='reading'&&index===5);
    }catch(error){toast(L('这一步的示例未能展开，仍可继续阅读指引。','This example could not be opened. You can continue the guide.'));console.warn(error);}
    if(!guide||guideEpoch!==epoch)return;
    guide.busy=false;renderGuide();positionGuide();$('#guide-title').focus({preventScroll:true});
  }
  function positionGuide(){
    if(!guide)return;
    const step=(guide.kind==='reading'?readingSteps:editorSteps)[guide.index],v=screen(),bottomEdge=v.top+v.height,rightEdge=v.left+v.width;
    card.style.maxHeight=Math.max(100,v.height-28)+'px';
    const target=document.querySelector(step.target),raw=target?.getBoundingClientRect();
    let rect=raw&&raw.width&&raw.height?{left:raw.left,top:raw.top,right:raw.right,bottom:raw.bottom}: {left:16,top:16,right:rightEdge-16,bottom:90};
    if(target?.classList.contains('node')){const bounds=$('#canvas').getBoundingClientRect();rect={left:Math.max(rect.left,bounds.left),top:Math.max(rect.top,bounds.top),right:Math.min(rect.right,bounds.right),bottom:Math.min(rect.bottom,bounds.bottom)};}
    const x=Math.max(v.left+8,rect.left-6),y=Math.max(v.top+8,rect.top-6),right=Math.min(rightEdge-8,rect.right+6),bottom=Math.min(bottomEdge-8,rect.bottom+6);
    Object.assign(spot.style,{left:x+'px',top:y+'px',width:Math.max(20,right-x)+'px',height:Math.max(20,bottom-y)+'px',right:'auto',bottom:'auto'});
    const width=card.offsetWidth,height=card.offsetHeight,pad=14;
    let cx=Math.min(rightEdge-width-pad,Math.max(pad,rect.left)),cy=rect.bottom+18;
    if(innerWidth>800){
      if(guide.kind==='editor'){cx=rightEdge-width-30;cy=Math.min(bottomEdge-height-24,Math.max(100,rect.top));}
      else if(step.target.startsWith('#detail')||step.target==='.node.picked'){cx=24;cy=bottomEdge-height-24;}
    }
    if(cy+height>bottomEdge-pad)cy=rect.top-height-18;
    if(cy<pad)cy=bottomEdge-height-pad;
    if(compact()&&step.target.startsWith('#detail'))cy=v.top+pad;
    cx=Math.max(v.left+pad,Math.min(cx,rightEdge-width-pad));cy=Math.max(v.top+pad,Math.min(cy,bottomEdge-height-pad));
    Object.assign(card.style,{left:cx+'px',top:cy+'px'});
  }
  async function closeGuide(){
    if(!guide)return;
    const {kind,saved}=guide;guide=null;guideEpoch++;write(keys[kind],'1');
    modal.close();stopFlow();cancelCamera();restoring=true;
    try{
      if(kind==='reading'){
        view=saved.view;selected=new Set(saved.selected);ground=saved.ground;teamScope=saved.teamScope;picked=saved.picked;$('#ground').checked=ground;
        await showGraph();
        $('#detail').innerHTML=saved.detail;$('#detail').scrollTop=saved.detailScroll;
        $('#graph-shell').classList.toggle('closed',saved.closed);
        window.AtlasViewport?.setTools(saved.tools);
        if(window.AtlasViewport)window.AtlasViewport.restoreView(saved.box,saved.viewport);else{box=saved.box;camera();}
        if(picked?.kind==='node'){highlightOne(picked.id);[...svg.querySelectorAll('.node')].find(n=>n.dataset.node===picked.id)?.classList.add('picked');}
      }else window.scrollTo({top:saved.scroll,behavior:'instant'});
    }finally{restoring=false;flowAvailable();const focus=saved.focus?.isConnected?saved.focus:kind==='editor'?$('[data-start-editor]'):$('#guide-start');if(!focus?.matches('input,textarea,select'))focus?.focus({preventScroll:true});}
  }
  function editorEntered(){
    if(!readOnly&&!read(keys.editor))setTimeout(()=>{if(pageName==='contribute'&&!guide&&!read(keys.editor))startGuide('editor');},180);
  }
  $('#guide-start').addEventListener('click',()=>startGuide('reading'));
  $('#guide-next').addEventListener('click',()=>{if(!guide)return;const steps=guide.kind==='reading'?readingSteps:editorSteps;if(guide.index===steps.length-1)closeGuide();else showStep(guide.index+1);});
  $('#guide-prev').addEventListener('click',()=>{if(guide)showStep(guide.index-1);});
  $('#guide-skip').addEventListener('click',closeGuide);$('#guide-close').addEventListener('click',closeGuide);
  modal.addEventListener('cancel',event=>{event.preventDefault();closeGuide();});
  modal.addEventListener('keydown',event=>{if(event.key==='ArrowRight'&&!guide?.busy){event.preventDefault();$('#guide-next').click();}if(event.key==='ArrowLeft'&&guide?.index&&!guide.busy){event.preventDefault();$('#guide-prev').click();}});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-start-reading]'))startGuide('reading');
    if(event.target.closest('[data-start-editor]'))startGuide('editor');
    if(!event.target.closest('#node-search,#node-results'))$('#node-results').hidden=true;
  });
  $('#route-play').addEventListener('click',()=>playFlow(true));
  $('#motion-toggle').addEventListener('click',()=>{userPaused=!userPaused;write(keys.motion,userPaused?'1':'0');if(reduced()){cancelCamera(true);stopFlow();detailAnimation?.finish();}languageChanged();});
  media.addEventListener('change',()=>{if(reduced()){cancelCamera(true);stopFlow();detailAnimation?.finish();}languageChanged();});
  $('#canvas').addEventListener('keydown',event=>{
    const node=event.target.closest('.node');
    if(node&&['Enter',' '].includes(event.key)){event.preventDefault();focusNode(node.dataset.node,false);return;}
    if(event.key==='Escape'){event.preventDefault();resetFocus();flowAvailable();return;}
    if(event.target!==$('#canvas'))return;
    const [x,y,w,h]=box;
    const directions={ArrowLeft:[x-w*.15,y,w,h],ArrowRight:[x+w*.15,y,w,h],ArrowUp:[x,y-h*.15,w,h],ArrowDown:[x,y+h*.15,w,h]};
    if(directions[event.key]){event.preventDefault();moveCamera(directions[event.key]);}
    if(['+','=','-'].includes(event.key)){event.preventDefault();window.AtlasViewport?.zoomBy(event.key==='-'?1.2:1/1.2);}
  });
  $('#node-search').addEventListener('keydown',event=>{
    if(event.isComposing||event.keyCode===229)return;
    const results=$('#node-results');
    if(event.key==='Escape'){results.hidden=true;event.preventDefault();return;}
    if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
    if(results.hidden)searchNodes(event.currentTarget.value);
    if(results.hidden)return;
    const buttons=[...results.querySelectorAll('[data-search-node]')];
    if(!buttons.length)return;
    event.preventDefault();
    if(event.key==='Enter')buttons[0].click();
    else buttons[event.key==='ArrowUp'?buttons.length-1:0].focus({preventScroll:true});
    if(event.key!=='Enter')document.activeElement.scrollIntoView({block:'nearest'});
  });
  $('#node-results').addEventListener('keydown',event=>{
    if(event.isComposing||event.keyCode===229)return;
    const results=event.currentTarget;
    if(event.key==='Escape'){event.preventDefault();results.hidden=true;$('#node-search').focus({preventScroll:true});return;}
    if(!['ArrowDown','ArrowUp'].includes(event.key))return;
    const buttons=[...results.querySelectorAll('[data-search-node]')],index=buttons.indexOf(event.target.closest('[data-search-node]'));
    if(index<0)return;
    event.preventDefault();
    const next=index+(event.key==='ArrowDown'?1:-1);
    if(next<0){$('#node-search').focus({preventScroll:true});return;}
    buttons[Math.min(next,buttons.length-1)].focus({preventScroll:true});document.activeElement.scrollIntoView({block:'nearest'});
  });
  window.addEventListener('resize',()=>{positionSearch();positionGuide();});
  window.visualViewport?.addEventListener('resize',()=>{positionSearch();positionGuide();});
  window.visualViewport?.addEventListener('scroll',()=>{positionSearch();positionGuide();});
  window.addEventListener('scroll',()=>{positionSearch();positionGuide();},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFlow();cancelCamera(true);}});
  const observer=new ResizeObserver(()=>{positionGuide();positionSearch();});observer.observe(card);observer.observe($('.graph-toolbar'));
  languageChanged();graphReady();
  setTimeout(()=>{
    if(pageName==='contribute'){editorEntered();return;}
    if(pageName==='graph'&&params.get('guide')!=='0'&&(!embedded||params.get('guide')==='1')&&(params.get('guide')==='1'||!read(keys.reading)))startGuide('reading');
  },300);
  return {cancelCamera,moveCamera,stopFlow,selectionChanged,detailReady,graphReady,languageChanged,positionSearch,editorEntered,flowAvailable};
})();
