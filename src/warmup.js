async function json(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw Error(data.error||'모델 준비 요청 실패');return data;}
export function createWarmup({request=s=>json('/api/warmup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)}),poll=id=>json('/api/jobs/'+id),cancel=id=>fetch('/api/jobs/'+id,{method:'DELETE'}).catch(()=>{}),wait=ms=>new Promise(r=>setTimeout(r,ms)),onState=()=>{}}={}){
 let generation=0,job=null;
 async function start(settings){
  const ticket=++generation;if(job){cancel(job);job=null;}
  const state=status=>onState({status,engine:settings.engine,device:settings.device});state('loading');
  try{
   const created=await request(settings);if(ticket!==generation){cancel(created.id);return;}job=created.id;
   for(;;){
    const result=await poll(created.id);if(ticket!==generation)return;
    if(result.status==='complete'){job=null;state('ready');return;}
    if(result.status==='failed'||result.status==='cancelled')throw Error(result.error||'모델 준비가 취소되었습니다.');
    await wait(500);
   }
  }catch(e){if(ticket===generation){job=null;onState({status:'failed',engine:settings.engine,error:e.message});}}
 }
 return {start};
}
