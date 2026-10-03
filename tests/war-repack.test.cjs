const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),test=require('node:test'),assert=require('node:assert/strict');
test('lean repack preserves audited war tags and existing leader payload',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'stw-tags-repack-'));
 try{
  const s=await import('../scripts/seal.mjs'),r=await import('../scripts/repack-lean.mjs');
  const leaders=[{id:1,name:'보존 지도자',start:'1940',end:'1945'}];
  s.writePacket(root,{events:[{id:2276,date:'1942-07',title:'엘 알라메인',war_tags:['제2차 세계대전','북아프리카 전역']}],leaders});
  r.repack(root);const d=s.readDescriptor(root),result=s.unseal(s.readPacket(root,d),d);
  assert.deepEqual(result.events[0].war_tags,['제2차 세계대전','북아프리카 전역']);assert.deepEqual(result.leaders,leaders);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
