/* Browser-side geometry for local team contributions. Official scenes are prebuilt. */
window.AtlasRuntime=(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tx=(x,l)=>typeof x==='object'?(x[l]||x.zh):x;
let engine;
const {wrap,hull,octagon}=AtlasLayout;
async function layout(model,lang){engine??=await Viz.instance();return AtlasLayout.layout(model,lang,engine);}
function render(model,g,b,p,lang){
 const owners=Object.fromEntries(p.teams.map(t=>[t.id,t])),themes=Object.fromEntries(b.themes.map(t=>[t.id,t]));themes.remote={label:{zh:'远端',en:'Remote'},color:'#f1f5f4'};
 const palette={material:'#557b96',project:'#149b80',energy:'#b87500',support:'#678799',information:'#678799',dependency:'#7c9890',enhancement:'#b87500'};
 const roleColors={earth_input:['#e0efe9','#287667'],earth_return:['#e4edf9','#496a94'],disposal:['#f5e5dc','#9a593a'],discharge:['#ede9e5','#7c695b'],energy_sink:['#f4edde','#947439'],local_resource:['#efe8dc','#927c51'],crew:['#e6edf2','#2c4d64']};
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width+80} ${g.height+240}" width="${g.width+80}" height="${g.height+240}" data-view="${esc(model.view)}" data-layout="${g.fingerprint}"><style>text{font-family:Manrope,'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif}</style><defs>`;
 for(const [k,c] of Object.entries(palette))s+=`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9Z" fill="${c}"/></marker>`;
 s+='</defs><rect width="100%" height="100%" fill="#f9fcfa"/><g transform="translate(40,140)">';
 for(const r of Object.values(g.clusters))s+=`<g class="cluster" data-theme="${esc(r.theme)}" data-members="${esc(r.members.join(' '))}"><polygon points="${r.polygon.map(p=>p.join(',')).join(' ')}" fill="${themes[r.theme]?.color||'#f4f7f4'}" fill-opacity=".65" stroke="#b7d4c6"/></g>`;
 const groups=new Map();for(const e of model.edges){const key=JSON.stringify([e.source,e.target,e.category]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
 for(const es of groups.values()){const e=es[0],cat=e.category,col=cat==='material'&&e.owner?'project':cat,pts=g.paths[e.id]||[],dash=cat==='dependency'?'3 5':cat==='material'?'':'7 5',points=pts.map(p=>p.join(',')).join(' ');s+=`<g class="edge" data-ids="${esc(es.map(e=>e.id).join(' '))}" data-category="${cat}" data-source="${esc(e.source)}" data-target="${esc(e.target)}"><title>${esc(es.map(e=>tx(e.label,lang)).join('\n'))}</title><polyline class="crossing-clearance" points="${points}" fill="none" stroke="#f9fcfa" stroke-width="5.8"/><polyline points="${points}" fill="none" stroke="${palette[col]}" stroke-width="1.8" stroke-dasharray="${dash}" marker-end="url(#arrow-${col})"/></g>`}
 for(const [k,n] of Object.entries(model.nodes)){const r=g.nodes[k],{x,y,w,h}=r,role=n.boundary_role,process=n.kind==='process',[fill,stroke]=roleColors[role]||['#fbfdfc',n.owner?'#169475':'#7b99aa'];
  s+=`<g class="node" id="${esc(n.logical_id)}" data-node="${esc(k)}" data-owner="${esc(n.owner||'')}" data-boundary-role="${esc(role||'')}">`;
  if(role&&role!=='crew')s+=`<polygon points="${x},${y} ${x+w-22},${y} ${x+w},${y+22} ${x+w},${y+h} ${x},${y+h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  else s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${role==='crew'?28:process?3:15}" fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="${n.remote?'6 4':'none'}"/>`;
  if(process)s+=`<rect x="${x+1}" y="${y+1}" width="${w-2}" height="25" fill="#d8f1e5"/>`;
  const tags={earth_input:['地球输入','EARTH INPUT'],earth_return:['返回地球','EARTH RETURN'],disposal:['离开循环 · 处置','DISPOSAL'],discharge:['离开系统 · 排放','DISCHARGE'],crew:['乘员','CREW'],energy_sink:['热量输出','HEAT OUTPUT'],local_resource:['当地资源','LOCAL RESOURCE']};
  const tag=role?tags[role][lang==='zh'?0:1]:n.remote?(lang==='zh'?'↗ 远端':'↗ REMOTE'):n.future?(n.demonstration?(lang==='zh'?'示范 · Future':'Demo · Future'):'Future'):process?(lang==='zh'?'工艺':'PROCESS'):'';
  s+=`<text x="${x+12}" y="${y+18}" font-size="11" fill="#437767">${esc(tag)}</text>`;
  wrap(tx(n.label,lang),lang==='zh'?26:30).forEach((line,i)=>s+=`<text x="${x+w/2}" y="${y+49+i*21}" text-anchor="middle" font-size="17" fill="#0c2f5f">${esc(line)}</text>`);
  if(n.owner)s+=`<text x="${x+w/2}" y="${y+h-13}" text-anchor="middle" font-size="12" fill="#526d7b">${esc(owners[n.owner].name+' · '+owners[n.owner].year)}</text>`;
  const effects=model.edges.filter(e=>e.category==='enhancement'&&e.target===k);effects.forEach((e,i)=>{const bx=x+w-15-i*25,by=y+12;s+=`<g class="badge" data-effect-owner="${esc(e.owner)}" data-effect-id="${esc(e.id)}"><circle cx="${bx}" cy="${by}" r="10" fill="#f4ce72" stroke="#aa7927"/><text x="${bx}" y="${by+4}" font-size="14" text-anchor="middle" fill="#714b15">${e.kind==='mass_transfer'?'↑':'+'}</text><title>${esc(owners[e.owner].name+' · '+tx(e.label,lang))}</title></g>`});
  s+=`<title>${esc(tx(n.narrative||{zh:n.description||'',en:n.description_en||''},lang))}</title></g>`;
 }
 return s+'</g><metadata>{}</metadata></svg>';
}
async function scene(b,p,view,lang){const model=AtlasCore.project(b,p,view),geometry=await layout(model,lang);return {model,geometry,svg:render(model,geometry,b,p,lang)}}
return {esc,tx,wrap,hull,octagon,layout,render,scene};
})();
