async function json(url,options){const r=await fetch(url,options);const d=await r.json();if(!r.ok)throw Error(d.error||'음성 요청 실패');return d;}
const requestDefault=obj=>json('/api/synthesis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
const cancelDefault=id=>fetch('/api/jobs/'+id,{method:'DELETE'}).catch(()=>{});
export function createLocalReader({readout,next,onNavigate,onState=()=>{},onAudioReady=a=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('tts-audio-ready',{detail:a}));},getSettings=()=>({}),request=requestDefault,cancelJob=cancelDefault,poll=id=>json('/api/jobs/'+id),AudioClass=globalThis.Audio,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 let playing=false,generation=0,audio=null,job=null;
 const notify=message=>onState({playing,message});
 function stop(message=''){
  generation++;playing=false;if(audio){audio.pause();audio.src='';audio=null;}if(job){cancelJob(job);job=null;}notify(message);
 }
 async function read(id,ticket,remaining=null){
  try{
   const settings=getSettings(),full=remaining??readout(id).filter(Boolean).join('\n');if(!full)throw Error('읽을 내용이 없습니다.');
   let cut=Math.min(full.length,1800);if(full.length>1800){const boundary=Math.max(full.lastIndexOf('\n',1800),full.lastIndexOf('. ',1800),full.lastIndexOf(' ',1800));if(boundary>900)cut=boundary+1;}
   const text=full.slice(0,cut),rest=full.slice(cut);
   notify('음성을 요청하고 있습니다…');const created=await request({...settings,text});
   if(!playing||ticket!==generation){cancelJob(created.id);return;}job=created.id;
   let result;
   for(;;){
    if(!playing||ticket!==generation)return;
    result=await poll(job);if(!playing||ticket!==generation)return;
    if(result.status==='complete')break;
    if(result.status==='failed')throw Error(result.error);
    if(result.status==='cancelled')throw Error('생성이 취소되었습니다.');
    notify(result.status==='queued'?'생성 순서를 기다리고 있습니다…':'음성을 생성하고 있습니다…');await wait(600);
   }
   job=null;audio=new AudioClass(result.audio);audio.playbackRate=Number(settings.rate||1);audio.volume=Number(settings.volume??1);audio.preservesPitch=true;
   const m=result.metrics||{},message=`재생 중 · ${m.cache_hit?'저장된 음성 즉시 재생':`${m.device||''} · 생성 ${Number(m.elapsed_seconds||0).toFixed(1)}초`} · 음성 ${Number(m.duration_seconds||0).toFixed(1)}초`;
   audio.onplaying=()=>{if(ticket===generation)notify(message);};
   audio.onended=()=>{if(!playing||ticket!==generation)return;audio=null;if(rest){read(id,ticket,rest);return;}const n=next(id);if(n==null){stop('읽기를 마쳤습니다.');return;}onNavigate(n);read(n,ticket);};
   audio.onerror=()=>{if(ticket===generation)stop('음성 파일을 재생할 수 없습니다.');};
   onAudioReady(audio);
   try{await audio.play();if(ticket===generation)notify(message);}catch(e){if(e.name==='NotAllowedError'){notify('음성이 준비되었습니다. 아래 음성 재생기의 재생 버튼을 눌러 주세요.');}else throw e;}
  }catch(e){if(ticket===generation)stop(e.message);}
 }
 function start(id){stop();playing=true;const ticket=generation;read(id,ticket);return true;}
 return {start,stop,get playing(){return playing;}};
}
