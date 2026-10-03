/** Browser/OS speech only. Cancellation invalidates all outstanding callbacks. */
export function createAutoReader({synth,Utterance,readout,next,onNavigate,onState=()=>{},schedule=(f)=>setTimeout(f,450),unschedule=clearTimeout}){
 let playing=false,generation=0,utterance=null,timer=null;
 const notify=message=>onState({playing,message});
 function stop(message=''){
  generation++;playing=false;
  if(timer!==null){unschedule(timer);timer=null;}
  const own=utterance;utterance=null;
  if(own){try{synth?.cancel();}catch{}}
  notify(message);
 }
 function start(id){
  stop();
  if(!synth||!Utterance){notify('이 브라우저는 음성 읽기를 지원하지 않습니다.');return false;}
  let voice;
  try{voice=[...synth.getVoices()].filter(v=>/^ko(?:[-_]|$)/i.test(v.lang)).sort((a,b)=>Number(!!b.localService)-Number(!!a.localService))[0];}catch{}
  if(!voice){notify('한국어 음성을 준비하지 못했습니다. 잠시 후 다시 누르거나 기기의 한국어 음성 설정을 확인해 주세요.');return false;}
  playing=true;const ticket=generation;notify('자동 TTS 재생 중');
  function read(eventId){
   if(!playing||ticket!==generation)return;
   let parts;try{parts=readout(eventId).filter(Boolean);}catch{stop('사건의 읽을 내용을 가져오지 못했습니다.');return;}
   if(!parts.length){stop('읽을 내용이 없어 정지했습니다.');return;}
   function speakAt(i){
    if(!playing||ticket!==generation)return;
    if(i===parts.length){utterance=null;timer=schedule(()=>{timer=null;if(!playing||ticket!==generation)return;const id=next(eventId);if(id==null){stop('시리즈의 마지막 사건까지 읽었습니다.');return;}try{onNavigate(id);read(id);}catch{stop('다음 사건으로 이동하지 못했습니다.');}});return;}
    try{
     const u=new Utterance(parts[i]);utterance=u;u.voice=voice;u.lang=voice.lang||'ko-KR';u.rate=1;u.pitch=1;
     u.onend=()=>{if(playing&&ticket===generation)speakAt(i+1);};
     u.onerror=()=>{if(playing&&ticket===generation)stop('음성 재생이 중단되었습니다. 자동 TTS를 다시 눌러 주세요.');};
     synth.speak(u);
    }catch{stop('음성을 재생할 수 없어 정지했습니다.');}
   }
   speakAt(0);
  }
  read(id);return playing;
 }
 return {start,stop,get playing(){return playing;}};
}
