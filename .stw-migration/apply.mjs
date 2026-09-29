import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {readDescriptor,unseal,writePacket} from '../scripts/seal.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const deltaB64=fs.readFileSync(path.join(root,'.stw-migration','delta.b64'),'utf8').trim();
const raw=gunzipSync(Buffer.from(deltaB64,'base64'));
const rawHash=createHash('sha256').update(raw).digest('hex');
if(rawHash!=='154f0913ea88079d4144377eec908cb0077b2fe41588a7d36ff14eae09de12de'){
  throw new Error('delta integrity check failed: '+rawHash);
}
const delta=JSON.parse(raw.toString('utf8'));
if(delta.length!==390)throw new Error('expected 390 delta events, got '+delta.length);

const descriptor=readDescriptor(root);
const oldFile=descriptor.f;
const data=unseal(fs.readFileSync(path.join(root,'public',oldFile)),descriptor);
if(data.events.length!==4470||data.leaders.length!==6158){
  throw new Error('unexpected source counts '+data.events.length+'/'+data.leaders.length);
}
const ids=new Set(data.events.map(x=>x.id));
for(const e of delta){
  if(ids.has(e.id))throw new Error('duplicate delta id '+e.id);
  data.events.push(e);
  ids.add(e.id);
}
data.events.sort((a,b)=>a.id-b.id);
if(data.events.length!==4860)throw new Error('expected 4860 events, got '+data.events.length);

const next=writePacket(root,{events:data.events,leaders:data.leaders});
if(next.n[0]!==4860||next.n[1]!==6158)throw new Error('published count mismatch');
const check=unseal(fs.readFileSync(path.join(root,'public',next.f)),next);
if(check.events.length!==4860||check.leaders.length!==6158)throw new Error('post-write verification failed');

console.log(JSON.stringify({oldFile,newFile:next.f,revision:next.r,counts:next.n,hash:next.h,dataHash:next.d}));
