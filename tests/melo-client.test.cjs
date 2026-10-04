const test=require('node:test'),assert=require('node:assert/strict');
test('long event is fully read in bounded requests before advancing',async()=>{
 const {createLocalReader}=await import('../src/local-reader.js');const requests=[],audios=[],moves=[];
 class Audio{constructor(){audios.push(this)}play(){return Promise.resolve()}pause(){}}
 const reader=createLocalReader({readout:()=>['가'.repeat(2500)],next:()=>null,onNavigate:id=>moves.push(id),onAudioReady:()=>{},request:async r=>{requests.push(r.text);return {id:'j'}},poll:async()=>({status:'complete',audio:'audio'}),AudioClass:Audio});
 reader.start(1);await new Promise(r=>setImmediate(r));assert.ok(requests[0].length<=2000);
 audios[0].onended();await new Promise(r=>setImmediate(r));assert.equal(requests.join(''),'가'.repeat(2500));assert.deepEqual(moves,[]);audios[1].onended();assert.equal(reader.playing,false);
});
test('Melo transport cannot select another engine and gives connection guidance',async()=>{
 const m=await import('../src/melo-client.js'),original=global.fetch;let request;
 try{
  global.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({id:'job'})}};
  await m.meloRequest('/api/synthesis',{engine:'chatterbox',text:'안녕',reference:'other.wav'});
  assert.equal(request.url,'http://127.0.0.1:8765/api/synthesis');assert.equal(request.options.credentials,'omit');
  const body=JSON.parse(request.options.body);assert.equal(body.engine,'melo');assert.equal(body.reference,'');
  global.fetch=async()=>{throw Error('offline')};await assert.rejects(()=>m.meloJSON('/api/engines'),/Melo 프로그램을 먼저 실행/);
 }finally{global.fetch=original;}
});
