/* Pure data operations shared by the form, browser renderer and smoke tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AtlasCore=factory()})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),bi=(zh,en)=>({zh:zh||'',en:en||zh||''});
const categories=['material','energy','support','information','dependency','enhancement'];
const themeViews={water:['water'],air:['air'],agriculture:['plants','aquatic'],materials:['logistics'],bioreactor:[],human:['overview'],logistics:['logistics'],energy:['energy'],ground:['ground'],heritage:['other']};
const relations=(b,p)=>[...b.edges,...p.edges,...p.dependencies,...p.enhancements];
function project(b,p,view='overview'){
 const src=Object.fromEntries([...b.nodes,...p.nodes].map(n=>[n.id,n])),teams=Object.fromEntries(p.teams.map(t=>[t.id,t])),chains=Object.fromEntries(p.teams.flatMap(t=>t.chains).map(c=>[c.id,c]));let edges=[];
 for(const e of b.edges){let keep=view==='overview'?(b.overview_edge_ids.includes(e.id)||e.layer==='ground'):(themeViews[view]||[view]).some(v=>(e.views||[]).includes(v));
  if(view==='human')keep=keep&&[e.source,e.target].includes('crew');if(view==='materials')keep=keep&&[e.source,e.target].some(k=>src[k].theme==='materials');if(b.themes.some(t=>t.id===view)&&[e.source,e.target].some(k=>src[k].theme===view))keep=true;if(keep)edges.push(clone(e));}
 const eligible=new Set();for(const t of p.teams)for(const c of t.chains){const keep=view==='overview'?!c.demonstration:view==='bioreactor'?c.dependencies.includes('space_bioreactor'):c.theme===view;if(keep)eligible.add(c.id)}
 for(const e of [...p.edges,...p.dependencies]){const boundary=b.themes.some(t=>t.id===view)&&[e.source,e.target].some(k=>src[k].theme===view);if(eligible.has(e.route)||boundary||(!e.route&&(view==='overview'||e.theme===view)))edges.push(clone(e))}
 for(const e of p.enhancements)if(view==='overview'||src[e.target].theme===view)edges.push(clone(e));
 if(view==='effects'){const example=new Set(['2025-5781','2024-5260','2025-5893']);edges=clone([...p.enhancements,...p.edges.filter(e=>example.has(e.owner)&&!e.demonstration),...p.dependencies.filter(e=>example.has(e.owner)&&!e.demonstration)])}
 const compact=['overview','effects'].includes(view),stepMap=compact?Object.fromEntries(Object.values(chains).flatMap(c=>c.step_ids.map(id=>[id,c.step_ids[0]]))):{},nodes={},projected=[];
 for(const e of edges){const mapped={};for(const side of ['source','target']){const logical=stepMap[e[side]]||e[side],n=clone(src[logical]);n.logical_id=logical;
  if(compact&&n.route){const t=teams[n.owner];n.label=t.chains.length===1?t.role:chains[n.route].label||n.label;n.kind='process';n.summary=true}
  const local=eligible.has(n.route)||view==='effects',remote=!['overview','effects'].includes(view)&&n.theme!==view&&!local,id=remote?`remote:${view}:${logical}`:logical;
  n.id=id;n.remote=remote;n.target_view=remote||(compact&&n.owner)?n.theme:null;n.display_theme=remote?'remote':!['overview','effects'].includes(view)?view:n.theme;nodes[id]=n;mapped[side]=id;
 }if(mapped.source!==mapped.target)projected.push({...e,...mapped})}
 const used=new Set(projected.flatMap(e=>[e.source,e.target]));return {view,nodes:Object.fromEntries(Object.entries(nodes).filter(([k])=>used.has(k))),edges:projected};
}
function visible(model,active,ground=false){const ids=active instanceof Set?active:new Set(active);let edges=model.edges.filter(e=>(!e.owner||ids.has(e.owner))&&(ground||e.layer!=='ground'));const used=new Set(edges.flatMap(e=>[e.source,e.target])),nodes=Object.fromEntries(Object.entries(model.nodes).filter(([k,n])=>used.has(k)&&(!n.owner||ids.has(n.owner))));edges=edges.filter(e=>nodes[e.source]&&nodes[e.target]);return {nodes,edges}}
function teamStatus(p,roster,id){return p.teams.some(t=>t.id===id)?'integrated':roster.teams.some(t=>t.id===id)?'awaiting_additions':'future_outlook'}
function teamBundle(p,id){const team=p.teams.find(t=>t.id===id);if(!team)throw Error('队伍不存在');const out={format:'space-atlas-team-bundle-1',team:clone(team)};for(const k of ['nodes','edges','dependencies','enhancements'])out[k]=clone(p[k].filter(x=>x.owner===id));const used=new Set([team,...out.nodes,...out.edges,...out.dependencies,...out.enhancements].flatMap(x=>x.source_ids||[]));out.sources=clone(p.sources.filter(s=>used.has(s.id)));return out}
function validateBundle(b,p,bundle){
 const errors=[],t=bundle?.team;if(!t||typeof t!=='object')return ['缺少队伍资料'];
 if(!/^\d{4}-[A-Za-z0-9_-]+$/.test(t.id||''))errors.push('队伍标识需为 年份-ID');if(!Number.isInteger(t.year)||t.year<2004||t.year>2100)errors.push('年份不正确');if(!t.name?.trim())errors.push('请填写队名');if(Number((t.id||'').slice(0,4))!==t.year)errors.push('队伍标识年份与年份字段应一致');if(t.url&&!/^https?:\/\//i.test(t.url))errors.push('项目主页应使用 http 或 https');
 const themes=new Set(b.themes.map(t=>t.id));if(!themes.has(t.primary_theme))errors.push('请选择主要主题');
 if(!t.role?.zh?.trim()||!t.role?.en?.trim())errors.push('请填写项目的简短名称');
 for(const key of ['nodes','edges','dependencies','enhancements','sources'])if(!Array.isArray(bundle[key]))errors.push(`资料缺少 ${key}`);if(errors.length)return errors;
 const old=p.teams.find(x=>x.id===t.id),otherSourceIDs=new Set(p.teams.filter(x=>x.id!==t.id).flatMap(x=>x.source_ids));
 const oldOwnedSources=new Set((old?.source_ids||[]).filter(id=>!otherSourceIDs.has(id)));
 const existingNodes=new Map([...b.nodes,...p.nodes.filter(n=>n.owner!==t.id)].map(n=>[n.id,n])),nodes=new Map(existingNodes),sources=new Map([...b.sources,...p.sources].map(s=>[s.id,s]));
 const allowedID=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(x);
 const label=x=>x&&typeof x.zh==='string'&&x.zh.trim()&&typeof x.en==='string'&&x.en.trim();
 const seen=new Set();for(const n of bundle.nodes){if(!allowedID(n.id)||seen.has(n.id))errors.push('步骤/节点标识重复或不正确');seen.add(n.id);if(n.owner!==t.id)errors.push('只能修改本队拥有的步骤和节点');if(existingNodes.has(n.id))errors.push('已有共享节点请直接复用，不能覆盖');if(!label(n.label))errors.push('节点缺少名称');if(!themes.has(n.theme))errors.push('节点缺少有效主题');if(!['process','material','state','information','energy','resource'].includes(n.kind))errors.push('节点类型不正确');if(n.layer!=='project'||n.future!==true)errors.push('新队伍节点应为项目路线');nodes.set(n.id,n)}
 const supplied=new Set();for(const s of bundle.sources){if(!allowedID(s.id)||supplied.has(s.id))errors.push('来源标识重复或不正确');supplied.add(s.id);if(sources.has(s.id)&&!oldOwnedSources.has(s.id)&&JSON.stringify(sources.get(s.id))!==JSON.stringify(s))errors.push('不能覆盖其他队伍使用的来源');if(!s.title?.trim())errors.push('来源缺少标题');if(s.url&&!/^https?:\/\//i.test(s.url))errors.push('来源链接应使用 http 或 https');sources.set(s.id,s)}
 if(!Array.isArray(t.source_ids)||!t.source_ids.length||t.source_ids.some(id=>!sources.has(id)))errors.push('请提供项目来源');
 if(!Array.isArray(t.chains)||!t.chains.length)errors.push('至少需要一条路线');
 const chains=new Map(),foreignChains=new Set(p.teams.filter(x=>x.id!==t.id).flatMap(x=>x.chains.map(c=>c.id)));
 for(const c of t.chains||[]){if(!allowedID(c.id)||chains.has(c.id)||foreignChains.has(c.id))errors.push('路线标识重复或不正确');chains.set(c.id,c);if(!themes.has(c.theme))errors.push('路线主题不正确');if(!label(c.label))errors.push('路线缺少名称');if(!Array.isArray(c.step_ids)||!c.step_ids.length)errors.push('每条路线至少需要一个本队步骤');else for(const id of c.step_ids)if(!nodes.has(id)||nodes.get(id).owner!==t.id)errors.push('路线步骤必须属于本队');}
 for(const n of bundle.nodes)if(n.route&&!chains.has(n.route))errors.push('节点所属路线不存在');
 const edgeIDs=new Set(relations(b,p).filter(e=>e.owner!==t.id).map(e=>e.id)),ownEdges=new Map();
 for(const [collection,expected] of [['edges',null],['dependencies','dependency'],['enhancements','enhancement']])for(const e of bundle[collection]){
  if(!allowedID(e.id)||edgeIDs.has(e.id)||ownEdges.has(e.id))errors.push('连接标识重复或与其他队伍冲突');ownEdges.set(e.id,e);
  if(e.owner!==t.id)errors.push('连接只能属于本队');if(!nodes.has(e.source)||!nodes.has(e.target))errors.push(`连接端点不存在：${e.source} → ${e.target}`);if(e.source===e.target)errors.push('连接两端应为不同节点');if(!categories.includes(e.category)||(expected&&e.category!==expected))errors.push('连接类型不正确');if(!label(e.label))errors.push('请给连接填写说明');if(e.route&&!chains.has(e.route))errors.push('连接所属路线不存在');
  if(['dependency','enhancement'].includes(e.category)&&nodes.get(e.target)?.kind!=='process')errors.push('工艺联系和改良应指向工艺节点');if(!e.source_ids?.length||e.source_ids.some(id=>!sources.has(id)))errors.push('连接缺少有效来源');if(e.category==='enhancement'&&(!e.scope?.trim()||!e.kind))errors.push('请说明改良机制和作用范围');
 }
 for(const c of t.chains||[])for(const eid of c.edge_ids||[])if(!ownEdges.has(eid))errors.push('路线引用的连接不存在');
 // An edited node may be reused by a later team: do not leave those links dangling.
 for(const e of relations(b,p).filter(e=>e.owner!==t.id))if(!nodes.has(e.source)||!nodes.has(e.target))errors.push('其他队伍仍在引用被删除的本队节点，请保留它或先调整引用');
 return [...new Set(errors)];
}
function upsert(b,p,bundle){const errors=validateBundle(b,p,bundle);if(errors.length)throw Error(errors.join('\n'));const next=clone(p),id=bundle.team.id;next.teams=next.teams.filter(t=>t.id!==id);next.teams.push(clone(bundle.team));for(const key of ['nodes','edges','dependencies','enhancements'])next[key]=[...next[key].filter(x=>x.owner!==id),...clone(bundle[key])];const sources=new Map(next.sources.map(s=>[s.id,s]));for(const s of bundle.sources)sources.set(s.id,clone(s));next.sources=[...sources.values()];next.coverage.teams=next.teams.length;next.coverage.years=[...new Set(next.teams.map(t=>t.year))].sort();return next}
function makeBlank({id,year=2026,name='',wiki='',theme='bioreactor'}={}){const tid=id||`${year}-new-team`,sid=`team:${tid}`,rid=`${tid}:route:0`;return {format:'space-atlas-team-bundle-1',team:{id:tid,year,name,url:wiki,location:'',organizer_type:'',description:'',description_en:'',role:bi('',''),primary_theme:theme,themes:[theme],scenario:'assumed_success',source_ids:[sid],chains:[{id:rid,theme,label:bi('主要路线','Main route'),step_ids:[],edge_ids:[],dependencies:[],demonstration:false}]},nodes:[],edges:[],dependencies:[],enhancements:[],sources:[{id:sid,title:name?`${year} ${name} · 项目介绍`:'项目介绍',url:wiki,kind:'team_supplied',description:bi('','')}]} }
return {clone,bi,relations,project,visible,teamBundle,validateBundle,upsert,makeBlank,themeViews,teamStatus};
});
