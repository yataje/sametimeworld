import descriptor from './packet-config.js';
import {decodePacket,fetchPacketBytes} from './packet-codec.js';
let pending;
export function loadArchive(){
 if(!pending)pending=(async()=>{
  const bytes=await fetchPacketBytes(descriptor,async name=>{
   const url=new URL(name,document.baseURI);
   if(url.origin!==location.origin)throw new Error('자료 주소가 올바르지 않습니다.');
   const response=await fetch(url,{cache:'default',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`자료를 읽을 수 없습니다 (${response.status}).`);
   return response.text();
  });
  return decodePacket(bytes,descriptor);
 })().catch(error=>{pending=undefined;throw error;});
 return pending;
}
export async function fetchDataset(name){
 if(!['events','leaders','meta'].includes(name))throw new Error('Unknown dataset');
 return (await loadArchive())[name];
}