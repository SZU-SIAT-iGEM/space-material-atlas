/* Camera geometry and pointer transitions, shared by the browser and Node checks. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AtlasViewportCore=api;
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const size=r=>({width:Math.max(1,r.width),height:Math.max(1,r.height)});
  const scale=(b,r)=>Math.max(b[2]/size(r).width,b[3]/size(r).height);
  function normalize(b,r){const s=scale(b,r),{width,height}=size(r);return [b[0]+b[2]/2-width*s/2,b[1]+b[3]/2-height*s/2,width*s,height*s];}
  function resize(b,previous,next){const s=scale(b,previous),{width,height}=size(next);return [b[0]+b[2]/2-width*s/2,b[1]+b[3]/2-height*s/2,width*s,height*s];}
  function world(b,r,p){const s=scale(b,r);return {x:b[0]+b[2]/2+(p.x-(r.left||0)-r.width/2)*s,y:b[1]+b[3]/2+(p.y-(r.top||0)-r.height/2)*s};}
  function anchored(b,r,from,to,factor,limits={min:0.12,max:100}){
    const anchor=world(b,r,from),s=Math.max(limits.min,Math.min(limits.max,scale(b,r)*factor)),{width,height}=size(r);
    return [anchor.x-(to.x-(r.left||0))*s,anchor.y-(to.y-(r.top||0))*s,width*s,height*s];
  }
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  class Gesture {
    constructor(){this.points=new Map();this.moved=false;this.base=null;}
    rebase(b,r){this.base={box:normalize(b,r),rect:{...r},points:[...this.points.values()].slice(0,2).map(p=>({...p}))};}
    begin(id,x,y,type,b,r){
      if(!this.points.size)this.moved=false;
      this.points.set(id,{id,x,y,type});
      if(this.points.size>1)this.moved=true;
      this.rebase(b,r);
    }
    move(id,x,y,limits){
      const point=this.points.get(id);if(!point||!this.base)return null;
      Object.assign(point,{x,y});
      const initial=this.base.points,current=initial.map(p=>this.points.get(p.id));
      if(initial.length===1){
        if(!this.moved&&distance(initial[0],current[0])<(point.type==='touch'?9:5))return null;
        this.moved=true;
        return anchored(this.base.box,this.base.rect,initial[0],current[0],1,limits);
      }
      const before=distance(...initial),after=distance(...current);
      // A near-coincident pair starts with a pan; rebasing avoids a scale spike.
      if(before<12){
        const next=anchored(this.base.box,this.base.rect,midpoint(...initial),midpoint(...current),1,limits);
        if(after>=12)this.rebase(next,this.base.rect);
        return next;
      }
      return anchored(this.base.box,this.base.rect,midpoint(...initial),midpoint(...current),before/Math.max(12,after),limits);
    }
    end(id,b,r){this.points.delete(id);if(this.points.size)this.rebase(b,r);else this.base=null;return {active:this.points.size>0,moved:this.moved};}
    cancel(){this.points.clear();this.base=null;this.moved=false;}
  }
  return {scale,normalize,resize,world,anchored,Gesture};
});
