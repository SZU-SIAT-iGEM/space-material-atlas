/* One deterministic layout implementation for Node builds and browser edits. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const VERSION = 'atlas-directed-1.0.0';
  const clone = x => JSON.parse(JSON.stringify(x));
  const tx = (x,l) => typeof x === 'object' ? (x[l] ?? x.zh ?? '') : String(x);
  const pairs = a => a.slice(1).map((p,i) => [a[i],p]);
  const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  function wrap(s, width=26) {
    const lines=[]; let line='', size=0;
    for (const c of String(s).replace(/\n/g,' ')) {
      const w=c.codePointAt(0)>255?2:1;
      if(size+w>width && line){lines.push(line.trim());line='';size=0;}
      line+=c;size+=w;
    }
    if(line)lines.push(line.trim());return lines.length?lines:[''];
  }
  function size(n,l) {return {w:266,h:Math.max(112,53+wrap(tx(n.label,l),l==='zh'?26:30).length*21+(n.owner||n.remote?20:0))};}
  function hull(points) {
    const pts=[...new Map(points.map(p=>[JSON.stringify(p),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo=[],hi=[];
    for(const p of pts){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
    for(const p of [...pts].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
    return lo.slice(0,-1).concat(hi.slice(0,-1));
  }
  function octagon(r,p=24){const x=r.x-p,y=r.y-p,w=r.w+2*p,h=r.h+2*p,c=p*.7;return [[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[x+c,y+h],[x,y+h-c],[x,y+c]];}
  function crossesRect(a,b,r,shrink=.05){
    const xmin=r.x+shrink,xmax=r.x+r.w-shrink,ymin=r.y+shrink,ymax=r.y+r.h-shrink;
    if(Math.max(a[0],b[0])<=xmin||Math.min(a[0],b[0])>=xmax||Math.max(a[1],b[1])<=ymin||Math.min(a[1],b[1])>=ymax)return false;
    let lo=0,hi=1;
    for(const [s,d,mn,mx] of [[a[0],b[0]-a[0],xmin,xmax],[a[1],b[1]-a[1],ymin,ymax]]){
      if(Math.abs(d)<1e-10){if(!(mn<s&&s<mx))return false;}
      else{let u=(mn-s)/d,v=(mx-s)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>=hi)return false;}
    }return hi>Math.max(lo,0)&&lo<1;
  }
  function overlap(a,b,c,d){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-6)return 0;
    if(Math.abs(dx*(c[1]-a[1])-dy*(c[0]-a[0]))/length>.2||Math.abs(dx*(d[1]-a[1])-dy*(d[0]-a[0]))/length>.2)return 0;
    const u=((c[0]-a[0])*dx+(c[1]-a[1])*dy)/length,v=((d[0]-a[0])*dx+(d[1]-a[1])*dy)/length;
    return Math.max(0,Math.min(length,Math.max(u,v))-Math.max(0,Math.min(u,v)));
  }
  function simplify(points){const result=[];for(const p of points){if(result.length&&dist(p,result.at(-1))<.05)continue;if(result.length>1){const a=result.at(-2),b=result.at(-1),cross=(b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]);if(Math.abs(cross)<.02){result[result.length-1]=p;continue;}}result.push(p);}return result;}
  function inside(p,poly){const signs=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});return signs.every(x=>x>=0)||signs.every(x=>x<=0);}
  function regions(model,boxes,paths){
    const clusters={},themes=new Map();
    for(const [k,n] of Object.entries(model.nodes)){if(!themes.has(n.display_theme))themes.set(n.display_theme,[]);themes.get(n.display_theme).push(k);}
    const polygon=ids=>hull([...ids].flatMap(k=>octagon(boxes[k],24)));
    function canJoin(a,b){
      const distance=Math.min(...[...a].flatMap(x=>[...b].map(y=>Math.hypot((boxes[x].x-boxes[y].x)/1.7,boxes[x].y-boxes[y].y))));
      if(distance>430)return false;
      const members=new Set([...a,...b]),poly=polygon(members);
      for(const [k,r] of Object.entries(boxes)){if(members.has(k))continue;if(octagon(r,5).some(p=>inside(p,poly)))return false;if(pairs([...poly,poly[0]]).some(([u,v])=>crossesRect(u,v,r,-4)))return false;}
      return true;
    }
    for(const [theme,ids] of themes){
      const parts=ids.sort().map(k=>new Set([k]));let changed=true;
      while(changed){changed=false;outer:for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(canJoin(parts[i],parts[j])){parts[i]=new Set([...parts[i],...parts[j]]);parts.splice(j,1);changed=true;break outer;}}
      parts.forEach((part,i)=>{
        let poly=polygon(part),title=null;
        if(part.size>=2){
          const top=[...part].sort((a,b)=>boxes[a].y-boxes[b].y||a.localeCompare(b,'en'))[0],trial={x:boxes[top].x,y:boxes[top].y-61,w:260,h:27};
          const hit=Object.values(boxes).some(r=>Math.max(trial.x,r.x)<Math.min(trial.x+trial.w,r.x+r.w)&&Math.max(trial.y,r.y)<Math.min(trial.y+trial.h,r.y+r.h));
          if(!hit&&!Object.values(paths).some(pts=>pairs(pts).some(([a,b])=>crossesRect(a,b,trial)))){title=trial;poly=hull([...poly,...octagon(trial,9)]);}
        }
        const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);clusters[`${theme}~${i}`]={theme,members:[...part].sort(),x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),polygon:poly,title};
      });
    }return clusters;
  }
  function shape(model,lang){return {version:VERSION,view:model.view,language:lang,nodes:Object.entries(model.nodes).map(([id,n])=>({id,...size(n,lang),theme:n.display_theme,layer:n.layer})),edges:model.edges.map(e=>({id:e.id,source:e.source,target:e.target,category:e.category,owned:!!e.owner}))};}
  async function signature(model,lang){
    const bytes=new TextEncoder().encode(JSON.stringify(shape(model,lang)));
    const subtle=globalThis.crypto?.subtle || (typeof require==='function'?require('node:crypto').webcrypto.subtle:null);
    if(!subtle)throw Error('SHA-256 is unavailable');
    return [...new Uint8Array(await subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function layout(model,lang,viz,fingerprint){
    fingerprint??=await signature(model,lang);
    const empty={fingerprint,algorithm:VERSION,language:lang,view:model.view,width:1000,height:600,main_width:1000,main_height:600,nodes:{},clusters:{},paths:{}};
    if(!Object.keys(model.nodes).length)return empty;
    const q=s=>JSON.stringify(String(s)),lines=['digraph G {','graph [rankdir=LR, splines=ortho, nodesep=.5, ranksep=1.8, pad=.7, mclimit=4, concentrate=false];','node [shape=box,fixedsize=true,label=""];'];
    for(const [k,n] of Object.entries(model.nodes)){const {w,h}=size(n,lang);lines.push(`${q(k)} [width=${(w/72).toFixed(6)},height=${(h/72).toFixed(6)}];`);}
    const groups=new Map(),mapping={};
    for(const e of model.edges){const key=JSON.stringify([e.source,e.target,e.category]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
    let i=0;for(const es of groups.values()){const e=es[0],gid='g'+i++;mapping[gid]=es;lines.push(`${q(e.source)} -> ${q(e.target)} [id=${q(gid)},constraint=true,weight=${e.owner?1:3}];`);}lines.push('}');
    const raw=JSON.parse(viz.renderString(lines.join('\n'),{format:'json',engine:'dot'})),H=Number(raw.bb.split(',')[3]),boxes={},paths={};
    for(const o of raw.objects||[]){if(!o.pos)continue;const [x,y]=o.pos.split(',').map(Number),{w,h}=size(model.nodes[o.name],lang);boxes[o.name]={x:x-w/2+80,y:H-y-h/2+80,w,h};}
    for(const o of raw.edges||[]){let pts=[];for(const op of o._draw_||[])if(op.op==='b')pts.push(...op.points.map(([x,y])=>[x+80,H-y+80]));const end=o.pos?.match(/e,([\d.-]+),([\d.-]+)/);if(end)pts.push([Number(end[1])+80,H-Number(end[2])+80]);pts=simplify(pts);for(const e of mapping[o.id])paths[e.id]=clone(pts);}
    const ground=new Set(Object.keys(model.nodes).filter(k=>model.nodes[k].layer==='ground'));
    let main=Object.keys(boxes).filter(k=>model.view==='ground'||!ground.has(k));if(!main.length)main=Object.keys(boxes);
    const ymin=Math.min(...main.map(k=>boxes[k].y))-80,MW=Math.max(...main.map(k=>boxes[k].x+boxes[k].w))+80,MH=Math.max(...main.map(k=>boxes[k].y+boxes[k].h))-ymin+80;
    const separate=ground.size&&ground.size!==Object.keys(boxes).length,dx=separate?MW+150-Math.min(...[...ground].map(k=>boxes[k].x)):0,dy=separate?80-Math.min(...[...ground].map(k=>boxes[k].y)):0;
    for(const [k,r] of Object.entries(boxes)){r.x+=separate&&ground.has(k)?dx:0;r.y+=separate&&ground.has(k)?dy:-ymin;}
    for(const e of model.edges)for(const pt of paths[e.id]){const isg=separate&&ground.has(e.source);pt[0]+=isg?dx:0;pt[1]+=isg?dy:-ymin;}
    const previous=[],obstacles=Object.values(boxes);
    for(const es of groups.values()){
      const e=es[0],base=paths[e.id];let best=base,bestcost=Infinity;
      for(const offset of [0,6,-6,12,-12,18,-18,24,-24]){
        const pts=base.map(([x,y])=>[x+offset,y+offset]);
        for(const [index,nid] of [[0,e.source],[pts.length-1,e.target]]){const r=boxes[nid],orig=base[index];if(Math.abs(orig[0]-r.x)<3||Math.abs(orig[0]-r.x-r.w)<3){pts[index][0]=orig[0];pts[index][1]=Math.max(r.y+8,Math.min(r.y+r.h-8,pts[index][1]));}else{pts[index][1]=orig[1];pts[index][0]=Math.max(r.x+8,Math.min(r.x+r.w-8,pts[index][0]));}}
        if(pairs(pts).some(([a,b])=>obstacles.some(r=>crossesRect(a,b,r,1))))continue;
        const cost=pairs(pts).reduce((sum,[a,b])=>sum+previous.reduce((s,[c,d])=>s+overlap(a,b,c,d),0),0)+Math.abs(offset)*.1;
        if(cost<bestcost){bestcost=cost;best=pts;}if(cost===0)break;
      }
      previous.push(...pairs(best));for(const relation of es)paths[relation.id]=clone(best);
    }
    return {...empty,nodes:boxes,paths,clusters:regions(model,boxes,paths),width:Math.max(...Object.values(boxes).map(r=>r.x+r.w))+80,height:Math.max(...Object.values(boxes).map(r=>r.y+r.h))+80,main_width:MW,main_height:MH};
  }
  return {VERSION,wrap,size,hull,octagon,crossesRect,shape,signature,layout};
});
