import './style.css';
import {createEventMap} from './event-map.js';
import {loadLeaderHeaders,refreshLeaderHeaders} from './leaders.js';

let DATA=[];

const PAGE_VERSION='v0.4.6';
const DB_VERSION_FALLBACK='v15';
const FIREBASE_DB_ROOT='https://sametimeworld-default-rtdb.asia-southeast1.firebasedatabase.app';

function firebaseURL(path){
  return `${FIREBASE_DB_ROOT}/${String(path).replace(/^\/+/,'')}.json`;
}
async function fetchFirebaseJSON(path){
  const res=await fetch(firebaseURL(path),{cache:'no-cache',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error(`${path}: HTTP ${res.status}`);
  return await res.json();
}
function normalizeFirebaseRegion(value){
  const v=String(value??'').trim();
  if(v==='아메리카/하와이'||v==='아메리카·하와이')return '아메리카';
  return v;
}
function normalizeFirebaseEvents(raw){
  return Object.values(raw||{}).filter(Boolean).map((x,i)=>({
    id:Number(x.id??i+1),
    date:String(x.date??''),
    region:normalizeFirebaseRegion(x.region),
    importance:Number(x.importance??0),
    country:String(x.country??''),
    category:String(x.category??''),
    title:String(x.title??''),
    description:String(x.description??''),subject:String(x.subject??''),place:String(x.place??''),original_date:String(x.original_date??''),verification:String(x.verification??'')
  }));
}
function updateVersionLabels(meta={}){
  const page=document.getElementById('pageVersionLabel');
  const db=document.getElementById('dbVersionLabel');
  if(page)page.textContent=PAGE_VERSION;
  let dbVersion=String(meta.events_db_version||meta.db_version||DB_VERSION_FALLBACK);
  if(dbVersion&&!/^v/i.test(dbVersion))dbVersion=`v${dbVersion}`;
  if(db)db.textContent=`DB ${dbVersion}`;
  document.title=`The World at the Same Time — ${PAGE_VERSION} · DB ${dbVersion}`;
}

const REGIONS=['유럽/아프리카','중동','동아시아/오세아니아','아메리카'];
const LEVELS=[{name:'10년',kind:'decade',n:10,h:290,limit:10},{name:'5년',kind:'five',n:5,h:320,limit:11},{name:'1년',kind:'year',n:1,h:350,limit:12},{name:'1개월',kind:'month',h:170,limit:5},{name:'보름',kind:'fortnight',h:154,limit:5},{name:'1주',kind:'week',h:138,limit:6},{name:'1일',kind:'day',h:122,limit:7}];
const $=s=>document.querySelector(s), viewport=$('#viewport'), space=$('#space'), rows=$('#rows');

// Map initialization is independent of Firebase and must not delay the text UI.
const eventMap=createEventMap({canvas:document.getElementById('eventMapCanvas'),
 note:document.getElementById('eventMapNote'),motion:document.getElementById('eventMapMotion'),
 label:document.getElementById('eventMapLabel'),onFailure:error=>console.warn('Background map unavailable:',error)});
// Local, opt-in inspection only. No data writes or user tracking.
if(new URLSearchParams(location.search).get('mapDebug')==='1')window.__stwMap=eventMap;

// v3.16 — 모바일에서는 4열을 억지로 축소하지 않고, 같은 날짜를 유지한 채 지역을 탭으로 전환한다.
const MOBILE_REGION_OPTIONS=[
  {key:'europe',label:'유럽·아프리카'},
  {key:'middle',label:'중동'},
  {key:'east',label:'동아시아'},
  {key:'americas',label:'아메리카'}
];
const MOBILE_REGION_STORAGE_KEY='stw-mobile-region-v1';
let mobileRegionKey='east';
try{
  const savedMobileRegion=localStorage.getItem(MOBILE_REGION_STORAGE_KEY);
  if(MOBILE_REGION_OPTIONS.some(x=>x.key===savedMobileRegion))mobileRegionKey=savedMobileRegion;
}catch{}
function applyMobileRegion(key,save=true){
  if(!MOBILE_REGION_OPTIONS.some(x=>x.key===key))key='east';
  mobileRegionKey=key;
  for(const item of MOBILE_REGION_OPTIONS)document.body.classList.toggle(`mobile-region-${item.key}`,item.key===key);
  document.querySelectorAll('.mobile-region-btn').forEach(btn=>{
    const active=btn.dataset.mobileRegion===key;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
  if(save){try{localStorage.setItem(MOBILE_REGION_STORAGE_KEY,key);}catch{}}
  if(typeof syncTimelineHeaderWidth==='function')requestAnimationFrame(syncTimelineHeaderWidth);
  if(typeof requestRender==='function')requestRender();
}
function initMobileRegionNav(){
  const head=document.querySelector('.headgrid');
  if(!head||document.querySelector('.mobile-region-nav'))return;
  const nav=document.createElement('div');
  nav.className='mobile-region-nav';
  nav.setAttribute('role','tablist');
  nav.setAttribute('aria-label','모바일 지역 선택');
  nav.innerHTML=MOBILE_REGION_OPTIONS.map(item=>`<button type="button" class="mobile-region-btn" data-mobile-region="${item.key}" role="tab">${item.label}</button>`).join('');
  head.parentNode.insertBefore(nav,head);
  nav.addEventListener('click',e=>{
    const btn=e.target.closest('[data-mobile-region]');
    if(!btn)return;
    applyMobileRegion(btn.dataset.mobileRegion,true);
  });
  applyMobileRegion(mobileRegionKey,false);
}

const DISPLAY_SETTINGS_KEY='stw-display-settings-v1';
const DISPLAY_DEFAULTS=Object.freeze({mapTransparency:58,eventFont:100,cardTransparency:50,detailTransparency:40});
const DISPLAY_LIMITS={mapTransparency:[0,100],eventFont:[80,140],cardTransparency:[0,100],detailTransparency:[0,100]};
let displaySettings={...DISPLAY_DEFAULTS};
function displayClamp(key,value){const [lo,hi]=DISPLAY_LIMITS[key];const n=Number(value);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):DISPLAY_DEFAULTS[key];}
function loadDisplaySettings(){try{const raw=JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY)||'{}');for(const k of Object.keys(DISPLAY_DEFAULTS))displaySettings[k]=displayClamp(k,raw[k]??DISPLAY_DEFAULTS[k]);}catch{displaySettings={...DISPLAY_DEFAULTS};}}
function saveDisplaySettings(){try{localStorage.setItem(DISPLAY_SETTINGS_KEY,JSON.stringify(displaySettings));}catch{}}
function applyDisplaySettings(shouldRender=false){
 const root=document.documentElement.style;
 root.setProperty('--map-opacity',String(1-displaySettings.mapTransparency/100));
 root.setProperty('--event-font-size',`${(11*displaySettings.eventFont/100).toFixed(2)}px`);
 root.setProperty('--event-bg-alpha',String(1-displaySettings.cardTransparency/100));
 root.setProperty('--detail-bg-alpha',String(1-displaySettings.detailTransparency/100));
 syncDisplaySettingsControls();
 if(shouldRender&&typeof requestRender==='function')requestRender();
}
const DISPLAY_CONTROL_MAP={
 mapTransparency:['settingMapTransparency','settingMapTransparencyValue',v=>`${v}%`],
 eventFont:['settingEventFont','settingEventFontValue',v=>`${v}%`],
 cardTransparency:['settingCardTransparency','settingCardTransparencyValue',v=>`${v}%`],
 detailTransparency:['settingDetailTransparency','settingDetailTransparencyValue',v=>`${v}%`],
};
function syncDisplaySettingsControls(){for(const [key,[inputId,valueId,format]] of Object.entries(DISPLAY_CONTROL_MAP)){const input=document.getElementById(inputId),out=document.getElementById(valueId);if(input)input.value=displaySettings[key];if(out)out.textContent=format(displaySettings[key]);}}
loadDisplaySettings();applyDisplaySettings(false);
const displaySettingsOverlay=document.getElementById('displaySettingsOverlay');
const displaySettingsOpen=document.getElementById('displaySettingsOpen');
const displaySettingsClose=document.getElementById('displaySettingsClose');
function openDisplaySettings(){displaySettingsOverlay?.classList.add('open');syncDisplaySettingsControls();}
function closeDisplaySettings(){displaySettingsOverlay?.classList.remove('open');}
if(displaySettingsOpen)displaySettingsOpen.addEventListener('click',openDisplaySettings);
document.getElementById('detailDisplaySettings')?.addEventListener('click',openDisplaySettings);
if(displaySettingsClose)displaySettingsClose.addEventListener('click',closeDisplaySettings);
if(displaySettingsOverlay)displaySettingsOverlay.addEventListener('click',e=>{if(e.target===displaySettingsOverlay)closeDisplaySettings();});
for(const [key,[inputId]] of Object.entries(DISPLAY_CONTROL_MAP)){
 const input=document.getElementById(inputId);if(!input)continue;
 input.addEventListener('input',()=>{displaySettings[key]=displayClamp(key,input.value);applyDisplaySettings(true);});
 input.addEventListener('change',saveDisplaySettings);
}
const displaySettingsReset=document.getElementById('displaySettingsReset');
if(displaySettingsReset)displaySettingsReset.addEventListener('click',()=>{displaySettings={...DISPLAY_DEFAULTS};applyDisplaySettings(true);saveDisplaySettings();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&displaySettingsOverlay?.classList.contains('open'))closeDisplaySettings();});

const AUDIO_SETTINGS_KEY='stw-audio-enabled-v1';
let audioEnabled=true;
try{audioEnabled=localStorage.getItem(AUDIO_SETTINGS_KEY)!=='0';}catch{}
let audioContext=null,masterGain=null,resumePending=false,audioResumePromise=null,pendingZoomCueDirection=null;
let dragAudioBudget=0,lastDragAudioAt=-Infinity;
const activeAudioVoices=new Set();
// Resume audio lazily. Drag ticks are never queued; a single current zoom cue may replay after resume.
function restoreAudioLevel(ctx=audioContext){
 if(!audioEnabled||!masterGain||!ctx)return;
 try{masterGain.gain.cancelScheduledValues(ctx.currentTime);masterGain.gain.setValueAtTime(0.7,ctx.currentTime);}catch{}
}
function ensureAudioContext(){
 if(!audioEnabled)return null;
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  if(!audioContext||audioContext.state==='closed'){
   audioContext=new Ctx();masterGain=audioContext.createGain();
   masterGain.gain.setValueAtTime(0.7,audioContext.currentTime);
   masterGain.connect(audioContext.destination);
  }
  if(audioContext.state==='running'){restoreAudioLevel(audioContext);return audioContext;}
  if(!resumePending){
   const target=audioContext;
   resumePending=true;
   audioResumePromise=Promise.resolve(target.resume()).then(()=>{
    if(audioEnabled&&target===audioContext&&target.state==='running'){restoreAudioLevel(target);return target;}
    return null;
   }).catch(()=>null).finally(()=>{
    if(target===audioContext){resumePending=false;audioResumePromise=null;}
   });
  }
  return null;
 }catch{return null;}
}
function silenceNavigationAudio(){
 dragAudioBudget=0;pendingZoomCueDirection=null;
 if(masterGain&&audioContext){
  try{masterGain.gain.cancelScheduledValues(audioContext.currentTime);masterGain.gain.setValueAtTime(0,audioContext.currentTime);}catch{}
 }
 for(const osc of activeAudioVoices){try{osc.stop();}catch{}}
 activeAudioVoices.clear();
}
function syncAudioToggle(){
 const btn=document.getElementById('soundToggle');if(!btn)return;
 btn.title=audioEnabled?'효과음 켜짐 · 클릭하여 음소거':'효과음 꺼짐 · 클릭하여 켜기';
 btn.setAttribute('aria-label',btn.title);btn.setAttribute('aria-pressed',String(audioEnabled));
 btn.classList.toggle('muted',!audioEnabled);
}
function setAudioEnabled(enabled){
 audioEnabled=Boolean(enabled);
 if(!audioEnabled)silenceNavigationAudio();
 else{ensureAudioContext();if(masterGain&&audioContext){try{masterGain.gain.setValueAtTime(0.7,audioContext.currentTime);}catch{}}}
 syncAudioToggle();try{localStorage.setItem(AUDIO_SETTINGS_KEY,audioEnabled?'1':'0');}catch{}
}
function createTone(ctx,time,freq,duration,type='sine',gainValue=0.045,panValue=0){
 const osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type;osc.frequency.setValueAtTime(freq,time);
 gain.gain.setValueAtTime(0.0001,time);
 gain.gain.exponentialRampToValueAtTime(gainValue,time+(duration<0.03?0.002:0.008));
 gain.gain.exponentialRampToValueAtTime(0.0001,time+duration);
 osc.connect(gain);gain.connect(masterGain);
 activeAudioVoices.add(osc);
 osc.onended=()=>{activeAudioVoices.delete(osc);osc.disconnect();gain.disconnect();};
 osc.start(time);osc.stop(time+duration+0.008);
}
function playZoomCueNow(ctx,direction){
 try{
  const now=ctx.currentTime+0.004,freqs=direction==='in'?[330,520,820]:[820,520,330];
  freqs.forEach((freq,i)=>createTone(ctx,now+i*0.037,freq,0.064,'sine',0.046-i*0.004));
 }catch{} // Audio device failures cannot cancel zoom or navigation.
}
function playZoomCue(direction){
 const ctx=ensureAudioContext();
 if(ctx){pendingZoomCueDirection=null;playZoomCueNow(ctx,direction);return;}
 if(!audioEnabled||!audioContext)return;
 pendingZoomCueDirection=direction;
 const pending=audioResumePromise;
 if(!pending)return;
 pending.then(ready=>{
  if(!ready||!audioEnabled||ready!==audioContext){pendingZoomCueDirection=null;return;}
  const queued=pendingZoomCueDirection;pendingZoomCueDirection=null;
  if(queued)playZoomCueNow(ready,queued);
 });
}
function playDragTick(speed=0.5){
 const ctx=ensureAudioContext();if(!ctx)return;
 try{createTone(ctx,ctx.currentTime+0.002,170+70*speed,0.021,'triangle',0.046+speed*0.010);}catch{}
}
function emitDragSound(delta){
 if(!audioEnabled||!Number.isFinite(delta)||delta===0)return;
 const amount=Math.abs(delta),speed=Math.min(1,amount/32),threshold=14;
 dragAudioBudget=Math.min(2*threshold,dragAudioBudget+amount);
 const now=performance.now();
 // At most one voice per frame; discard backlog instead of stacking identical ticks.
 if(dragAudioBudget<threshold||now-lastDragAudioAt<24)return;
 dragAudioBudget%=threshold;lastDragAudioAt=now;playDragTick(speed);
}
function initAudioToggle(){
 syncAudioToggle();
 document.getElementById('soundToggle')?.addEventListener('click',()=>setAudioEnabled(!audioEnabled));
 const unlock=e=>{if(e.isTrusted&&audioEnabled){ensureAudioContext();if(masterGain&&audioContext){try{masterGain.gain.setValueAtTime(0.7,audioContext.currentTime);}catch{}}}};
 document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
 document.addEventListener('pointerup',unlock,{capture:true,passive:true});
 document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silenceNavigationAudio();else if(audioEnabled)ensureAudioContext();});
}
initAudioToggle();

function syncTimelineHeaderWidth(){document.documentElement.style.setProperty('--timeline-client-width',`${viewport.clientWidth}px`);}
syncTimelineHeaderWidth();
window.addEventListener('resize',syncTimelineHeaderWidth,{passive:true});
if(window.ResizeObserver){new ResizeObserver(syncTimelineHeaderWidth).observe(viewport);}
const DAY=86400000, start=Date.UTC(1830,0,1), end=Date.UTC(1961,0,1);
const utc=(y,m=0,d=1)=>Date.UTC(y,m,d);
const ymd=t=>{let d=new Date(t);return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]};
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bins=[], maps=[], zoom=2, animation=0, dragging=false, dragMoved=false, lastY=0, recent=[], suppressClickUntil=0, wheelAccum=0;
let zoomFocusEventId=null; // 사건 위에서 확대할 때 해당 사건을 다음 단계에서도 유지
let zoomTransition=false, queuedZoom=null, activeZoomFx=null; const ZOOM_DURATION=800;
let byId=new Map();
function parseDate(x){let m=/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(x.date||'');if(!m)return null;let y=+m[1],mo=+(m[2]||1),d=+(m[3]||1);if(m[3]&&!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;return {y,mo,d,t:utc(y,mo-1,d),precision:m[3]?'일':m[2]?'월':'연도'};}
for(let z=0;z<LEVELS.length;z++){
 let level=LEVELS[z], arr=[], p=start, index=0;
 while(p<end){let [y,m]=ymd(p),n;
  if(level.kind==='decade')n=utc(y+10,0,1);
  else if(level.kind==='five')n=utc(y+5,0,1);
  else if(level.kind==='year')n=utc(y+1,0,1);
  else if(level.kind==='month')n=utc(y,m,1);
  else if(level.kind==='fortnight'){
   const d=ymd(p)[2]; n=d<16?utc(y,m-1,16):utc(y,m,1);
  }
  else if(level.kind==='week'){
   const d=ymd(p)[2];
   if(d<8)n=utc(y,m-1,8); else if(d<15)n=utc(y,m-1,15); else if(d<22)n=utc(y,m-1,22); else n=utc(y,m,1);
  }
  else n=p+DAY;
  arr.push({t:p,end:Math.min(n,end),idx:index++,top:0,height:level.h});p=n;
 }
 bins.push(arr);maps.push(new Map());
}
function indexFor(t,z){let arr=bins[z],lo=0,hi=arr.length-1;while(lo<=hi){let mid=(lo+hi)>>1, b=arr[mid];if(t<b.t)hi=mid-1;else if(t>=b.end)lo=mid+1;else return mid;}return Math.max(0,Math.min(arr.length-1,lo));}
function rebuildEventIndexes(){
 byId=new Map(DATA.map(x=>[x.id,x]));
 maps=LEVELS.map(()=>new Map());
 for(let x of DATA){let dt=parseDate(x);if(!dt)continue;for(let z=0;z<LEVELS.length;z++){let i=indexFor(dt.t,z),m=maps[z];if(!m.has(i))m.set(i,[]);m.get(i).push({...x,precision:dt.precision});}}
}
for(let z=0;z<LEVELS.length;z++){let h=LEVELS[z].h;bins[z].forEach((b,i)=>b.top=i*h);}
function totalHeight(z){return bins[z].length*LEVELS[z].h;}
function topAt(t,z){let i=indexFor(t,z),b=bins[z][i];return b.top+(Math.min(Math.max(t,b.t),b.end)-b.t)/(b.end-b.t)*b.height;}
function timeAt(pos,z){let arr=bins[z], i=Math.min(arr.length-1,Math.max(0,Math.floor(pos/LEVELS[z].h))),b=arr[i];return b.t+(Math.max(0,Math.min(b.height,pos-b.top))/b.height)*(b.end-b.t);}
function label(b,z){let [y,m,d]=ymd(b.t),kind=LEVELS[z].kind;if(kind==='decade')return `${y}–${y+9}`;if(kind==='five')return `${y}–${y+4}`;if(kind==='year')return String(y);if(kind==='month')return `${y}.${pad(m)}`;if(kind==='fortnight'||kind==='week'){let [ey,em,ed]=ymd(Math.max(b.t,b.end-DAY));return ey===y&&em===m?`${y}.${pad(m)}.${pad(d)}–${pad(ed)}`:`${y}.${pad(m)}.${pad(d)}–${ey}.${pad(em)}.${pad(ed)}`;}return `${y}.${pad(m)}.${pad(d)}`;}
function dateCellLabel(b,z){const [y,m,d]=ymd(b.t),kind=LEVELS[z].kind;if(kind==='decade'){return `<span class="date-year">${y}</span><span class="date-rest">–${y+9}</span>`;}if(kind==='five'){return `<span class="date-year">${y}</span><span class="date-rest">–${y+4}</span>`;}if(kind==='year')return String(y);if(kind==='month')return `<span class="date-year">${y}</span><span class="date-rest">${pad(m)}</span>`;if(kind==='fortnight'||kind==='week'){const [ey,em,ed]=ymd(Math.max(b.t,b.end-DAY));const rest=(ey===y&&em===m)?`${pad(m)}.${pad(d)}–${pad(ed)}`:`${pad(m)}.${pad(d)}–${pad(em)}.${pad(ed)}`;return `<span class="date-year">${y}</span><span class="date-rest">${rest}</span>`;}return `<span class="date-year">${y}</span><span class="date-rest">${pad(m)}.${pad(d)}</span>`;}
function selectTimelineCards(sorted,limit,focusedId){
 const focused=sorted.find(x=>x.id===focusedId);
 return (focused?[focused,...sorted.filter(x=>x.id!==focusedId)]:sorted).slice(0,limit);
}
function render(){if(activeAppTab==='web')return;let z=zoom,level=LEVELS[z],height=viewport.clientHeight,top=viewport.scrollTop;let lo=Math.max(0,Math.floor(top/level.h)-4),hi=Math.min(bins[z].length-1,Math.ceil((top+height)/level.h)+4);let content='';
 for(let i=lo;i<=hi;i++){let b=bins[z][i], events=maps[z].get(i)||[],groups=REGIONS.map(r=>events.filter(x=>x.region===r));let cardList=groups.map(g=>{let sorted=g.slice().sort((a,b)=>(b.importance||0)-(a.importance||0)||a.date.localeCompare(b.date)||a.id-b.id);let limit=level.limit;let shown=selectTimelineCards(sorted,limit,zoomFocusEventId);
  let cards=shown.map(x=>{let fuzzy=(z===3&&x.precision==='연도')||(z>=4&&x.precision!=='일');let labelDate=x.date;return `<div role="button" tabindex="0" class="event ${fuzzy?'uncertain':''}" data-id="${x.id}" title="${escapeHTML(labelDate+' · '+x.title+(fuzzy?' · 정확한 날짜 미상':''))}"><span class="event-text"><strong>${escapeHTML(x.country||'미상')}</strong>${fuzzy?'≈ ':''}${escapeHTML(x.title)}</span><span class="event-category">${escapeHTML(x.category||'미분류')}</span><span class="event-importance" aria-label="중요도 ${x.importance??'미상'}">★ ${escapeHTML(x.importance??'—')}</span></div>`;}).join('');return cards+(g.length>limit?`<div class="more">외 ${g.length-limit}건 · 확대하여 보기</div>`:'')||'<div class="blank">·</div>';});
 content+=`<section class="timeline-row" style="top:${b.top}px;height:${b.height}px" data-index="${i}"><div class="date date-left">${dateCellLabel(b,z)}</div>${cardList.map(x=>`<div>${x}</div>`).join('')}<div class="date date-right">${dateCellLabel(b,z)}</div></section>`;
 }
 const activeCard=document.activeElement?.closest?.('.event[data-id]');
 const activeCardId=activeCard&&rows.contains(activeCard)?activeCard.dataset.id:null;
 rows.innerHTML=content;
 if(activeCardId)rows.querySelector(`.event[data-id="${Number(activeCardId)}"]`)?.focus({preventScroll:true});
 let center=timeAt(top+height/2,z),[y,m,d]=ymd(center),kind=LEVELS[z].kind;$('#loc').textContent=(kind==='decade'||kind==='five'||kind==='year')?`${y}년`:kind==='month'?`${y}.${pad(m)}`:`${y}.${pad(m)}.${pad(d)}`;
 $('#status').textContent=`${DATA.length.toLocaleString('ko-KR')}건 · ${level.name} 단위`;
 refreshLeaderHeaders(center);
}
let renderQueued=false;function requestRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render()});}
// 현재 화면의 행만 복제해 확대 도중 이전 시대가 사라지는 순간적인 점프를 막는다.
function snapshotViewport(){
 const r=viewport.getBoundingClientRect(), overlay=document.createElement('div');
 overlay.className='zoom-snapshot';
 Object.assign(overlay.style,{position:'fixed',top:r.top+'px',left:r.left+'px',width:r.width+'px',height:r.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:'18',background:'#0c1017'});
 const copied=rows.cloneNode(true);
 Object.assign(copied.style,{position:'absolute',left:'0',right:(viewport.offsetWidth-viewport.clientWidth)+'px',top:-viewport.scrollTop+'px',opacity:'1'});
 overlay.appendChild(copied); document.body.appendChild(overlay);
 return overlay;
}
function focusedEventDate(id){
 if(id==null)return null;
 const x=byId.get(Number(id));return x?parseDate(x):null;
}
function reanchorFocusedEvent(id,anchorY){
 if(id==null)return false;
 const el=rows.querySelector(`.event[data-id="${id}"]`);if(!el)return false;
 const vr=viewport.getBoundingClientRect(),er=el.getBoundingClientRect();
 const currentY=er.top+er.height/2-vr.top;
 const delta=currentY-anchorY;
 if(Math.abs(delta)>0.5){viewport.scrollTop+=delta;render();}
 return true;
}
function hoveredEventId(e){
 const el=e.target?.closest?.('.event[data-id]');
 return el?Number(el.dataset.id):null;
}
function stopZoomTransition(){
 const fx=activeZoomFx;
 if(!fx)return;
 activeZoomFx=null;zoomTransition=false;queuedZoom=null;
 try{fx.incoming.cancel();}catch{}
 try{fx.snapshotAnimation.cancel();}catch{}
 fx.overlay.remove();
 render();
 if(fx.eventAnchored)reanchorFocusedEvent(fx.anchorEventId,fx.anchorY);
}
function setZoom(next,anchorY=viewport.clientHeight/2,anchorEventId=null){
 next=Math.max(0,Math.min(LEVELS.length-1,next));
 anchorY=Math.max(0,Math.min(viewport.clientHeight,anchorY));
 // 확대/축소 애니메이션은 시각 효과일 뿐 입력 잠금이 아니다.
 // 새 휠/버튼 입력이 오면 현재 효과를 즉시 정리하고 현재 배율에서 다음 조작을 시작한다.
 if(zoomTransition)stopZoomTransition();
 if(next===zoom)return;
 // 직접 여러 단계를 요청한 경우에만 인접 단계씩 이어 간다. 사용자 입력은 언제든 이 큐를 끊을 수 있다.
 if(Math.abs(next-zoom)>1){queuedZoom={next,anchorY,anchorEventId};next=zoom+Math.sign(next-zoom);}
 cancelAnimationFrame(animation);
 const previous=zoom;
 playZoomCue(next>previous?'in':'out');
 const anchorDate=focusedEventDate(anchorEventId);
 const eventAnchored=Boolean(anchorDate);
 if(eventAnchored)zoomFocusEventId=Number(anchorEventId);
 else zoomFocusEventId=null;
 const oldTime=eventAnchored?anchorDate.t:timeAt(viewport.scrollTop+anchorY,zoom);
 const overlay=snapshotViewport(), anchorX=viewport.clientWidth/2;
 zoomTransition=true; zoom=next;
 space.style.height=totalHeight(zoom)+'px';
 $('#level').textContent=LEVELS[zoom].name;
 $('#out').disabled=zoom===0;$('#in').disabled=zoom===LEVELS.length-1;
 viewport.scrollTop=topAt(oldTime,zoom)-anchorY;
 render();
 if(eventAnchored)reanchorFocusedEvent(anchorEventId,anchorY);
 const incoming=rows.animate([
  {opacity:0,filter:'blur(3px)'},{opacity:1,filter:'blur(0px)'}
 ],{duration:ZOOM_DURATION,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
 const snapshotAnimation=overlay.animate([
  {opacity:1,transform:'scale(1)',filter:'blur(0px)'},
  {opacity:0,transform:`scale(${next>previous?1.13:0.89})`,filter:'blur(2px)'}
 ],{duration:ZOOM_DURATION,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
 overlay.style.transformOrigin=`${anchorX}px ${anchorY}px`;
 const fx={incoming,snapshotAnimation,overlay,eventAnchored,anchorEventId,anchorY};
 activeZoomFx=fx;
 const finish=()=>{
  if(activeZoomFx!==fx)return;
  activeZoomFx=null;zoomTransition=false;
  incoming.cancel();snapshotAnimation.cancel();overlay.remove();
  render();
  if(eventAnchored)reanchorFocusedEvent(anchorEventId,anchorY);
  if(queuedZoom){const q=queuedZoom;queuedZoom=null;setZoom(q.next,q.anchorY,q.anchorEventId);}
 };
 snapshotAnimation.finished.then(finish).catch(()=>{
  // cancel()은 이전 애니메이션의 finished Promise를 reject한다.
  // 이미 새 조작이 시작된 경우에는 그 새 전환 상태를 건드리지 않는다.
  if(activeZoomFx!==fx)return;
  activeZoomFx=null;zoomTransition=false;overlay.remove();
 });
}
function requestedZoomBase(){return zoom;}
$('#in').onclick=()=>setZoom(requestedZoomBase()+1);
$('#out').onclick=()=>setZoom(requestedZoomBase()-1);
viewport.addEventListener('wheel',e=>{
 e.preventDefault();
 let d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1);
 if(!Number.isFinite(d)||d===0)return;
 const direction=Math.sign(d),base=requestedZoomBase();
 const threshold=70,anchorY=e.clientY-viewport.getBoundingClientRect().top;
 // 최대/최소 배율에서는 더 갈 수 없는 방향의 입력을 누적하지 않는다.
 if((direction<0&&base===LEVELS.length-1)||(direction>0&&base===0)){wheelAccum=0;return;}
 // 방향을 바꾸면 이전 방향의 잔여값을 버린다. 첫 축소 입력이 상쇄되지 않는다.
 if(wheelAccum*direction<0)wheelAccum=0;
 wheelAccum+=d;
 if(Math.abs(wheelAccum)>=threshold){
  // 장치별 delta 크기를 '여러 단계'로 바꾸지 않고, 한 번에 한 단계만 요청한다.
  // 소비한 입력의 잔여값은 다음 휠 조작에 넘기지 않는다.
  wheelAccum=0;
  const anchorEventId=hoveredEventId(e);
  setZoom(base-direction,anchorY,anchorEventId);
 }
},{passive:false});
viewport.addEventListener('scroll',requestRender,{passive:true});
viewport.addEventListener('pointerdown',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;if(e.button!==0)return;if(zoomTransition)stopZoomTransition();ensureAudioContext();zoomFocusEventId=null;cancelAnimationFrame(animation);dragging=true;dragMoved=false;dragAudioBudget=0;lastDragAudioAt=0;lastY=e.clientY;recent=[{t:performance.now(),y:e.clientY}];viewport.classList.add('grabbing');viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!dragging)return;let delta=e.clientY-lastY;if(Math.abs(e.clientY-recent[0].y)>5)dragMoved=true;const beforeScroll=viewport.scrollTop;viewport.scrollTop-=delta;if(dragMoved)emitDragSound(viewport.scrollTop-beforeScroll);lastY=e.clientY;recent.push({t:performance.now(),y:e.clientY});while(recent.length>2&&performance.now()-recent[0].t>110)recent.shift();});
function release(e){if(!dragging)return;dragging=false;dragAudioBudget=0;viewport.classList.remove('grabbing');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);if(!dragMoved){let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]');if(target)openWebForEvent(Number(target.dataset.id));return;}suppressClickUntil=performance.now()+260;let first=recent[0],last=recent[recent.length-1],dt=Math.max(1,last.t-first.t);let v=-(last.y-first.y)/dt*16;v=Math.max(-65,Math.min(65,v));function glide(){v*=.92;if(Math.abs(v)<.35)return;let old=viewport.scrollTop;viewport.scrollTop+=v;if(old===viewport.scrollTop)return;animation=requestAnimationFrame(glide);}if(Math.abs(v)>1)animation=requestAnimationFrame(glide);}
viewport.addEventListener('keydown',e=>{const card=e.target.closest('[data-id]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openWebForEvent(Number(card.dataset.id));}});
viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',e=>{dragging=false;dragAudioBudget=0;cancelAnimationFrame(animation);viewport.classList.remove('grabbing');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);});
viewport.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();return;}if(window.matchMedia('(pointer: coarse)').matches){const target=e.target.closest?.('[data-id]');if(target)openWebForEvent(Number(target.dataset.id));}},true);


const tabExperience=$('#tabExperience'), tabWeb=$('#tabWeb'), tabWebLabel=$('#tabWebLabel'), experiencePanel=$('#experiencePanel'), webPanel=$('#webPanel');
const webQuery=$('#webQuery'), webEventMeta=$('#webEventMeta');
const TIMELINE_HISTORY_STATE={stwTab:'experience'};
let activeAppTab='experience',activeDetailEventId=null,lastDetailEventId=null;
let timelineBookmark=null;
tabWeb.disabled=true;
function setAppTab(name){
 const previous=activeAppTab,web=name==='web';
 if(web&&previous!=='web'){
  // Stop only transient timeline effects; preserve the selected date and zoom.
  if(zoomTransition)stopZoomTransition();
  cancelAnimationFrame(animation);wheelAccum=0;
  timelineBookmark={scrollTop:viewport.scrollTop,zoom};
 }
 activeAppTab=web?'web':'experience';
 tabExperience.classList.toggle('active',!web);tabWeb.classList.toggle('active',web);
 tabExperience.setAttribute('aria-selected',String(!web));tabWeb.setAttribute('aria-selected',String(web));
 experiencePanel.classList.toggle('active',!web);webPanel.classList.toggle('active',web);
 document.body.classList.toggle('event-detail-active',web);
 if(web){
  const x=byId.get(activeDetailEventId);
  if(x)eventMap.showEvent({...x,place:eventDetails(x).place});
 }else{
  eventMap.showWorld();
  if(previous==='web'){
   if(timelineBookmark)viewport.scrollTop=timelineBookmark.scrollTop;
   syncTimelineHeaderWidth();requestRender();
   requestAnimationFrame(()=>{if(activeAppTab==='experience'){syncTimelineHeaderWidth();requestRender();}});
  }
 }
}
function eventDateDisplay(raw){
 const value=String(raw??'').trim();
 let m;
 if((m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)))return {precision:'일',display:`${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`,raw:value};
 if((m=/^(\d{4})-(\d{2})$/.exec(value)))return {precision:'월',display:`${Number(m[1])}년 ${Number(m[2])}월`,raw:value};
 if((m=/^(\d{4})$/.exec(value)))return {precision:'연',display:`${Number(m[1])}년`,raw:value};
 return {precision:'—',display:value||'날짜 미상',raw:value};
}
function renderEventMeta(x){
 const date=eventDateDisplay(x.date),fields=[['날짜',date.display,date.precision],['대륙',x.region],['국가',x.country],['카테고리',x.category]];
 webEventMeta.replaceChildren();
 for(const [label,value,precision] of fields){
  if(!value)continue;
  const item=document.createElement('span');item.className='detail-meta-item';
  const key=document.createElement('b');key.className='detail-meta-label';key.textContent=label;
  item.append(key);
  if(precision){const badge=document.createElement('em');badge.className='detail-date-precision';badge.textContent=precision;item.append(badge);}
  const text=document.createElement('span');text.textContent=value;item.append(text);webEventMeta.append(item);
 }
}
function returnToTimeline(){
 if(activeAppTab==='web'&&history.state?.stwTab==='web'){history.back();return;}
 activeDetailEventId=null;setAppTab('experience');
}
tabExperience.onclick=returnToTimeline;
tabWeb.onclick=()=>{const id=activeDetailEventId??lastDetailEventId;if(id!==null&&activeAppTab!=='web')openWebForEvent(id);};
function openWebForEvent(id,{historyMode='push'}={}){
 const x=byId.get(Number(id));if(!x)return;
 const d=eventDetails(x);activeDetailEventId=x.id;lastDetailEventId=x.id;tabWeb.disabled=false;
 tabWebLabel.textContent='사건 상세';
 webQuery.textContent=x.title;
 renderEventMeta(x);
 const body=$('#eventDetailBody');body.replaceChildren();
 for(const [label,value] of [['대상',d.subject],['장소',d.place],['설명',d.description],['원문 날짜',d.original_date],['검증 상태',d.verification]]){
  if(!value)continue;
  const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+' ';p.append(strong,document.createTextNode(value));body.append(p);
 }
 const link=$('#externalSearch');link.hidden=false;
 link.href='https://www.google.com/search?q='+encodeURIComponent([x.date,d.subject,x.title].filter(Boolean).join(' '));
 setAppTab('web');
 webPanel.querySelector('.event-detail').scrollTop=0;
 if(historyMode==='push')history.pushState({stwTab:'web',eventId:x.id},'',`#event-${x.id}`);
}
document.getElementById('backToTimeline')?.addEventListener('click',returnToTimeline);
window.addEventListener('popstate',e=>{
 const state=e.state;
 if(state?.stwTab==='web'&&state.eventId!=null){openWebForEvent(state.eventId,{historyMode:'none'});return;}
 activeDetailEventId=null;setAppTab('experience');
});
if(!history.state?.stwTab)history.replaceState(TIMELINE_HISTORY_STATE,'',location.pathname+location.search);
const headerSearch=$('#headerSearch'), searchInput=$('#searchInput'), searchGo=$('#searchGo'), searchResults=$('#searchResults');
function parseSearchDateQuery(raw){
 const cleaned=String(raw??'').trim().replace(/[년월일.\/-]/g,' ').replace(/\s+/g,' ').trim();
 if(!cleaned)return null;
 const p=cleaned.split(' '); if(p.length<1||p.length>3||!p.every(x=>/^\d+$/.test(x)))return null;
 const y=Number(p[0]); if(y<1000||y>9999)return null;
 if(p.length===1)return {precision:'year',normalized:String(y).padStart(4,'0')};
 const mo=Number(p[1]); if(mo<1||mo>12)return null;
 if(p.length===2)return {precision:'month',normalized:`${String(y).padStart(4,'0')}-${pad(mo)}`};
 const d=Number(p[2]); if(d<1||d>31)return null;
 const t=utc(y,mo-1,d),v=ymd(t); if(v[0]!==y||v[1]!==mo||v[2]!==d)return null;
 return {precision:'day',normalized:`${String(y).padStart(4,'0')}-${pad(mo)}-${pad(d)}`};
}
function eventDetails(x){
 const result={subject:x.subject||'',place:x.place||'',original_date:x.original_date||'',verification:x.verification||'',description:''};
 const labels={'대상:':'subject','장소:':'place','원문 날짜:':'original_date','등록 상태:':'verification'};
 const body=[];
 for(const line of String(x.description||'').split('\n')){
  const trimmed=line.trim();const prefix=Object.keys(labels).find(p=>trimmed.startsWith(p));
  if(prefix){result[labels[prefix]] ||= trimmed.slice(prefix.length).trim();continue;}
  if(trimmed.startsWith('출처 파일:'))continue;
  body.push(line);
 }
 result.description=body.join('\n').trim();return result;
}
function normalizedSearchText(value){return String(value??'').trim().toLocaleLowerCase('ko-KR');}
function searchFieldScore(value,query,exact,start,contains){
 const text=normalizedSearchText(value);if(!text)return Infinity;
 if(text===query)return exact;
 if(text.startsWith(query))return start;
 if(text.includes(query))return contains;
 return Infinity;
}
function searchScore(x,query){
 const d=eventDetails(x);
 return Math.min(
  searchFieldScore(x.title,query,0,5,12),
  searchFieldScore(d.subject,query,8,14,22),
  searchFieldScore(x.country,query,10,16,24),
  searchFieldScore(d.place,query,12,18,26),
  searchFieldScore(x.category,query,16,22,30),
  searchFieldScore(x.region,query,18,24,32),
  searchFieldScore(x.date,query,20,26,34),
  searchFieldScore(d.description,query,45,50,60)
 );
}
function searchEvents(raw){
 const q=String(raw??'').trim();if(!q)return {all:[],shown:[],dateQuery:null};
 const dq=parseSearchDateQuery(q);let all;
 if(dq){
  all=DATA.filter(x=>dq.precision==='day'?x.date===dq.normalized:dq.precision==='month'?x.date.startsWith(dq.normalized):x.date.startsWith(dq.normalized))
    .slice()
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||(b.importance||0)-(a.importance||0)||a.id-b.id);
 }else{
  const query=normalizedSearchText(q);
  all=DATA.map(x=>({x,score:searchScore(x,query)}))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>a.score-b.score||(b.x.importance||0)-(a.x.importance||0)||String(a.x.date||'').localeCompare(String(b.x.date||''))||a.x.id-b.x.id)
    .map(item=>item.x);
 }
 return {all,shown:all.slice(0,10),dateQuery:dq};
}
function searchSuggestionHTML(x){
 const d=eventDetails(x);
 const sub=[x.country,d.subject].filter(Boolean).join(' · ');
 return `<button type="button" class="search-suggestion" role="option" data-id="${x.id}" title="${escapeHTML(d.description||x.title)}"><span class="ss-date">${escapeHTML(x.date)}</span><span class="ss-main"><strong>${escapeHTML(x.title)}</strong>${sub?`<small>${escapeHTML(sub)}</small>`:''}</span><span class="ss-meta">${escapeHTML(x.category||'미분류')} · ★ ${escapeHTML(x.importance??'—')}</span></button>`;
}
function hideSearchSuggestions(){searchResults.hidden=true;searchResults.replaceChildren();}
function renderSearch(){
 const q=searchInput.value.trim();
 if(!q){hideSearchSuggestions();return;}
 const result=searchEvents(q);
 if(!result.shown.length){
  searchResults.innerHTML='<div class="search-suggestion-empty">일치하는 사건이 없습니다.</div>';
  searchResults.hidden=false;
  return;
 }
 searchResults.innerHTML=result.shown.map(searchSuggestionHTML).join('');
 searchResults.hidden=false;
}
function zoomForEvent(x){return /^\d{4}-\d{2}-\d{2}$/.test(x.date)?LEVELS.findIndex(v=>v.kind==='day'):/^\d{4}-\d{2}$/.test(x.date)?LEVELS.findIndex(v=>v.kind==='month'):LEVELS.findIndex(v=>v.kind==='year');}
function navigateToEvent(id){
 const x=byId.get(Number(id));if(!x)return;const dt=parseDate(x);if(!dt)return;
 const regionKey={'유럽/아프리카':'europe','중동':'middle','동아시아/오세아니아':'east','아메리카':'americas'}[x.region];
 if(regionKey)applyMobileRegion(regionKey);
 hideSearchSuggestions();
 if(zoomTransition)stopZoomTransition();
 cancelAnimationFrame(animation);queuedZoom=null;wheelAccum=0;
 zoomFocusEventId=x.id;const target=Math.max(0,zoomForEvent(x));zoom=target;space.style.height=totalHeight(zoom)+'px';
 $('#level').textContent=LEVELS[zoom].name;$('#out').disabled=zoom===0;$('#in').disabled=zoom===LEVELS.length-1;
 const rowCenter=topAt(dt.t,zoom)+LEVELS[zoom].h/2;viewport.scrollTop=Math.max(0,rowCenter-viewport.clientHeight/2);render();
}
function goToBestSearchResult(){
 const first=searchEvents(searchInput.value).shown[0];
 if(first)navigateToEvent(first.id);
}
searchInput.addEventListener('input',renderSearch);
searchInput.addEventListener('focus',renderSearch);
searchInput.addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();goToBestSearchResult();return;}
 if(e.key==='Escape'){e.preventDefault();hideSearchSuggestions();searchInput.blur();}
});
searchGo.addEventListener('click',goToBestSearchResult);
searchResults.addEventListener('click',e=>{
 const result=e.target.closest('.search-suggestion');
 if(result)navigateToEvent(result.dataset.id);
});
document.addEventListener('pointerdown',e=>{if(!headerSearch.contains(e.target))hideSearchSuggestions();});

async function bootSameTimeWorld(){
 const statusEl=$('#status');
 loadLeaderHeaders(()=>timeAt(viewport.scrollTop+viewport.clientHeight/2,zoom),fetchFirebaseJSON);
 try{
  if(statusEl)statusEl.textContent='Firebase 사건 DB를 불러오는 중…';
  updateVersionLabels({});
  const [rawEvents,meta]=await Promise.all([
    fetchFirebaseJSON('events'),
    fetchFirebaseJSON('meta').catch(()=>({}))
  ]);
  DATA=normalizeFirebaseEvents(rawEvents);
  if(!DATA.length)throw new Error('Firebase /events가 비어 있습니다.');
  rebuildEventIndexes();
  updateVersionLabels(meta||{});
  initMobileRegionNav();
  window.addEventListener('resize',requestRender);
  space.style.height=totalHeight(zoom)+'px';
  viewport.scrollTop=topAt(utc(1900,0,1),zoom)-viewport.clientHeight/3;
  $('#level').textContent=LEVELS[zoom].name;
  render();
 }catch(error){
  console.error('Firebase events load failed:',error);
  if(statusEl)statusEl.textContent=`Firebase DB 로드 실패 · ${error?.message||error}`;
 }
}
bootSameTimeWorld();
