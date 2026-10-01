import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDescriptor,readPacket,unseal,writePacket} from './seal.mjs';
import {resolvePoint} from '../src/point-resolver.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const recoveryDir=path.join(root,'.recovery');
fs.mkdirSync(recoveryDir,{recursive:true});

const descriptor=readDescriptor(root);
if(!descriptor)throw new Error('packet descriptor missing');
const payload=unseal(readPacket(root,descriptor),descriptor);
const sourceVersion=payload?.meta?.events_db_version||('v'+descriptor.r);
const precisionCounts={};
let changed=0, explicitPlaceFallbacks=0;

const events=payload.events.map(event=>{
  const basis={...event,latitude:null,longitude:null,map_region:''};
  const point=resolvePoint(basis);
  const next={...event};
  const mapRegion=String(point?.name||event.map_region||event.locality||event.place||event.country||'').trim();
  const latitude=Number(point?.lat);
  const longitude=Number(point?.lon);
  const precision=String(point?.precision||'').trim();
  if(mapRegion)next.map_region=mapRegion;
  if(Number.isFinite(latitude))next.latitude=Number(latitude.toFixed(6));
  if(Number.isFinite(longitude))next.longitude=Number(longitude.toFixed(6));
  if(precision)next.location_precision=precision;
  if(next.map_region!==event.map_region||next.latitude!==event.latitude||next.longitude!==event.longitude||next.location_precision!==event.location_precision)changed++;
  precisionCounts[next.location_precision||'unknown']=(precisionCounts[next.location_precision||'unknown']||0)+1;
  if(String(event.place||'').trim()&&['country','region','world'].includes(next.location_precision))explicitPlaceFallbacks++;
  return next;
});
const data={events,leaders:payload.leaders};
fs.writeFileSync(path.join(recoveryDir,'recovered-data.json'),JSON.stringify(data));
const newDescriptor=writePacket(root,data);
const report={
  source_data_version:sourceVersion,
  recovered_data_version:'v'+newDescriptor.r,
  events:events.length,
  leaders:payload.leaders.length,
  records_enriched:changed,
  precision_counts:precisionCounts,
  explicit_place_fallbacks:explicitPlaceFallbacks,
  generated_at:new Date().toISOString()
};
fs.writeFileSync(path.join(recoveryDir,'recovery-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
