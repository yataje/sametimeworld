const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const path=require('node:path');
async function harness({noCanvas=false,reduced=false}={}){
 let now=0,id=0;const frames=new Map(),listeners=new Map(),classes=new Set();
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={dataset:{},getContext:()=>noCanvas?null:ctx},note={},motion={},label={};
 const media={matches:reduced,addEventListener(){},removeEventListener(){}};
 global.window={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 global.document={body:{classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}}};
 global.innerWidth=1440;global.innerHeight=900;global.devicePixelRatio=1;
 global.matchMedia=()=>media;global.Path2D=class{moveTo(){}lineTo(){}closePath(){}};
 Object.defineProperty(global,'performance',{value:{now:()=>now},configurable:true});
 global.requestAnimationFrame=f=>{frames.set(++id,f);return id;};global.cancelAnimationFrame=k=>frames.delete(k);
 const {createEventMap}=await import(pathToFileURL(path.join(__dirname,'../src/event-map.js')));
 const errors=[];const api=createEventMap({canvas,note,motion,label,onFailure:e=>errors.push(e)});
 return {api,canvas,note,motion,label,errors,classes,media,frames,listeners,advance(ms){now+=ms;const batch=[...frames.values()];frames.clear();for(const f of batch)f(now);}};
}
const egypt={id:135,place:'이집트',country:'이집트',region:'유럽/아프리카'};
test('approach is 2000ms, return is 500ms and world state is restored',async()=>{
 const h=await harness();const world=h.api.snapshot().camera;
 h.api.showEvent(egypt);assert.equal(h.api.snapshot().animation.durationMs,2000);
 h.advance(100);assert.equal(h.api.snapshot().camera.scale,world.scale);
 h.advance(1900);assert.equal(h.api.snapshot().animation,null);assert.deepEqual(h.api.snapshot().selection.codes,['EGY']);
 h.api.showWorld();assert.equal(h.api.snapshot().animation.durationMs,500);h.advance(500);
 assert.deepEqual(h.api.snapshot().camera,world);assert.equal(h.api.snapshot().selection,null);assert.equal(h.canvas.dataset.motion,'idle');h.api.destroy();
});
test('changing an event replans from the currently visible frame, not the old destination',async()=>{
 const h=await harness();h.api.showEvent(egypt);h.advance(350);const visible=h.api.snapshot().camera;
 h.api.showEvent({id:22,country:'프랑스',region:'유럽/아프리카'});
 assert.deepEqual(h.api.snapshot().animation.from,visible);assert.equal(h.frames.size,1);
 h.advance(2000);assert.deepEqual(h.api.snapshot().selection.codes,['FRA']);assert.ok(h.api.snapshot().metrics.some(m=>m.cancelled));h.api.destroy();
});
test('return and immediate re-entry cannot be overwritten by a stale callback',async()=>{
 const h=await harness();h.api.showEvent(egypt);h.advance(2000);h.api.showWorld();h.advance(200);
 h.api.showEvent({id:83,country:'조선',region:'동아시아/오세아니아'});h.advance(2000);
 assert.equal(h.api.snapshot().view,'detail');assert.deepEqual(h.api.snapshot().selection.codes,['KOR','PRK']);assert.equal(h.frames.size,0);h.api.destroy();
});
test('missing country falls back to the recorded region; globally unknown stays world',async()=>{
 const h=await harness();h.api.showEvent({id:1,country:'미상',region:'중동'});assert.equal(h.api.snapshot().selection.level,'region');
 h.api.showEvent({id:2,country:'미상',region:'미상'});assert.equal(h.api.snapshot().selection.level,'world');assert.match(h.note.textContent,/영역 강조 없음/);h.api.destroy();
});
test('reduced motion immediately shows the final camera without queued frames',async()=>{
 const h=await harness({reduced:true});h.api.showEvent(egypt);assert.equal(h.api.snapshot().animation,null);assert.equal(h.frames.size,0);h.api.showWorld();assert.equal(h.api.snapshot().view,'timeline');h.api.destroy();
});
test('resize settles the selected event and cancels the old camera tween',async()=>{
 const h=await harness();h.api.showEvent(egypt);h.advance(450);global.innerWidth=390;global.innerHeight=844;
 h.listeners.get('resize')();h.advance(20);assert.equal(h.api.snapshot().width,390);assert.equal(h.api.snapshot().animation,null);assert.equal(h.api.snapshot().eventId,135);h.api.destroy();
});
test('lack of Canvas never breaks the text UI and shows an explicit map-unavailable note',async()=>{
 const h=await harness({noCanvas:true});assert.equal(h.api.snapshot().available,false);assert.doesNotThrow(()=>h.api.showEvent(egypt));assert.ok(!h.classes.has('event-map-ready'));assert.match(h.note.textContent||'',/표시하지 못/);
});
test('subregion selection keeps country scope as parent and returns to the same rotated overview',async()=>{
 const h=await harness(),world=h.api.snapshot().camera;
 h.api.showEvent({id:2109,country:'미국',place:'캘리포니아 샌버너디노',region:'아메리카'});
 assert.equal(h.api.snapshot().selection.subregionId,'US-CA');assert.equal(h.canvas.dataset.level,'subregion');
 assert.equal(h.canvas.dataset.subregion,'US-CA');assert.match(h.note.textContent,/캘리포니아주/);
 h.advance(2000);assert.ok(h.api.snapshot().camera.scale>world.scale*5);h.api.showWorld();h.advance(500);
 assert.deepEqual(h.api.snapshot().camera,world);assert.equal(h.errors.length,0);h.api.destroy();
});
test('description-derived geography survives resize and cancelled transitions',async()=>{
 const h=await harness();h.api.showEvent({id:1078,country:'미국',region:'아메리카',description:'미국 캘리포니아 윌로우스에서 비행사 양성을 추진했다.'});
 assert.equal(h.api.snapshot().selection.basis,'description');h.advance(200);
 global.innerWidth=390;global.innerHeight=844;h.listeners.get('resize')();h.advance(10);
 assert.equal(h.api.snapshot().selection.subregionId,'US-CA');assert.equal(h.errors.length,0);h.api.destroy();
});
