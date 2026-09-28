import descriptor from './packet-config.js';
import {decodePacket} from './packet-codec.js';
let pending;
export function loadArchive(){
 if(!pending)pending=(async()=>{
  const url=new URL(descriptor.f,document.baseURI);
  if(url.origin!==location.origin)throw new Error('자료 주소가 올바르지 않습니다.');
  const response=await fetch(url,{cache:'default',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`자료를 읽을 수 없습니다 (HTTP ${response.status}).`);
  return decodePacket(await response.arrayBuffer(),descriptor);
 })().catch(error=>{pending=undefined;throw error;});
 return pending;
}
export async function fetchDataset(name){
 if(!['events','leaders','meta'].includes(name))throw new Error('Unknown dataset');
 return (await loadArchive())[name];
}
