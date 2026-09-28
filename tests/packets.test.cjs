const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const fixture={events:[{id:1,title:'원본 사건 한글',locality:'일드프랑스'}],leaders:[{id:2,name:'한글 지도자',start:'1850',end:'1851-02'}]};
test('authenticated encrypted packet round-trips through browser-native decoding',async()=>{
 const s=await import('../scripts/seal.mjs');const c=await import('../src/packet-codec.js');
 const result=s.seal(fixture,16);
 assert.equal(result.bytes.includes(Buffer.from('원본 사건 한글')),false);
 const decoded=await c.decodePacket(result.bytes,result.descriptor);
 assert.deepEqual(decoded.events,fixture.events);assert.deepEqual(decoded.leaders,fixture.leaders);
 assert.equal(decoded.meta.events_db_version,'v16');
});
test('changed ciphertext and wrong keys are rejected rather than displaying corrupt data',async()=>{
 const s=await import('../scripts/seal.mjs');const c=await import('../src/packet-codec.js');const p=s.seal(fixture,16);
 const bad=Buffer.from(p.bytes);bad[20]^=1;
 await assert.rejects(c.decodePacket(bad,p.descriptor));
 await assert.rejects(c.decodePacket(p.bytes,{...p.descriptor,k:Buffer.alloc(32,3).toString('base64')}));
});
test('every new encryption uses a fresh nonce and opaque content-addressed name',async()=>{
 const s=await import('../scripts/seal.mjs');const a=s.seal(fixture,16),b=s.seal(fixture,16);
 assert.notDeepEqual(a.bytes.subarray(4,16),b.bytes.subarray(4,16));
 assert.match(a.descriptor.f,/^p\/[a-f0-9]{24}\.bin$/);assert.notEqual(a.descriptor.f,b.descriptor.f);
});
test('same content does not regenerate a packet; changed content increments the public revision',async()=>{
 const s=await import('../scripts/seal.mjs');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stw-packet-'));
 try{
  const first=s.writePacket(temp,fixture),again=s.writePacket(temp,fixture);
  assert.deepEqual(again,first);
  const next=s.writePacket(temp,{...fixture,events:[...fixture.events,{id:3,title:'다음 사건'}]});
  assert.equal(next.r,first.r+1);assert.notEqual(next.f,first.f);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('empty input is rejected before a usable release is replaced',async()=>{
 const s=await import('../scripts/seal.mjs');
 assert.throws(()=>s.seal({events:[],leaders:fixture.leaders},16),/empty|비어/i);
});
test('web sources have no legacy endpoint or raw source filename',()=>{
 for(const name of ['index.html','src/main.js','src/leaders.js']){
  const value=fs.readFileSync(path.join(root,name),'utf8');
  assert.doesNotMatch(value,/firebasedatabase|firebaseio|sametimeworld-db-filename/i);
  assert.equal(value.includes('.'+'db'),false,name);
 }
});
test('normalization and detail retain the geographic locality from the supplied records',()=>{
 const value=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
 assert.match(value,/locality:String\(x.locality/);assert.match(value,/\['지역',x.locality\]/);
});
