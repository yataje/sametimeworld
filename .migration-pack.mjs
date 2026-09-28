import fs from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {hash,canonical,writePacket} from './scripts/seal.mjs';
const expected='a486d311c1b5651ab57cd31e1a98fb179f5b3ba0dd846082498514cdc0b83f70';
const patch=fs.readFileSync('.migration-delta.bin');
if(hash(patch)!=='e123de19182dfd2a310a648f8042d33e248f97a171cce9692da82c6441f57527')throw new Error('Migration transfer integrity mismatch');
const decipher=createDecipheriv('aes-256-gcm',Buffer.from('WBkjLLehdcrxVTP3/oql8U30hFR+obIOPw1x1thhm8s=','base64'),patch.subarray(0,12));
decipher.setAuthTag(patch.subarray(-16));
const groups=JSON.parse(gunzipSync(Buffer.concat([decipher.update(patch.subarray(12,-16)),decipher.final()])).toString('utf8'));
const fields={events:['id','date','region','importance','country','category','title','description','subject','place','original_date','verification','locality'],leaders:['id','person_id','polity_id','country_en','country','polity_en','polity','name_en','name_ko','name','office_en','office','role','role_type','start','end','start_precision','end_precision','possible_from','possible_to','certain_from','certain_to','acting','approximate','review_required','verification','notes','source_urls','region']};
const bools=new Set(['acting','approximate','review_required']);
const data={};
for(const name of ['events','leaders']){
 const url='https://sametimeworld-default-rtdb.asia-southeast1.firebasedatabase.app/'+name+'.json';
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error('Cannot read migration input');
 const raw=await response.json();
 data[name]=Object.values(raw).filter(Boolean).map(row=>Object.fromEntries(fields[name].map(k=>[k,row[k]??(bools.has(k)?false:'')]))).sort((a,b)=>a.id-b.id);
}
const events=new Map(data.events.map(row=>[row.id,row]));
for(const [name,ids] of Object.entries(groups))for(const id of ids){if(!events.has(id))throw new Error('Unknown migrated record');events.get(id).locality=name;}
const actual=hash(canonical(data));
if(actual!==expected)throw new Error('Authoritative local projection mismatch: '+actual);
console.log('Exact canonical content verified:',actual,'records:',data.events.length,data.leaders.length);
writePacket(process.cwd(),data);
