/** Repack the existing public dataset into the lean viewer contract.
 * Keeps leader data unchanged and strips duplicated/audit-only event fields.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDescriptor,readPacket,unseal,writePacket,hash,canonical} from './seal.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function cleanDescription(value){
  const source=[];
  const seen=new Set();
  let text=String(value??'').replace(/\r\n/g,'\n');
  text=text.replace(/https?:\/\/[^\s<>]+/g,raw=>{
    const url=raw.replace(/[.,;\])}]+$/,'');
    if(url&&!seen.has(url)){seen.add(url);source.push(url);}
    return '';
  });
  const lines=text.split('\n');
  const out=[];
  for(let line of lines){
    const t=line.trim();
    if(!t){if(out.length&&out.at(-1)!=='')out.push('');continue;}
    if(/^자료\s*기록\s*\([^)]*\)\s*[:：]?\s*$/.test(t))continue;
    if(/^출처\s*[:：]?\s*$/.test(t))continue;
    out.push(line.replace(/[ \t]+$/,''));
  }
  while(out[0]==='')out.shift();
  while(out.at(-1)==='')out.pop();
  return {description:out.join('\n').replace(/\n{3,}/g,'\n\n').trim(),sources:source};
}
function nonempty(obj){
  return Object.fromEntries(Object.entries(obj).filter(([,v])=>{
    if(v===null||v===undefined||v==='')return false;
    if(Array.isArray(v)&&v.length===0)return false;
    return true;
  }));
}
function leanEvent(e){
  const cleaned=cleanDescription(e.description);
  const sources=[...new Set([...(Array.isArray(e.sources)?e.sources:[]),...cleaned.sources].filter(x=>/^https?:\/\//i.test(x)))];
  const eligible=e.day_comparison_eligible??e.eligible_for_normalized_day_index;
  return nonempty({
    id:e.id,
    date:e.date,
    date_precision:e.date_precision,
    timeline_date:e.timeline_date||e.date,
    date_label:e.date_label,
    region:e.region,
    country:e.country,
    locality:e.locality,
    map_region:e.map_region,
    category:e.category,
    title:e.title,
    description:cleaned.description,
    importance:e.importance,
    subject:e.subject,
    place:e.place,
    original_date:e.original_date,
    latitude:e.latitude,
    longitude:e.longitude,
    location_precision:e.location_precision,
    map_status:e.map_status,
    resolved_place:e.resolved_place,
    normalized_gregorian_date:e.normalized_gregorian_date,
    normalized_gregorian_range:e.normalized_gregorian_range,
    day_comparison_eligible:eligible==null?undefined:(eligible===true||eligible===1?1:0),
    war_tags:Array.isArray(e.war_tags)?e.war_tags:undefined,
    sources
  });
}
export function repack(root=ROOT){
  const descriptor=readDescriptor(root);
  if(!descriptor)throw new Error('Existing packet descriptor is missing');
  const before=unseal(readPacket(root,descriptor),descriptor);
  const leadersHash=hash(canonical(before.leaders));
  const events=before.events.map(leanEvent);
  if(events.length!==before.events.length)throw new Error('Event count changed while repacking');
  const ids=new Set(events.map(x=>x.id));
  if(ids.size!==events.length)throw new Error('Duplicate event IDs after repacking');
  const next=writePacket(root,{events,leaders:before.leaders});
  const after=unseal(readPacket(root,next),next);
  if(hash(canonical(after.leaders))!==leadersHash)throw new Error('Leader payload changed');
  const report={
    previous_revision:descriptor.r,
    revision:next.r,
    events:after.events.length,
    leaders:after.leaders.length,
    previous_hash:descriptor.d,
    content_hash:next.d,
    sample_keys:Object.keys(after.events[0]||{}),
  };
  fs.mkdirSync(path.join(root,'docs/deployment'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/deployment/lean-repack.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(repack(),null,2));
}
