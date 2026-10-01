const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),text=f=>fs.readFileSync(path.join(root,f),'utf8');
async function core(){return import(pathToFileURL(path.join(root,'src/map-core.js')));}
test('shared map remains outside tabs and detail sends event data to it',()=>{
 const h=text('index.html'),s=text('src/main.js');assert.match(h,/id="eventMapCanvas"/);assert.ok(h.indexOf('id="eventMapCanvas"')<h.indexOf('id="experiencePanel"'));
 assert.match(s,/eventMap\.showEvent\(\{\.\.\.x,place:eventDetails\(x\)\.place\}\)/);assert.match(s,/eventMap\.showWorld\(\)/);
});
test('point renderer imports coordinate resolver and does not paint a selected polygon',()=>{
 const s=text('src/event-map.js');assert.match(s,/resolvePoint/);assert.match(s,/ctx\.arc\(/);assert.doesNotMatch(s,/fillStyle=highlighted\(f\)/);assert.match(s,/역사 국경선은 사용하지 않습니다/);
});
test('motion keeps delayed zoom and shortest wrapped path',async()=>{
 const C=await core(),a={x:0,y:0,scale:2},b={x:90,y:-30,scale:20};assert.equal(C.APPROACH_TIMING.panEnd,.4);assert.equal(C.APPROACH_TIMING.zoomStart,.175);
 const early=C.cameraAt(a,b,.1,{kind:'approach'});assert.equal(early.scale,2);assert.ok(early.x>0&&early.x<90);assert.deepEqual(C.cameraAt(a,b,1,{kind:'approach'}),b);
 assert.equal(C.nearestCamera({x:170},{x:-170}).x,190);
});
test('point resolver knows historical aliases and representative admin areas',async()=>{
 const P=await import(pathToFileURL(path.join(root,'src/point-resolver.js')));
 const seoul=P.resolvePoint({locality:'한양',country:'조선',region:'동아시아/오세아니아'});assert.ok(Math.abs(seoul.lat-37.54)<.2);
 const st=P.resolvePoint({locality:'스탈린그라드',country:'러시아',region:'유럽/아프리카'});assert.ok(Math.abs(st.lon-44.5)<.3);
 const ca=P.resolvePoint({locality:'캘리포니아주',country:'미국',region:'아메리카'});assert.equal(ca.precision,'admin1');
});
test('unknown locations still get an honest country or region representative point',async()=>{
 const P=await import(pathToFileURL(path.join(root,'src/point-resolver.js')));
 assert.equal(P.resolvePoint({country:'프랑스',region:'유럽/아프리카'}).precision,'country');
 assert.equal(P.resolvePoint({country:'미상',region:'중동'}).precision,'region');
});
