/* Repeatable capacity probes. Reports failures rather than inventing a safe size limit. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../web/core.js'),L=require('../web/layout-core.js'),Viz=require('../vendor/viz.cjs');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/v7',n),'utf8'));
function inspect(m,g){
 const issues=[],boxes=Object.entries(g.nodes),segments=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const [a,r]=boxes[i],[b,s]=boxes[j];
  if(Math.max(r.x,s.x)<Math.min(r.x+r.w,s.x+s.w)-.5&&Math.max(r.y,s.y)<Math.min(r.y+r.h,s.y+s.h)-.5)issues.push({type:'node_overlap',a,b});
 }
 for(const e of m.edges){const pts=g.paths[e.id]||[];if(pts.length<2)issues.push({type:'missing_path',edge:e.id});
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];segments.push([a,b,e.id]);
   for(const [id,r] of boxes)if(L.crossesRect(a,b,r,1))issues.push({type:'node_crossing',edge:e.id,node:id});
   for(const [id,r]of Object.entries(g.clusters))if(r.title&&L.crossesRect(a,b,r.title,1))issues.push({type:'title_crossing',edge:e.id,cluster:id});
  }
 }
 let crossings=0;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const[a,b,e]=segments[i],[c,d,f]=segments[j];if(e!==f&&cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)crossings++;}
 return {nodes:boxes.length,relations:m.edges.length,width:g.width,height:g.height,area:g.width*g.height,
  line_length:Math.round(segments.reduce((v,[a,b])=>v+Math.hypot(a[0]-b[0],a[1]-b[1]),0)),crossings,issue_count:issues.length,issues:issues.slice(0,20)};
}
function synthetic(size,cycle=false){const nodes={},edges=[];
 for(let i=0;i<size;i++)nodes['n'+i]={id:'n'+i,label:{en:`Process ${i}`,zh:`工艺 ${i}`},kind:'process',theme:'water',display_theme:'water',layer:'baseline'};
 const add=(a,b)=>edges.push({id:`e${edges.length}`,source:'n'+a,target:'n'+b,category:'material',layer:'baseline'});
 for(let i=1;i<size;i++)add(Math.floor((i-1)/2),i);
 if(cycle)add(size-1,0);
 return {view:'water',nodes,edges};
}
(async()=>{
 const b=read('baseline.json'),p=read('projects.json'),cases=[];
 cases.push(['current_overview',C.project(b,p)]);
 for(const count of [1,10,50]){const q=structuredClone(p),t=p.teams[0];
  for(let i=0;i<count;i++){
   const tid='2027-growth-'+i,bundle=C.teamBundle(p,t.id),ids=new Map([[t.id,tid],...bundle.nodes.map(n=>[n.id,tid+':'+n.id]),...t.chains.map(c=>[c.id,tid+':'+c.id]),...['edges','dependencies','enhancements'].flatMap(k=>bundle[k].map(e=>[e.id,tid+':'+e.id]))]);
   const rewrite=x=>typeof x==='string'?(ids.get(x)||x):Array.isArray(x)?x.map(rewrite):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,rewrite(v)])):x;
   const next=rewrite(bundle);next.team.year=2027;next.team.name='Growth probe '+i;q.teams.push(next.team);for(const k of ['nodes','edges','dependencies','enhancements'])q[k].push(...next[k]);
  }cases.push([`add_${count}_teams`,C.project(b,q)]);
 }
 const long=C.project(b,p);for(const n of Object.values(long.nodes))if(n.owner)n.label.en+=' — extended process description with several inputs and downstream applications';cases.push(['long_labels',long]);
 cases.push(['branching_100',synthetic(100)],['cycle_100',synthetic(100,true)],['branching_300',synthetic(300)]);
 const report={engine:L.VERSION,node:process.version,platform:os.platform(),cpu:os.cpus()[0]?.model,cases:[]};
 for(const [name,model]of cases){const start=performance.now();let result;try{const g=await L.layout(model,'en',await Viz.instance());result={name,layout_ms:Math.round(performance.now()-start),...inspect(model,g)};}catch(e){result={name,nodes:Object.keys(model.nodes).length,relations:model.edges.length,layout_ms:Math.round(performance.now()-start),error:String(e)};}report.cases.push(result);console.log(JSON.stringify(result));}
 fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/layout-benchmark.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
