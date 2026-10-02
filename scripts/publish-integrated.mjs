/** Publish a master-derived event snapshot, never replace the existing leader dataset. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {readDescriptor,readPacket,unseal,writePacket,hash,canonical} from './seal.mjs';
export function combineDataset(snapshot,previous){
 if(!Array.isArray(snapshot?.events)||!snapshot.events.length)throw new Error('Missing integrated events');
 if(!Array.isArray(previous?.leaders)||!previous.leaders.length)throw new Error('Existing leader dataset must be preserved');
 const ids=new Set(snapshot.events.map(x=>x.id));
 if(ids.size!==snapshot.events.length)throw new Error('Duplicate integrated identifiers');
 for(const e of previous.events||[])if(!ids.has(e.id))throw new Error(`Missing existing event ${e.id}`);
 const old=new Map((previous.events||[]).map(x=>[x.id,x]));
 const events=snapshot.events.map(e=>{
  const before=old.get(e.id);
  const extra=before?.date===e.date&&before?.title===e.title?before.sources||[]:[];
  return {...e,sources:[...new Set([...(e.sources||[]),...extra])]};
 });
 return {events,leaders:previous.leaders};
}
export function publish(root){
 const input=path.join(root,'data/integrated/events.web.json.gz'),snapshot=JSON.parse(gunzipSync(fs.readFileSync(input),{maxOutputLength:128*1024*1024}));
 if(snapshot.meta?.schema!=='stw-events-export-2'||snapshot.meta.events_count!==snapshot.events.length)throw new Error('Unsupported integrated snapshot');
 const old=readDescriptor(root);if(!old)throw new Error('No existing packet; refusing to discard leaders');
 const previous=unseal(readPacket(root,old),old),leaderHash=hash(canonical(previous.leaders));
 const data=combineDataset(snapshot,previous),descriptor=writePacket(root,data),actual=unseal(readPacket(root,descriptor),descriptor);
 if(hash(canonical(actual.leaders))!==leaderHash)throw new Error('Leader payload changed');
 const report={page_version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,data_version:`v${descriptor.r}`,events:actual.events.length,leaders:actual.leaders.length,leaders_sha256:leaderHash,data_hash:descriptor.d,master_sha256:snapshot.meta.source_master_sha256,export_sha256:hash(fs.readFileSync(input)),coordinate_points:actual.events.filter(x=>x.latitude!=null&&x.longitude!=null).length,unclassified:actual.events.filter(x=>!['유럽/아프리카','중동','동아시아/오세아니아','아메리카'].includes(x.region)).length};
 fs.mkdirSync(path.join(root,'docs/deployment'),{recursive:true});fs.writeFileSync(path.join(root,'docs/deployment/integrated-release.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(publish(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')),null,2));
