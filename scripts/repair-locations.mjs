import fs from 'node:fs';import path from 'node:path';import {gzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';
import {resolveLocation,geographyStats} from '../src/location-resolver.js';
import {readDescriptor,readPacket,unseal,writePacket,canonical,hash} from './seal.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identity=e=>[e.id,e.date,e.title,e.description||'',e.place||'',e.locality||'',e.country||''];
export function planLocations(data){
 const rows=[],stats={before:0,after:0,recovered:0,refined:0,withheld:0,precision:{},method:{}};
 const events=data.events.map(e=>{
  const p=resolveLocation(e),before=e.latitude!=null&&e.longitude!=null;if(before)stats.before++;
  if(p){if(['region','world','continent'].includes(p.precision)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw new Error('Unsafe point '+e.id);stats.after++;if(!before)stats.recovered++;stats.precision[p.precision]=(stats.precision[p.precision]||0)+1;stats.method[p.method]=(stats.method[p.method]||0)+1;}else stats.withheld++;
  const fields={latitude:p?.lat??null,longitude:p?.lon??null,resolved_place:p?.name??null,location_precision:p?.precision??null,map_status:p?.status||'unresolved',coordinate_status:p?.status||null,location_resolution_method:p?.method||'country_or_location_unresolved',location_policy_version:2,location_country_code:p?.country_code??null,location_place_id:p?.place_id??null,location_source:p?.source||null,location_evidence:p?.matched||null,location_note:p?.note||(String(e.country||'').trim()?'복수 장소 또는 국가 식별이 불명확하여 단일 대표점을 선택하지 않았습니다.':'국가와 발생 장소를 식별하지 못했습니다.')};
  if(before&&p&&(Math.abs(e.latitude-p.lat)>1e-6||Math.abs(e.longitude-p.lon)>1e-6))stats.refined++;
  rows.push({id:e.id,fields});return {...e,...fields};
 });
 if(hash(canonical(data.leaders))!==hash(canonical(data.leaders)))throw new Error('Leader preservation failure');
 for(let i=0;i<events.length;i++)if(JSON.stringify(identity(events[i]))!==JSON.stringify(identity(data.events[i])))throw new Error('Event content changed');
 return {events,leaders:data.leaders,rows,stats};
}
function main(){
 const old=readDescriptor(ROOT),before=unseal(readPacket(ROOT,old),old),result=planLocations(before);
 const base=before.events.map(identity).sort((a,b)=>a[0]-b[0]);
 const patch={schema:'stw-location-update-2',version:2,base_data_hash:old.d,identity_sha256:hash(JSON.stringify(base)),count:base.length,rows:result.rows};
 fs.mkdirSync(path.join(ROOT,'data/location'),{recursive:true});fs.mkdirSync(path.join(ROOT,'docs/location'),{recursive:true});
 fs.writeFileSync(path.join(ROOT,'data/location/location-update.json.gz'),gzipSync(JSON.stringify(patch),{level:9,mtime:0}));
 const unresolved=result.events.filter(e=>e.latitude==null),fields=e=>({id:e.id,title:e.title,country:e.country,place:e.place,locality:e.locality,latitude:e.latitude,longitude:e.longitude,resolved_place:e.resolved_place,precision:e.location_precision,method:e.location_resolution_method});
 const report={policy_version:2,source_data_version:old.r,events:result.events.length,leaders:before.leaders.length,leaders_sha256:hash(canonical(before.leaders)),identity_sha256:patch.identity_sha256,reference:geographyStats(),...result.stats,examples:result.events.filter(e=>/일본군의 부산 상륙/.test(e.title)||[1,159,160,2193].includes(e.id)).map(fields),unresolved_countries:Object.entries(unresolved.reduce((a,e)=>(a[e.country]=(a[e.country]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]).slice(0,50),unresolved_samples:unresolved.slice(0,30).map(fields)};
 fs.writeFileSync(path.join(ROOT,'docs/location/repair-report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(ROOT,'_local','resolved-events.json'),JSON.stringify({events:result.events,leaders:result.leaders}));
 if(process.argv.includes('--publish')){
  const descriptor=writePacket(ROOT,{events:result.events,leaders:before.leaders});const actual=unseal(readPacket(ROOT,descriptor),descriptor);
  if(hash(canonical(actual.leaders))!==report.leaders_sha256)throw new Error('Leader payload changed after writing');
  if(actual.events.length!==before.events.length||new Set(actual.events.map(e=>e.id)).size!==before.events.length)throw new Error('Event lost');
  report.data_version=descriptor.r;report.data_hash=descriptor.d;
  const rp=path.join(ROOT,'docs/deployment/integrated-release.json'),release=JSON.parse(fs.readFileSync(rp));Object.assign(release,{page_version:'0.8.1',data_version:`v${descriptor.r}`,data_hash:descriptor.d,coordinate_points:report.after,location_policy_version:2,master_update:'data/location/location-update.json.gz'});fs.writeFileSync(rp,JSON.stringify(release,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'docs/location/repair-report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify({reference:report.reference,before:report.before,after:report.after,recovered:report.recovered,refined:report.refined,withheld:report.withheld,precision:report.precision,examples:report.examples},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
