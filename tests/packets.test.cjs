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
 assert.match(a.descriptor.f,/^t\/[a-f0-9]{24}\.txt$/);assert.notEqual(a.descriptor.f,b.descriptor.f);
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
test('large authenticated packets publish as bounded parts without changing data',async()=>{
 const s=await import('../scripts/seal.mjs');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stw-parts-'));const data={events:[{id:1,title:require('node:crypto').randomBytes(300000).toString('base64')}],leaders:fixture.leaders};
 try{const d=s.writePacket(temp,data);assert.ok(Array.isArray(d.parts)&&d.parts.length>1,'Large packets require bounded parts');for(const name of d.parts){assert.match(name,/^t\/[a-f0-9]{24}\.txt$/);assert.ok(fs.statSync(path.join(temp,'public',name)).size<=192*1024);}assert.deepEqual(s.unseal(s.readPacket(temp,d),d).events,data.events);assert.deepEqual(s.writePacket(temp,data),d);}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('legacy packet migration preserves ciphertext, key and data revision',async()=>{
 const s=await import('../scripts/seal.mjs'),data={events:[{id:1,title:require('node:crypto').randomBytes(300000).toString('base64')}],leaders:fixture.leaders},temp=fs.mkdtempSync(path.join(os.tmpdir(),'stw-migration-'));
 try{const old=s.seal(data,19);fs.mkdirSync(path.join(temp,'public/t'),{recursive:true});fs.mkdirSync(path.join(temp,'src'));fs.writeFileSync(path.join(temp,'public',old.descriptor.f),old.bytes.toString('base64'));fs.writeFileSync(path.join(temp,'src/packet-config.js'),'export default '+JSON.stringify(old.descriptor)+';\n');const d=s.writePacket(temp,data);assert.ok(d.parts?.length>1);for(const k of ['h','d','k','r'])assert.equal(d[k],old.descriptor[k]);assert.deepEqual(s.readPacket(temp,d),old.bytes);}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('browser combines ordered parts before authenticated decoding and rejects bad paths',async()=>{
 const s=await import('../scripts/seal.mjs'),c=await import('../src/packet-codec.js'),sealed=s.seal(fixture,19);assert.equal(typeof c.fetchPacketBytes,'function');
 const encoded=sealed.bytes.toString('base64'),a=encoded.slice(0,24),b=encoded.slice(24),one='t/'+s.hash(a).slice(0,24)+'.txt',two='t/'+s.hash(b).slice(0,24)+'.txt',d={...sealed.descriptor,parts:[one,two]},calls=[];
 const bytes=await c.fetchPacketBytes(d,async name=>{calls.push(name);return name===one?a:b;});assert.deepEqual(calls,[one,two]);assert.deepEqual((await c.decodePacket(bytes,d)).events,fixture.events);
 await assert.rejects(c.fetchPacketBytes({...d,parts:['https://example.org/evil']},async()=>a),/path|주소|경로/);
 const bad=Uint8Array.from(bytes);bad[20]^=1;await assert.rejects(c.decodePacket(bad,d));
});