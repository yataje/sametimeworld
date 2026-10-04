import {createMeloReader,meloJSON,meloRequest} from './melo-client.js';
import {createWarmup} from './warmup.js';
const KEY='stw-melo-settings-v1',defaults={engine:'melo',device:'auto',voice:'KR',reference:'',speed:1,rate:1,volume:1,sdp_ratio:.2,noise_scale:.6,noise_scale_w:.8};
let settings={...defaults};try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}'),engine:'melo',reference:''};}catch{}
window.stwMeloSettings=()=>({...settings});
const section=document.createElement('section');section.className='stw-melo';
section.innerHTML='<h2>MeloTTS 0.24 설정</h2><p>이 PC에서 음성을 생성합니다. Melo 프로그램을 먼저 실행하세요.</p><label>실행 장치<select id="meloDevice"><option value="auto">자동 · GPU 우선</option><option value="cpu">CPU</option><option value="cuda">NVIDIA GPU</option></select></label><div id="meloSliders"></div><label>미리 듣기 문장<textarea id="meloText" spellcheck="false">안녕하세요. 세임타임월드 TTS 연습입니다.</textarea></label><button id="meloPreview" type="button">미리 듣기</button> <button id="meloStop" type="button">읽기 정지</button><p id="meloStatus" role="status"></p><button id="meloConnect" type="button">모델 연결·준비 다시 확인</button>';
document.querySelector('.display-settings-modal').insertBefore(section,document.querySelector('.display-settings-note'));
const $=id=>document.getElementById(id),save=()=>{try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}};
const badge=document.createElement('span');badge.style.marginLeft='10px';badge.setAttribute('role','status');document.querySelector('.version-label').append(badge);
const warmup=createWarmup({request:s=>meloRequest('/api/warmup',s),poll:id=>meloJSON('/api/jobs/'+id),cancel:id=>meloJSON('/api/jobs/'+id,{method:'DELETE'}).catch(()=>{}),onState:s=>{badge.textContent=s.status==='ready'?'Melo 모델 준비 완료':s.status==='loading'?'Melo 모델 준비 중…':'Melo 프로그램 연결 필요';if(s.error)$('meloStatus').textContent=s.error;}});
const preview=createMeloReader({readout:()=>[$('meloText').value],next:()=>null,onNavigate:()=>{},onState:s=>{$('meloStatus').textContent=s.message||'정지';$('meloPreview').disabled=s.playing;}});
const panel=document.createElement('aside');panel.className='stw-melo-player';panel.hidden=true;panel.innerHTML='<span>생성된 음성</span><div></div><button type="button">읽기 정지</button>';document.body.append(panel);
function pausePlayer(){panel.querySelector('audio')?.pause();panel.hidden=true;}
function stop(){preview.stop();pausePlayer();window.dispatchEvent(new Event('tts-stop'));}
window.addEventListener('tts-audio-ready',e=>{panel.querySelector('audio')?.pause();const audio=e.detail;audio.controls=true;audio.setAttribute('aria-label','생성된 음성 재생');panel.querySelector('div').replaceChildren(audio);panel.hidden=false;});
window.addEventListener('tts-preview-stop',()=>{preview.stop();pausePlayer();});window.addEventListener('tts-stop',pausePlayer);window.addEventListener('pagehide',()=>preview.stop());panel.querySelector('button').onclick=stop;
$('meloDevice').value=settings.device;$('meloDevice').onchange=()=>{stop();settings.device=$('meloDevice').value;save();warmup.start(settings);};
for(const [key,label,min,max,step] of [['speed','합성 속도',.5,2,.05],['rate','재생 속도',.5,2,.05],['volume','재생 음량',0,1,.05],['sdp_ratio','리듬 변동 비율',0,1,.05],['noise_scale','음성 변동',0,1,.05],['noise_scale_w','길이 변동',0,1,.05]]){
 const row=document.createElement('label');row.innerHTML=`${label}<input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;const input=row.querySelector('input'),output=row.querySelector('output');input.value=settings[key];output.textContent=Number(settings[key]).toFixed(2);input.oninput=()=>{settings[key]=Number(input.value);output.textContent=Number(input.value).toFixed(2);save();};$('meloSliders').append(row);
}
$('meloPreview').onclick=()=>{stop();preview.start(0);};$('meloStop').onclick=stop;$('meloConnect').onclick=()=>warmup.start(settings);
warmup.start(settings);
