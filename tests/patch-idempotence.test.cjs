const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),test=require('node:test'),assert=require('node:assert/strict');
test('build-time display patch can run repeatedly on already restored current source',()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'stw-patch-'));
 try{
  for(const name of ['scripts/patch-display-country.mjs','src/main.js','package.json']){const dest=path.join(temp,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
  for(let i=0;i<2;i++)cp.execFileSync(process.execPath,[path.join(temp,'scripts/patch-display-country.mjs')],{stdio:'pipe'});
  const source=fs.readFileSync(path.join(temp,'src/main.js'),'utf8');assert.equal((source.match(/const INTERNAL_DETAIL_LABEL=/g)||[]).length,1);
  cp.execFileSync(process.execPath,['--check',path.join(temp,'src/main.js')],{stdio:'pipe'});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
