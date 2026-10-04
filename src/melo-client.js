import {createLocalReader} from './local-reader.js';
export const MELO_BASE='http://127.0.0.1:8765';
export async function meloJSON(path,options){
 let response;
 try{response=await fetch(MELO_BASE+path,{...options,credentials:'omit'});}catch{throw Error('Melo 프로그램을 먼저 실행하세요. 브라우저에서 로컬 네트워크 허용을 요청하면 허용해 주세요.');}
 const data=await response.json();if(!response.ok)throw Error(data.error||'Melo 요청 실패');return data;
}
export const meloRequest=(path,obj)=>meloJSON(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...obj,engine:'melo',reference:''})});
let oldBlob=null;
export function createMeloReader(options){
 return createLocalReader({...options,getSettings:()=>window.stwMeloSettings?.()||{engine:'melo'},request:r=>meloRequest('/api/synthesis',r),cancelJob:id=>meloJSON('/api/jobs/'+id,{method:'DELETE'}).catch(()=>{}),poll:async id=>{
  const job=await meloJSON('/api/jobs/'+id);
  if(job.status==='complete'){
   const response=await fetch(MELO_BASE+job.audio,{credentials:'omit'});if(!response.ok)throw Error('Melo 음성 파일을 가져오지 못했습니다.');
   if(oldBlob)URL.revokeObjectURL(oldBlob);oldBlob=URL.createObjectURL(await response.blob());job.audio=oldBlob;
  }
  return job;
 }});
}
