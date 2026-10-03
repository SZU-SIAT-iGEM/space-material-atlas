'use strict';
const $=s=>document.querySelector(s),clone=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,workspace='teams',activeKey=null,editing=null,baseRevision='',dirty=false,extraUpdates={},pending=null;
const labels=translatedLabels({roster:'名录资料',team:'项目资料',nodes:'节点',edges:'路线连接',dependencies:'工艺依赖',enhancements:'工艺改良',sources:'来源',id:'稳定标识',name:'队名',year:'年份',official_id:'官方编号',url:'网址',wiki:'Wiki 地址',location:'所在地',country:'国家',city:'城市',region:'地区',organizer_type:'队伍类型',integrated:'已有路线',description:'中文说明',description_en:'英文说明',narrative:'完整叙述',role:'项目简短名称',label:'名称',zh:'中文',en:'English',kind:'类型',theme:'主题',themes:'相关主题',primary_theme:'主要主题',layer:'层级',future:'Future 情景',owner:'所属队伍',route:'所属路线',demonstration:'示范路线',source_ids:'来源引用',chains:'项目路线',step_ids:'步骤节点',edge_ids:'路线连接引用',source:'起点节点',target:'终点节点',category:'关系类型',scope:'中文作用范围',scope_en:'英文作用范围',scenario:'情景',basis:'依据',measured_gain:'量化增益',title:'标题',publisher:'发布者',accessed:'访问日期',event_or_publication_date:'资料日期',display_kind:'显示类型',display_url:'展示链接',retrieved_at:'获取日期',boundary_role:'边界角色',views:'所属分图',contact:'联系方式',about:'About',canonical_url:'正式地址',version:'显示版本',email:'邮箱',overview_edge_ids:'总图关系',as_of:'资料截至日期',coverage:'收录范围'});
const collectionNames=translatedLabels({'baseline/themes':'主题目录','baseline/nodes':'基础节点','baseline/edges':'基础关系','shared/nodes':'共享物质与工艺','shared/relations':'共享关系','sources/baseline':'基础图来源','sources/projects':'队伍项目来源','site/config':'站点说明与联系资料','manifest':'元数据与排序'});
async function api(path,body,method='POST'){
 const response=await fetch('/api'+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));return data;
}
function notice(message,success=false){$('#notice').hidden=false;$('#notice').className=success?'success':'';$('#notice').textContent=message;}
function fail(e){notice(T(e.message||String(e)));}
function markDirty(){dirty=true;const node=$('#edit-state');if(node){node.textContent=T('尚未应用');node.className='dirty';}pending=null;}
function mayLeave(){if(!dirty)return true;notice(T('当前内容尚未应用，请先保存草稿、应用修改，或点击“放弃修改”。'));return false;}
async function reload(){state=await api('/state');$('#stats').innerHTML=[['roster',T('支队伍')],['nodes',T('个节点')],['relations',T('条关系')],['sources',T('份来源')]].map(([k,l])=>`<div class="stat"><strong>${state.counts[k]}</strong><span>${l}</span></div>`).join('');const years=[...new Set(state.documents['roster.json'].teams.map(t=>t.year))].sort().reverse();$('#year').innerHTML=T('<option value="">全部年份</option>')+years.map(y=>`<option>${y}</option>`).join('');$('#topic').innerHTML='<option value="">'+T('全部主题')+'</option>'+state.documents['baseline.json'].themes.map(t=>`<option value="${esc(t.id)}">${esc(localLabel(t.label))}</option>`).join('');renderList();}
function renderList(){
 if(!state)return;const query=$('#filter').value.trim().toLowerCase(),year=$('#year').value,status=$('#integrated').value,topic=$('#topic').value;
 let entries=[];
 if(workspace==='teams'){const teams=Object.fromEntries(state.documents['projects.json'].teams.map(t=>[t.id,t]));entries=state.documents['roster.json'].teams.filter(t=>(!year||String(t.year)===year)&&(!topic||teams[t.id]?.themes?.includes(topic))&&(!status||(status==='yes')===!!t.integrated)).map(t=>({id:`teams/${t.year}/${t.id}`,title:t.name,subtitle:`${t.year} · ${t.integrated?T('已有路线'):T('等待增补')} · ${t.id}`,search:JSON.stringify([t,teams[t.id]])}));}
 else entries=state.modules.filter(m=>!m.id.startsWith('teams/')).map(m=>({id:m.id,title:collectionNames[m.id]||m.id,subtitle:m.count!==null?UI`${m.count} 条记录`:m.id,search:collectionNames[m.id]||m.id}));
 if(workspace==='teams')for(const d of state.drafts||[]){if(!entries.some(e=>e.id===d.id)&&!state.modules.some(m=>m.id===d.id))entries.unshift({id:d.id,title:d.name,subtitle:T('未来展望 · 草稿'),search:d.name});}
 entries=entries.filter(t=>t.search.toLowerCase().includes(query));
 $('#module-list').innerHTML=entries.map(t=>`<button class="module-button ${t.id===activeKey?'active':''}" data-module="${esc(t.id)}"><strong>${esc(t.title)}</strong><span>${esc(t.subtitle)}</span></button>`).join('')||T('<p class="muted">没有匹配的内容。</p>');
}
async function openModule(key){if(!mayLeave())return;const result=await api('/modules/'+key);activeKey=key;editing=clone(result.data);baseRevision=result.revision;extraUpdates={};dirty=false;renderList();renderEditor();if(result.draft){notice(T('此模块有保存的草稿。'));const b=document.createElement('button');b.textContent=T('恢复草稿');b.onclick=()=>{editing=clone(result.draft.data);extraUpdates=result.draft.extraUpdates||{};baseRevision=result.draft.revision;renderEditor();markDirty();notice(T('已恢复草稿；应用前会检查是否与较新的内容冲突。'));};$('#notice').append(' ',b);}}
function pathAttr(path){return esc(encodeURIComponent(JSON.stringify(path)));}
function at(path){return path.reduce((o,k)=>o[k],editing);}
function put(path,value){let o=editing;for(const p of path.slice(0,-1))o=o[p];const key=path.at(-1),previous=o[key];o[key]=value;if(key==='description'&&o.narrative?.zh===previous)o.narrative.zh=value;if(key==='description_en'&&o.narrative?.en===previous)o.narrative.en=value;}
function field(key,value,path){
 const name=labels[key]||key,attr=`data-path="${pathAttr(path)}"`,wide=typeof value==='string'&&(value.length>100||/description|scope|about/.test(key));
 let control,options=null;
 if(['source','target'].includes(key))control=`<input ${attr} list="node-options" value="${esc(value)}">`;
 else if(['theme','primary_theme'].includes(key))options=state.documents['baseline.json'].themes.map(t=>[t.id,`${localLabel(t.label)} / ${t.id}`]);
 else if(key==='category')options=['material','energy','support','information','dependency','enhancement'].map(k=>[k,k]);
 else if(key==='kind'&&path.includes('nodes'))options=['actor','material','process','energy','boundary','category','state','information','resource'].map(k=>[k,k]);
 else if(key==='route'&&editing.team)options=[['',T('无所属路线')],...editing.team.chains.map(c=>[c.id,localLabel(c.label)||c.id])];
 if(options){if(value&&!options.some(o=>o[0]===value))options.unshift([value,value]);control=`<select ${attr}>${options.map(([id,title])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(title)}</option>`).join('')}</select>`;}
 if(!control){
  if(typeof value==='boolean')control=`<input type="checkbox" ${attr} ${value?'checked':''}>`;
  else if(typeof value==='number')control=`<input type="number" ${attr} value="${value}">`;
  else if(value===null)control=UI`<input ${attr} data-null="1" value="" placeholder="留空表示 null">`;
  else if(Array.isArray(value))control=UI`<textarea ${attr} data-list="1" rows="2" placeholder="每行一个稳定标识">${esc(value.join('\n'))}</textarea>`;
  else if(wide||['zh','en'].includes(key)&&value.length>70)control=`<textarea ${attr} rows="${value.length>300?6:3}">${esc(value)}</textarea>`;
  else control=`<input ${attr} value="${esc(value)}" ${['id','owner'].includes(key)?'readonly class="readonly"':''}>`;
 }
 return `<label class="field ${wide||Array.isArray(value)?'wide':''}"><span>${esc(name)} <small>${esc(key)}</small></span>${control}</label>`;
}
function objectForm(obj,path=[]){return `<div class="fields">${Object.entries(obj).map(([k,v])=>{
 const p=[...path,k];
 if(v&&typeof v==='object'&&!Array.isArray(v))return `<section class="nested"><h4>${esc(labels[k]||k)}</h4>${objectForm(v,p)}</section>`;
 if(Array.isArray(v)&&((v.length&&typeof v[0]==='object')||['chains','nodes','edges','enhancements'].includes(k)))return `<section class="nested"><h4>${esc(labels[k]||k)}</h4>${records(v,p)}</section>`;
 return field(k,v,p);
}).join('')}</div>`;}
function records(values,path){return values.map((obj,i)=>UI`<details class="record"><summary>${esc(localLabel(obj.label)||obj.name||obj.title||obj.id||T('记录'))} <span class="muted">${esc(obj.id||'')}</span></summary>${objectForm(obj,[...path,i])}<button class="danger" data-remove="${pathAttr([...path,i])}">移除此记录</button></details>`).join('')+UI`<button class="add-row" data-add="${pathAttr(path)}">＋ 添加${esc(labels[path.at(-1)]||T('记录'))}</button>`;}
function renderEditor(){
 const title=editing?.roster?.name||editing?.team?.name||collectionNames[activeKey]||activeKey;
 const nodes=[...state.documents['baseline.json'].nodes,...state.documents['projects.json'].nodes,...(editing.nodes||[])];
 let body;
 if(activeKey.startsWith('teams/'))body=['roster','team',...['nodes','edges','dependencies','enhancements']].map(k=>{
  const value=editing[k];if(k==='team'&&!value)return T('<section class="action-card"><h3>这支队伍还没有项目路线</h3><p>名录资料已保留，可在这里补充介绍、节点和关系。</p><button id="init-project">建立项目路线</button></section>');
  if(value===null)return '';
  return `<details class="section" ${['roster','team'].includes(k)?'open':''}><summary>${esc(labels[k])}${Array.isArray(value)?` · ${value.length}`:''}</summary><div class="section-body">${Array.isArray(value)?records(value,[k]):objectForm(value,[k])}</div></details>`;
 }).join('');
 else body=Array.isArray(editing)?records(editing,[]):objectForm(editing);
 $('#editor').innerHTML=UI`<div class="editor-top"><div><p class="eyebrow">${esc(activeKey)}</p><h2>${esc(title)}</h2><small id="edit-state">已载入 · ${baseRevision.slice(0,10)}</small></div><div class="editor-actions"><button id="discard">放弃修改</button><button id="save-draft">保存草稿</button><button class="primary" id="review-edit">检查并应用</button></div></div><datalist id="node-options">${[...new Map(nodes.map(n=>[n.id,n])).values()].map(n=>`<option value="${esc(n.id)}">${esc(localLabel(n.label))}</option>`).join('')}</datalist>${body}<details class="section"><summary>高级 JSON 编辑 · 完整保留所有字段</summary><div class="section-body"><textarea id="raw" class="code" spellcheck="false">${esc(JSON.stringify(editing,null,2))}</textarea><button id="load-raw">将 JSON 载入表单</button></div></details>${activeKey.startsWith('teams/')?T('<p class="muted">项目来源在“基础与共享内容 → 队伍项目来源”中维护。删除整支队伍可在高级 JSON 中检查相关模块后，通过导入与校对执行。</p>'):''}`;
 $('#discard').onclick=async()=>{dirty=false;if(state.modules.some(m=>m.id===activeKey))await openModule(activeKey);else{activeKey=null;editing=null;$('#editor').innerHTML=T('<div class="empty">草稿已放弃。</div>');}};
 $('#save-draft').onclick=async()=>{await api('/drafts/'+activeKey,{data:editing,extraUpdates,revision:baseRevision},'PUT');dirty=false;await reload();$('#edit-state').textContent=T('草稿已保存');notice(T('草稿已保存在本机，尚未写入正式内容库。'),true);};
 $('#review-edit').onclick=()=>review({revision:baseRevision,updates:{...extraUpdates,[activeKey]:editing}}).catch(fail);
 $('#load-raw').onclick=()=>{try{editing=JSON.parse($('#raw').value);renderEditor();markDirty();}catch(e){fail(e);}};
 if($('#init-project'))$('#init-project').onclick=initProject;
}
function freshId(prefix){return prefix+':'+crypto.randomUUID().slice(0,8);}
function defaultRecord(path){
 const type=path.at(-1)||activeKey.split('/').at(-1),tid=editing.team?.id,route=editing.team?.chains?.[0]?.id,theme=editing.team?.primary_theme||'water',sid=editing.team?.source_ids?.[0];
 const bi={zh:'',en:''};
 if(type==='chains')return {id:freshId(tid+':route'),theme,label:bi,step_ids:[],edge_ids:[],dependencies:[],demonstration:false};
 if(type==='nodes')return {id:freshId(tid||'node'),label:bi,kind:'process',theme,layer:tid?'project':activeKey.startsWith('baseline/')?'baseline':'project',...(tid?{owner:tid,route}:{}),future:!activeKey.startsWith('baseline/'),description:'',description_en:'',source_ids:sid?[sid]:[]};
 if(['edges','dependencies','enhancements'].includes(type)){const key=type==='dependencies'?'dependency':type==='enhancements'?'enhancement':'material';return {id:freshId(tid||'relation'),source:'',target:'',label:bi,category:key,...(tid?{owner:tid,route}:{}),source_ids:sid?[sid]:[],layer:tid?'project':'baseline',...(!tid&&activeKey==='baseline/edges'?{views:[theme]}:{}),...(key==='enhancement'?{kind:'mass_transfer',scope:'',scope_en:'',measured_gain:null}:{})};}
 if(activeKey.startsWith('sources/'))return {id:freshId('source'),title:'',url:'',kind:'team_supplied',description:bi};
 if(type==='themes')return {id:'theme-'+crypto.randomUUID().slice(0,8),label:bi,color:'#edf8f3'};
 return {id:freshId('record'),label:bi};
}
function initProject(){
 const r=editing.roster,tid=r.id,sid='team:'+tid,rid=tid+':route:0';
 editing.team={id:tid,year:r.year,name:r.name,url:r.wiki||'',location:r.city||'',organizer_type:r.organizer_type||'',description:'',description_en:'',role:{zh:'',en:''},primary_theme:'water',themes:['water'],scenario:'assumed_success',source_ids:[sid],chains:[{id:rid,theme:'water',label:{zh:'主要路线',en:'Main route'},step_ids:[],edge_ids:[],dependencies:[],demonstration:false}]};
 const sources=clone(state.documents['projects.json'].sources);if(!sources.some(s=>s.id===sid))sources.push({id:sid,title:`${r.year} ${r.name}`,url:r.wiki||'',kind:'team_supplied',description:{zh:'',en:''}});extraUpdates['sources/projects']=sources;renderEditor();markDirty();
}
$('#editor').addEventListener('input',event=>{const el=event.target;if(!el.dataset.path)return;const path=JSON.parse(decodeURIComponent(el.dataset.path));let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.dataset.list?el.value.split(/\n|,/).map(x=>x.trim()).filter(Boolean):el.value;if(el.dataset.null)value=el.value===''?null:JSON.parse(el.value);put(path,value);markDirty();if($('#raw'))$('#raw').value=JSON.stringify(editing,null,2);});
$('#editor').addEventListener('click',event=>{
 const add=event.target.closest('[data-add]'),remove=event.target.closest('[data-remove]');
 if(add){const path=JSON.parse(decodeURIComponent(add.dataset.add)),list=at(path),record=defaultRecord(path);list.push(record);if(editing.team&&record.route){const route=editing.team.chains.find(c=>c.id===record.route);if(path.at(-1)==='nodes')route?.step_ids.push(record.id);if(path.at(-1)==='edges')route?.edge_ids.push(record.id);}renderEditor();markDirty();}
 if(remove){const path=JSON.parse(decodeURIComponent(remove.dataset.remove)),list=at(path.slice(0,-1)),item=list[path.at(-1)];list.splice(path.at(-1),1);if(editing.team)for(const route of editing.team.chains)for(const k of ['step_ids','edge_ids','dependencies'])route[k]=(route[k]||[]).filter(id=>id!==item.id);renderEditor();markDirty();}
});
async function review(proposal){const result=proposal.preview||await api('/preview',proposal);pending={revision:proposal.revision,updates:clone(proposal.updates)};$('#impact').textContent=UI`${result.changes.length} 处变化 · 影响队伍：${result.impact.teams.join('、')||T('无')} · 分图：${result.impact.views.join('、')||T('无几何引用')}`;$('#diff').innerHTML=result.changes.slice(0,150).map(c=>`<div class="diff-item"><span class="${c.kind}">${{added:T('＋ 新增'),removed:T('− 删除'),changed:T('~ 修改')}[c.kind]}</span> ${esc(c.path)}${'before'in c?UI`<div class="diff-value">原：${esc(JSON.stringify(c.before))}</div>`:''}${'after'in c?UI`<div class="diff-value">现：${esc(JSON.stringify(c.after))}</div>`:''}</div>`).join('')||T('<p class="muted">内容没有变化。</p>');if(result.changes.length>150)$('#diff').insertAdjacentHTML('beforeend',UI`<p>另有 ${result.changes.length-150} 处变化，完整差异可从版本记录查看。</p>`);$('#reason').value='';$('#apply').disabled=!result.changes.length;$('#review').showModal();}
$('#apply').onclick=async()=>{try{$('#apply').disabled=true;await api('/apply',{...pending,reason:$('#reason').value});$('#review').close();dirty=false;pending=null;await reload();if(activeKey&&state.modules.some(m=>m.id===activeKey))await openModule(activeKey);notice(T('修改已应用。构建预览后可检查完整图谱。'),true);}catch(e){fail(e);}finally{$('#apply').disabled=false;}};
for(const id of ['close-review','cancel-review'])$('#'+id).onclick=()=>$('#review').close();
async function switchWorkspace(name){if(!mayLeave())return;workspace=name;activeKey=null;editing=null;$('#filter').value='';document.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('active',b.dataset.workspace===name));$('#catalog').hidden=['import','versions'].includes(name);$('#editor').classList.toggle('wide-panel',['import','versions'].includes(name));$('#new-team').hidden=name!=='teams';$('.filters').hidden=name!=='teams';$('#catalog-title').textContent=name==='teams'?T('队伍目录'):T('内容集合');if(name==='import')renderImport();else if(name==='versions')await renderVersions();else{$('#editor').innerHTML=T('<div class="empty"><span class="orbital">◎</span><h2>选择一份内容开始维护</h2></div>');renderList();}}
function renderImport(){
 $('#editor').innerHTML=UI`<p class="eyebrow">IMPORT & REVIEW</p><h2 class="panel-heading">把新资料接入现有图谱</h2><a href="/tools/proofreader.html" target="_blank" rel="noopener">打开完整文本校对台 ↗</a><p class="panel-intro">导入后先检查结构与引用，再查看增删改清单。完整队伍 bundle 会替换该队的路线集合。</p><div class="action-grid"><section class="action-card"><h3>JSON 导入</h3><label class="field">文件类型<select id="import-type"><option value="auto">完整图谱 / 队伍 bundle / 四份 JSON 集合</option>${['baseline.json','projects.json','roster.json','site-config.json'].map(k=>`<option>${k}</option>`).join('')}</select></label><label class="field">选择文件<input id="import-file" type="file" accept=".json,application/json"></label><textarea id="import-text" class="code" placeholder="也可以直接粘贴 JSON" spellcheck="false"></textarea><button id="check-import" class="primary">检查导入</button></section><section class="action-card"><h3>共享节点合并</h3><p>选择保留的节点后，系统会检查受影响的关系与路线，生成统一修改清单。</p><label class="field">待合并节点<input id="merge-from" list="merge-nodes"></label><label class="field">保留节点<input id="merge-to" list="merge-nodes"></label><datalist id="merge-nodes">${[...state.documents['baseline.json'].nodes,...state.documents['projects.json'].nodes].map(n=>`<option value="${esc(n.id)}">${esc(localLabel(n.label))}</option>`).join('')}</datalist><button id="check-merge">检查合并影响</button><p>拆分节点时，先添加新节点，再调整各条关系的起点、终点及路线引用；校验会列出尚未处理的引用。</p></section></div>`;
 $('#import-file').onchange=async event=>{const f=event.target.files[0];if(f){$('#import-text').value=await f.text();if(['baseline.json','projects.json','roster.json','site-config.json'].includes(f.name))$('#import-type').value=f.name;}};
 $('#check-import').onclick=async()=>{try{let payload=JSON.parse($('#import-text').value);if($('#import-type').value!=='auto')payload={filename:$('#import-type').value,data:payload};await review(await api('/import',payload));}catch(e){fail(e);}};
 $('#check-merge').onclick=async()=>{try{await review(await api('/merge-node',{source:$('#merge-from').value,target:$('#merge-to').value}));}catch(e){fail(e);}};
}
async function renderVersions(){
 const [versions,history]=await Promise.all([api('/releases'),api('/history')]);
 $('#editor').innerHTML=UI`<p class="eyebrow">VERSIONS & RELEASES</p><h2 class="panel-heading">每次发布，都可以重建</h2><p class="panel-intro">完整源码由 iGEM CI/CD 构建为静态站点。每个版本固定当时的内容、布局与引擎，后续修订使用新的版本名称。</p><div class="action-grid"><section class="action-card"><h3>创建发布快照</h3><label class="field">版本名称<input id="release-name" placeholder="例如 i2026.P0.2 或 i2026.R0.2"></label><label class="field">版本说明<textarea id="release-notes" rows="2"></textarea></label><button id="create-release" class="primary">校验并生成版本</button></section><section class="action-card"><h3>导出网页 CI 源码</h3><p>包含正式内容、前端、后台、布局核心、构建脚本与 CI 配置。已保存的草稿和本机运行记录独立保管。</p><button id="source-export">导出网页 CI 源码包 ↗</button><p class="revision">当前内容：${state.revision.slice(0,16)}</p></section></div><h3>发布版本</h3><div>${versions.map(v=>UI`<article class="release-row"><h3>${esc(v.name)}</h3><p>${esc(v.notes)} · ${esc(v.created_at)} · ${v.counts.teams} 支建模队伍</p><div class="links"><a href="/release-files/${encodeURIComponent(v.name)}/source">网页 CI 源码 ZIP</a><a href="/release-files/${encodeURIComponent(v.name)}/static">预览成品 ZIP</a><a href="/release-files/${encodeURIComponent(v.name)}/manifest">版本清单</a><button data-restore-release="${esc(v.name)}">比较并恢复此内容</button></div></article>`).join('')||T('<p class="muted">尚无发布快照。</p>')}</div><h3>内容修改记录</h3>${history.slice(0,40).map(h=>UI`<article class="release-row"><h3>${esc(h.reason)}</h3><p>${esc(h.time)} · ${h.changes.length} 处变化</p><button data-history="${esc(h.id)}">比较并恢复修改前的内容</button><details><summary>查看修改记录</summary><pre class="diff-value">${esc(JSON.stringify(h.changes,null,2))}</pre></details></article>`).join('')||T('<p class="muted">尚无修改记录。</p>')}`;
 $('#create-release').onclick=()=>launch('/releases',{revision:state.revision,name:$('#release-name').value,notes:$('#release-notes').value}).catch(fail);
 $('#source-export').onclick=()=>launch('/export-ci',{revision:state.revision}).catch(fail);
 $('#editor').querySelectorAll('[data-restore-release]').forEach(b=>b.onclick=async()=>{try{await review(await api('/restore-preview',{release:b.dataset.restoreRelease}));}catch(e){fail(e);}});
 $('#editor').querySelectorAll('[data-history]').forEach(b=>b.onclick=async()=>{try{await review(await api('/restore-preview',{history:b.dataset.history,before:true}));}catch(e){fail(e);}});
}
async function launch(endpoint,body){if(!mayLeave())return;const job=await api(endpoint,body);$('#job').hidden=false;$('#job').textContent=T('正在校验内容并处理构建任务…');$('#build').disabled=true;async function poll(){try{const current=await api('/jobs/'+job.id);if(['queued','running'].includes(current.status)){setTimeout(poll,1200);return;}$('#build').disabled=false;if(current.status==='failed'){$('#job').textContent=T('任务未完成：')+T(current.error);return;}const r=current.result;$('#job').innerHTML=T('<strong>任务已完成</strong>');if(r.preview_url)$('#job').insertAdjacentHTML('beforeend',UI`<a href="${esc(r.preview_url)}" target="_blank" rel="noopener">打开图谱预览 ↗</a><span class="muted"> · ${r.report.counts.nodes} 个节点 / ${r.report.counts.relations} 条关系 / 排版检查通过</span>`);if(r.url)$('#job').insertAdjacentHTML('beforeend',UI`<a href="${esc(r.url)}">下载网页 CI 源码 ZIP</a>`);if(current.kind==='release'&&workspace==='versions')await renderVersions();}catch(e){$('#build').disabled=false;fail(e);}}poll();}
$('#build').onclick=()=>launch('/build',{revision:state.revision}).catch(fail);
$('#refresh').onclick=async()=>{if(!mayLeave())return;try{await reload();if(activeKey)await openModule(activeKey);notice(T('内容已重新载入。'),true);}catch(e){fail(e);}};
$('#module-list').onclick=event=>{const b=event.target.closest('[data-module]');if(b)openModule(b.dataset.module).catch(fail);};
for(const id of ['filter','year','integrated','topic'])$('#'+id).addEventListener('input',renderList);
document.querySelectorAll('[data-workspace]').forEach(b=>b.onclick=()=>switchWorkspace(b.dataset.workspace).catch(fail));
$('#new-team').onclick=()=>{if(mayLeave())$('#new-dialog').showModal();};$('#close-new').onclick=()=>$('#new-dialog').close();
$('#new-form').onsubmit=event=>{event.preventDefault();const year=Number($('#new-year').value),id=`${year}-${$('#new-id').value}`;activeKey=`teams/${year}/${id}`;if(state.modules.some(m=>m.id===activeKey)){notice(T('该队伍已经存在，请从目录打开。'));return;}editing={roster:{id,year,name:$('#new-name').value,wiki:$('#new-wiki').value,integrated:false},team:null,nodes:[],edges:[],dependencies:[],enhancements:[]};extraUpdates={};baseRevision=state.revision;$('#new-dialog').close();renderEditor();markDirty();};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('unhandledrejection',event=>{event.preventDefault();fail(event.reason);});
reload().catch(fail);

$('#studio-language').onchange=async event=>{
 const savedY=window.scrollY,filter=$('#filter').value,year=$('#year').value,topic=$('#topic').value;
 // Read current values first. Switching language never changes the edited records.
 const formValues=[...document.querySelectorAll('#editor input:not([data-path]),#editor textarea:not([data-path]),#editor select:not([data-path])')].map(el=>[el.id,el.value]).filter(([id])=>id);
 language=event.target.value;localStorage.setItem('atlas-studio-language',language);translateShell();
 await reload();$('#filter').value=filter;$('#year').value=year;$('#topic').value=topic;renderList();
 if(editing){renderEditor();if(dirty)markDirty();}else if(workspace==='import')renderImport();else if(workspace==='versions')await renderVersions();
 for(const [id,value] of formValues){const element=document.getElementById(id);if(element)element.value=value;}
 window.scrollTo(0,savedY);
};
