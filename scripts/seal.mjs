/** Public-data packaging, NOT access control: the reader necessarily has the key. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function validate(data){
 for(const name of ['events','leaders']){
  if(!Array.isArray(data?.[name])||!data[name].length)throw new Error(name+' is empty');
  const ids=data[name].map(x=>x?.id);
  if(ids.some(x=>!Number.isSafeInteger(x))||new Set(ids).size!==ids.length)throw new Error('Invalid or duplicate record identifiers');
 }
}
export function seal(data,revision=16){
 validate(data);
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Invalid revision');
 const d=hash(canonical(data)),key=randomBytes(32),iv=randomBytes(12);
 const payload={meta:{schema:1,events_db_version:`v${revision}`,events_count:data.events.length,leaders_count:data.leaders.length,content_hash:d},...data};
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const bytes=Buffer.concat([Buffer.from('STW1'),iv,cipher.update(gzipSync(Buffer.from(canonical(payload),'utf8'),{level:9})),cipher.final(),cipher.getAuthTag()]);
 const h=hash(bytes);
 return {bytes,descriptor:{f:`t/${h.slice(0,24)}.txt`,k:key.toString('base64'),h,d,r:revision,n:[data.events.length,data.leaders.length]}};
}
export function unseal(bytes,descriptor){
 if(hash(bytes)!==descriptor.h||bytes.subarray(0,4).toString()!=='STW1')throw new Error('Packet integrity check failed');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(descriptor.k,'base64'),bytes.subarray(4,16));
 decipher.setAuthTag(bytes.subarray(-16));
 const compressed=Buffer.concat([decipher.update(bytes.subarray(16,-16)),decipher.final()]);
 const data=JSON.parse(gunzipSync(compressed,{maxOutputLength:128*1024*1024}).toString('utf8'));
 validate(data);
 if(hash(canonical({events:data.events,leaders:data.leaders}))!==descriptor.d)throw new Error('Packet content check failed');
 return data;
}
export function readDescriptor(root){
 const p=path.join(root,'src/packet-config.js');
 if(!fs.existsSync(p))return null;
 return JSON.parse(fs.readFileSync(p,'utf8').match(/export default ([\s\S]*);\s*$/)?.[1]||'null');
}
export function packetFiles(descriptor){
 const paths=descriptor.parts??[descriptor.f];
 if(!Array.isArray(paths)||!paths.length||paths.length>4096||paths.some(p=>typeof p!=='string'||!/^t\/[a-f0-9]{24}\.txt$/.test(p)))throw new Error('Invalid packet part path');
 return paths;
}
export function readPacket(root,descriptor){
 const encoded=packetFiles(descriptor).map(name=>fs.readFileSync(path.join(root,'public',name),'utf8').trim()).join('');
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4)throw new Error('Invalid Base64 packet');
 return Buffer.from(encoded,'base64');
}
export function writePacket(root,data){
 validate(data);
 const d=hash(canonical(data)),old=readDescriptor(root);let bytes,descriptor;
 const chunkSize=192*1024-(192*1024)%4;
 if(old?.d===d){
  bytes=readPacket(root,old);unseal(bytes,old);
  const alreadyChunked=Array.isArray(old.parts)&&old.parts.length>1&&packetFiles(old).every(name=>fs.statSync(path.join(root,'public',name)).size<=chunkSize);
  if(alreadyChunked||bytes.toString('base64').length<=chunkSize)return old;
  descriptor={...old};
 }else ({bytes,descriptor}=seal(data,(old?.r||15)+1));
 const encoded=bytes.toString('base64');
 const folder=path.join(root,'public','t');fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(path.join(root,'src'),{recursive:true});
 descriptor.parts=[];
 for(let offset=0;offset<encoded.length;offset+=chunkSize){const part=encoded.slice(offset,offset+chunkSize),name=`t/${hash(part).slice(0,24)}.txt`;fs.writeFileSync(path.join(root,'public',name),part);descriptor.parts.push(name);}
 descriptor.f=descriptor.parts[0];
 unseal(readPacket(root,descriptor),descriptor);
 const config=path.join(root,'src/packet-config.js'),temp=config+'.tmp';
 fs.writeFileSync(temp,'// Generated public reader descriptor. Not a secret.\nexport default '+JSON.stringify(descriptor)+';\n');fs.renameSync(temp,config);
 const keep=new Set(packetFiles(descriptor).map(name=>path.basename(name)));
 for(const name of fs.readdirSync(folder))if(name.endsWith('.txt')&&!keep.has(name))fs.unlinkSync(path.join(folder,name));
 const legacy=path.join(root,'public','p');if(fs.existsSync(legacy))fs.rmSync(legacy,{recursive:true,force:true});
 return descriptor;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const data=JSON.parse(fs.readFileSync(0,'utf8'));const d=writePacket(root,data);
  console.log(`Published-data v${d.r}: ${d.n[0]} events, ${d.n[1]} leader tenures; ${d.d.slice(0,12)}`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}