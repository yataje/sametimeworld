const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
async function api(){assert.ok(fs.existsSync(new URL('../scripts/publish-integrated.mjs',`file://${__filename}`)),'integrated publisher must exist');return import('../scripts/publish-integrated.mjs');}
test('publisher preserves leader payload and unions citations only for identical old events',async()=>{
 const {combineDataset}=await api(),old={events:[{id:1,date:'1805',title:'A',sources:['https://a.example/']}],leaders:[{id:9,name:'R',dates:['1800','1810']}]},events=[{id:1,date:'1805',title:'A',sources:['https://b.example/']},{id:2,date:'1806',title:'B'}];
 const d=combineDataset({events},old);assert.deepEqual(d.leaders,old.leaders);assert.deepEqual(d.events[0].sources,['https://b.example/','https://a.example/']);assert.equal(events[0].sources.length,1);
});
test('publisher refuses to drop prior events or replace leaders with an empty array',async()=>{
 const {combineDataset}=await api();assert.throws(()=>combineDataset({events:[{id:2}]},{events:[{id:1}],leaders:[{id:9}]}),/missing/i);assert.throws(()=>combineDataset({events:[{id:1}]},{events:[],leaders:[]}),/leader/i);
});
