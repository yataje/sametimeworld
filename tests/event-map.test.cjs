const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),text=f=>fs.readFileSync(path.join(root,f),'utf8');
async function core(){const p=path.join(root,'src/map-core.js');assert.ok(fs.existsSync(p),'Reusable map motion core must be integrated');return import(pathToFileURL(p));}
test('shared map is outside either tab and both navigation tabs remain',()=>{
 const h=text('index.html');assert.match(h,/id="eventMapCanvas"/);
 assert.ok(h.indexOf('id="eventMapCanvas"')<h.indexOf('id="experiencePanel"'));
 for(const id of ['tabExperience','tabWeb','backToTimeline','headerSearch','leaders-europe','leaders-middle','leaders-east','leaders-americas'])assert.ok(h.includes(`id="${id}"`),id);
});
test('detail background and map opacity are independent of text opacity',()=>{
 assert.match(text('index.html'),/id="settingDetailTransparency"/);
 assert.match(text('src/main.js'),/--detail-bg-alpha/);
 assert.match(text('src/style.css'),/background:rgba\(7,13,22,var\(--detail-bg-alpha\)\)/);
});
test('event detail passes its parsed place to the shared map',()=>{
 const s=text('src/main.js');assert.match(s,/eventMap\.showEvent\(\{\.\.\.x,place:eventDetails\(x\)\.place\}\)/);
 assert.match(s,/eventMap\.showWorld\(\)/);assert.match(s,/timelineBookmark/);
});
test('v0.3 motion retains delayed zoom and direct distance-proportional translation',async()=>{
 const C=await core(),a={x:0,y:0,scale:2},b={x:90,y:-30,scale:20};
 assert.equal(C.APPROACH_TIMING.panEnd,.4);assert.equal(C.APPROACH_TIMING.zoomStart,.175);
 const early=C.cameraAt(a,b,.1,{kind:'approach'});assert.equal(early.scale,2);assert.ok(early.x>0&&early.x<90);
 const shorter=C.cameraAt(a,{...b,x:9,y:-3},.1,{kind:'approach'});assert.ok(Math.abs(early.x/shorter.x-10)<1e-10);
 const atPanEnd=C.cameraAt(a,b,.4,{kind:'approach'});assert.equal(atPanEnd.x,90);assert.equal(atPanEnd.y,-30);assert.ok(atPanEnd.scale<20);
 assert.deepEqual(C.cameraAt(a,b,1,{kind:'approach'}),b);
});
test('paths are straight, monotonic and use the shorter date-line crossing',async()=>{
 const C=await core(),a={x:170,y:-20,scale:2},b={x:-170,y:15,scale:30};let prev=a.x;
 for(let i=0;i<=100;i++){const c=C.cameraAt(a,b,i/100,{kind:'approach'});assert.ok(c.x>=prev-1e-10&&c.x<=190);assert.ok(Math.abs((c.x-170)*35-(c.y+20)*20)<1e-8);prev=c.x;}
 assert.equal(C.nearestCamera(a,b).x,190);
 assert.equal(C.nearestCamera({x:-170},{x:170}).x,-190);
});
test('five-times means area rather than each side and unknown locations fall back honestly',async()=>{
 const C=await core(),b=[10,20,20,30],e=C.expandBounds(b,5);
 assert.ok(Math.abs((e[2]-e[0])*(e[3]-e[1])-500)<1e-8);
 assert.equal(C.resolve({country:'미상',region:'중동'}).level,'region');
 assert.equal(C.resolve({country:'미상',region:'미상'}).level,'world');
 assert.deepEqual(C.resolve({country:'미국',place:'프랑스 파리',region:'유럽/아프리카'}).codes,['FRA']);
});
