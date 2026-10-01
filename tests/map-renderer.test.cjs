const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const path=require('node:path');
async function harness({noCanvas=false,reduced=false}={}){
 let now=0,id=0;const frames=new Map(),listeners=new Map(),classes=new Set();
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={dataset:{},getContext:()=>noCanvas?null:ctx},note={},motion={},label={};
 const media={matches:reduced,addEventListener(){},removeEventListener(){}};
 global.window={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 global.document={body:{classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}},querySelector:()=>null};
 global.innerWidth=1440;global.innerHeight=900;global.devicePixelRatio=1;global.matchMedia=()=>media;global.Path2D=class{moveTo(){}lineTo(){}closePath(){}};
 Object.defineProperty(global,'performance',{value:{now:()=>now},configurable:true});
 global.requestAnimationFrame=f=>{frames.set(++id,f);return id;};global.cancelAnimationFrame=k=>frames.delete(k);
 const {createEventMap}=await import(pathToFileURL(path.join(__dirname,'../src/event-map.js'))+'?t='+Math.random());
 const errors=[];const api=createEventMap({canvas,note,motion,label,onFailure:e=>errors.push(e)});
 return {api,canvas,note,motion,label,errors,classes,media,frames,listeners,advance(ms){now+=ms;const batch=[...frames.values()];frames.clear();for(const f of batch)f(now);}};
}
test('detail map is point-only and keeps 2000ms approach / 500ms return',async()=>{
 const h=await harness(),world=h.api.snapshot().camera;
 h.api.showEvent({id:1,country:'이집트',region:'유럽/아프리카'});assert.equal(h.api.snapshot().animation.durationMs,2000);assert.ok(h.api.snapshot().point);assert.equal(h.canvas.dataset.level,'point');
 h.advance(2000);assert.equal(h.api.snapshot().animation,null);assert.match(h.note.textContent,/대표 좌표/);
 h.api.showWorld();assert.equal(h.api.snapshot().animation.durationMs,500);h.advance(500);assert.deepEqual(h.api.snapshot().camera,world);assert.equal(h.api.snapshot().point,null);h.api.destroy();
});
test('historical aliases share modern representative coordinates',async()=>{
 const h=await harness();h.api.showEvent({id:2,locality:'한양',country:'조선',region:'동아시아/오세아니아'});
 const a=h.api.snapshot().point;assert.ok(Math.abs(a.lat-37.54)<.2&&Math.abs(a.lon-126.99)<.2);
 h.api.showEvent({id:3,locality:'스탈린그라드',country:'러시아',region:'유럽/아프리카'});
 const b=h.api.snapshot().point;assert.ok(Math.abs(b.lat-48.71)<.2&&Math.abs(b.lon-44.50)<.2);h.api.destroy();
});
test('admin area names resolve to one representative point rather than a filled polygon',async()=>{
 const h=await harness();h.api.showEvent({id:4,locality:'캘리포니아주',country:'미국',region:'아메리카'});
 const p=h.api.snapshot().point;assert.equal(p.precision,'admin1');assert.ok(Math.abs(p.lat-36.75)<1);assert.ok(Math.abs(p.lon+119.59)<1);assert.equal(h.canvas.dataset.level,'point');h.api.destroy();
});
test('unknown places fall back to country or region points',async()=>{
 const h=await harness();h.api.showEvent({id:5,country:'프랑스',region:'유럽/아프리카'});assert.equal(h.api.snapshot().point.precision,'country');
 h.api.showEvent({id:6,country:'미상',region:'중동'});assert.equal(h.api.snapshot().point.precision,'region');h.api.destroy();
});
test('reduced motion and resize keep the point map stable',async()=>{
 const h=await harness({reduced:true});h.api.showEvent({id:7,locality:'서울',country:'대한민국',region:'동아시아/오세아니아'});assert.equal(h.api.snapshot().animation,null);
 global.innerWidth=390;global.innerHeight=844;h.listeners.get('resize')();h.advance(1);assert.equal(h.api.snapshot().width,390);assert.ok(h.api.snapshot().point);h.api.destroy();
});
test('lack of Canvas never breaks text UI',async()=>{
 const h=await harness({noCanvas:true});assert.equal(h.api.snapshot().available,false);assert.doesNotThrow(()=>h.api.showEvent({id:1,country:'미국'}));assert.match(h.note.textContent||'',/표시하지 못/);
});
