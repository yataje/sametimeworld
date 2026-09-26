import './style.css';

let DATA=[];

const PAGE_VERSION='v0.4.0';
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
}

const REGIONS=['유럽/아프리카','중동','동아시아/오세아니아','아메리카'];
const LEVELS=[{name:'10년',kind:'decade',n:10,h:290,limit:10},{name:'5년',kind:'five',n:5,h:320,limit:11},{name:'1년',kind:'year',n:1,h:350,limit:12},{name:'1개월',kind:'month',h:170,limit:5},{name:'보름',kind:'fortnight',h:154,limit:5},{name:'1주',kind:'week',h:138,limit:6},{name:'1일',kind:'day',h:122,limit:7}];
const $=s=>document.querySelector(s), viewport=$('#viewport'), space=$('#space'), rows=$('#rows');

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
const DISPLAY_DEFAULTS=Object.freeze({mapTransparency:58,eventFont:100});
const DISPLAY_LIMITS={mapTransparency:[0,100],eventFont:[80,140]};
let displaySettings={...DISPLAY_DEFAULTS};
function displayClamp(key,value){const [lo,hi]=DISPLAY_LIMITS[key];const n=Number(value);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):DISPLAY_DEFAULTS[key];}
function loadDisplaySettings(){try{const raw=JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY)||'{}');for(const k of Object.keys(DISPLAY_DEFAULTS))displaySettings[k]=displayClamp(k,raw[k]??DISPLAY_DEFAULTS[k]);}catch{displaySettings={...DISPLAY_DEFAULTS};}}
function saveDisplaySettings(){try{localStorage.setItem(DISPLAY_SETTINGS_KEY,JSON.stringify(displaySettings));}catch{}}
function applyDisplaySettings(shouldRender=false){
 const root=document.documentElement.style;
 root.setProperty('--map-opacity',String(1-displaySettings.mapTransparency/100));
 root.setProperty('--event-font-size',`${(11*displaySettings.eventFont/100).toFixed(2)}px`);
 syncDisplaySettingsControls();
 if(shouldRender&&typeof requestRender==='function')requestRender();
}
const DISPLAY_CONTROL_MAP={
 mapTransparency:['settingMapTransparency','settingMapTransparencyValue',v=>`${v}%`],
 eventFont:['settingEventFont','settingEventFontValue',v=>`${v}%`],
};
function syncDisplaySettingsControls(){for(const [key,[inputId,valueId,format]] of Object.entries(DISPLAY_CONTROL_MAP)){const input=document.getElementById(inputId),out=document.getElementById(valueId);if(input)input.value=displaySettings[key];if(out)out.textContent=format(displaySettings[key]);}}
loadDisplaySettings();applyDisplaySettings(false);
const displaySettingsOverlay=document.getElementById('displaySettingsOverlay');
const displaySettingsOpen=document.getElementById('displaySettingsOpen');
const displaySettingsClose=document.getElementById('displaySettingsClose');
function openDisplaySettings(){displaySettingsOverlay?.classList.add('open');syncDisplaySettingsControls();}
function closeDisplaySettings(){displaySettingsOverlay?.classList.remove('open');}
if(displaySettingsOpen)displaySettingsOpen.addEventListener('click',openDisplaySettings);
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
let zoomTransition=false, queuedZoom=null; const ZOOM_DURATION=800;
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
function render(){let z=zoom,level=LEVELS[z],height=viewport.clientHeight,top=viewport.scrollTop;let lo=Math.max(0,Math.floor(top/level.h)-4),hi=Math.min(bins[z].length-1,Math.ceil((top+height)/level.h)+4);let content='';
 for(let i=lo;i<=hi;i++){let b=bins[z][i], events=maps[z].get(i)||[],groups=REGIONS.map(r=>events.filter(x=>x.region===r));let cardList=groups.map(g=>{let sorted=g.slice().sort((a,b)=>(b.importance||0)-(a.importance||0)||a.date.localeCompare(b.date)||a.id-b.id);let limit=level.limit;let shown=selectTimelineCards(sorted,limit,zoomFocusEventId);
  let cards=shown.map(x=>{let fuzzy=(z===3&&x.precision==='연도')||(z>=4&&x.precision!=='일');let labelDate=x.date;return `<div role="button" tabindex="0" class="event ${fuzzy?'uncertain':''}" data-id="${x.id}" title="${escapeHTML(labelDate+' · '+x.title+(fuzzy?' · 정확한 날짜 미상':''))}"><span class="event-text"><strong>${escapeHTML(x.country||'미상')}</strong>${fuzzy?'≈ ':''}${escapeHTML(x.title)}</span><span class="event-category">${escapeHTML(x.category||'미분류')}</span><span class="event-importance" aria-label="중요도 ${x.importance??'미상'}">★ ${escapeHTML(x.importance??'—')}</span></div>`;}).join('');return cards+(g.length>limit?`<div class="more">외 ${g.length-limit}건 · 확대하여 보기</div>`:'')||'<div class="blank">·</div>';});
 content+=`<section class="timeline-row" style="top:${b.top}px;height:${b.height}px" data-index="${i}"><div class="date">${dateCellLabel(b,z)}<small>${events.length}건${z===LEVELS.length-1?' · 하루':''}</small></div>${cardList.map(x=>`<div>${x}</div>`).join('')}</section>`;
 }
 rows.innerHTML=content;
 let center=timeAt(top+height/2,z),[y,m,d]=ymd(center),kind=LEVELS[z].kind;$('#loc').textContent=(kind==='decade'||kind==='five'||kind==='year')?`${y}년`:kind==='month'?`${y}.${pad(m)}`:`${y}.${pad(m)}.${pad(d)}`;
 $('#status').textContent=`${DATA.length.toLocaleString('ko-KR')}건 · ${level.name} 단위`;
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
function setZoom(next,anchorY=viewport.clientHeight/2,anchorEventId=null){
 next=Math.max(0,Math.min(LEVELS.length-1,next));
 anchorY=Math.max(0,Math.min(viewport.clientHeight,anchorY));
 if(zoomTransition){queuedZoom={next,anchorY,anchorEventId};return;}
 if(next===zoom)return;
 // 연속 입력의 최종 목적지는 보관하되, 애니메이션은 인접한 단계씩 진행한다.
 if(Math.abs(next-zoom)>1){queuedZoom={next,anchorY,anchorEventId};next=zoom+Math.sign(next-zoom);}
 cancelAnimationFrame(animation);
 const previous=zoom;
 const anchorDate=next>previous?focusedEventDate(anchorEventId):null;
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
 const finish=()=>{
  incoming.cancel();snapshotAnimation.cancel();overlay.remove();zoomTransition=false;
  render();
  if(eventAnchored)reanchorFocusedEvent(anchorEventId,anchorY);
  if(queuedZoom){const q=queuedZoom;queuedZoom=null;setZoom(q.next,q.anchorY,q.anchorEventId);}
 };
 snapshotAnimation.finished.then(finish).catch(()=>{overlay.remove();zoomTransition=false;});
}
function requestedZoomBase(){return queuedZoom?queuedZoom.next:zoom;}
$('#in').onclick=()=>setZoom(requestedZoomBase()+1);
$('#out').onclick=()=>setZoom(requestedZoomBase()-1);
viewport.addEventListener('wheel',e=>{
 if(searchOverlay.classList.contains('open'))return;e.preventDefault();
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
  const anchorEventId=direction<0?hoveredEventId(e):null;
  setZoom(base-direction,anchorY,anchorEventId);
 }
},{passive:false});
viewport.addEventListener('scroll',requestRender,{passive:true});
viewport.addEventListener('pointerdown',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;if(e.button!==0||searchOverlay.classList.contains('open')||zoomTransition)return;zoomFocusEventId=null;cancelAnimationFrame(animation);dragging=true;dragMoved=false;lastY=e.clientY;recent=[{t:performance.now(),y:e.clientY}];viewport.classList.add('grabbing');viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!dragging)return;let delta=e.clientY-lastY;if(Math.abs(e.clientY-recent[0].y)>5)dragMoved=true;viewport.scrollTop-=delta;lastY=e.clientY;recent.push({t:performance.now(),y:e.clientY});while(recent.length>2&&performance.now()-recent[0].t>110)recent.shift();});
function release(e){if(!dragging)return;dragging=false;viewport.classList.remove('grabbing');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);if(!dragMoved){let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]');if(target)openWebForEvent(Number(target.dataset.id));return;}suppressClickUntil=performance.now()+260;let first=recent[0],last=recent[recent.length-1],dt=Math.max(1,last.t-first.t);let v=-(last.y-first.y)/dt*16;v=Math.max(-65,Math.min(65,v));function glide(){v*=.92;if(Math.abs(v)<.35)return;let old=viewport.scrollTop;viewport.scrollTop+=v;if(old===viewport.scrollTop)return;animation=requestAnimationFrame(glide);}if(Math.abs(v)>1)animation=requestAnimationFrame(glide);}
viewport.addEventListener('keydown',e=>{const card=e.target.closest('[data-id]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openWebForEvent(Number(card.dataset.id));}});
viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',e=>{dragMoved=true;release(e)});
viewport.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();return;}if(window.matchMedia('(pointer: coarse)').matches){const target=e.target.closest?.('[data-id]');if(target)openWebForEvent(Number(target.dataset.id));}},true);


const tabExperience=$('#tabExperience'), tabWeb=$('#tabWeb'), tabWebLabel=$('#tabWebLabel'), experiencePanel=$('#experiencePanel'), webPanel=$('#webPanel');
const webQuery=$('#webQuery'), webEventMeta=$('#webEventMeta');
let activeAppTab='experience';
function setAppTab(name){
 activeAppTab=name==='web'?'web':'experience';
 const web=activeAppTab==='web';
 tabExperience.classList.toggle('active',!web);tabWeb.classList.toggle('active',web);
 experiencePanel.classList.toggle('active',!web);webPanel.classList.toggle('active',web);
}
tabExperience.onclick=()=>setAppTab('experience');
tabWeb.onclick=()=>setAppTab('web');
function openWebForEvent(id){
 const x=byId.get(Number(id));if(!x)return;
 const d=eventDetails(x);
 tabWebLabel.textContent='사건 상세';
 webQuery.textContent=x.title;
 webEventMeta.textContent=[x.date,x.country,d.subject,x.category].filter(Boolean).join(' · ');
 const body=$('#eventDetailBody');body.replaceChildren();
 for(const [label,value] of [['대상',d.subject],['장소',d.place],['설명',d.description],['원문 날짜',d.original_date],['검증 상태',d.verification]]){
  if(!value)continue;
  const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+' ';p.append(strong,document.createTextNode(value));body.append(p);
 }
 const link=$('#externalSearch');link.hidden=false;
 link.href='https://www.google.com/search?q='+encodeURIComponent([x.date,d.subject,x.title].filter(Boolean).join(' '));
 setAppTab('web');
}
const searchOverlay=$('#searchOverlay'), searchInput=$('#searchInput'), searchResults=$('#searchResults'), searchSummary=$('#searchSummary');
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
function searchRank(x,q){
 const d=eventDetails(x),n=q.toLocaleLowerCase('ko-KR');
 if([x.title,d.subject].some(v=>String(v).toLocaleLowerCase('ko-KR')===n))return 0;
 if([x.title,d.subject].some(v=>String(v).toLocaleLowerCase('ko-KR').includes(n)))return 1;
 return 2;
}
function searchEvents(raw){
 const q=String(raw??'').trim(); if(!q)return {all:[],shown:[],dateQuery:null};
 const dq=parseSearchDateQuery(q); let all;
 if(dq){
  all=DATA.filter(x=>dq.precision==='day'?x.date===dq.normalized:dq.precision==='month'?x.date.startsWith(dq.normalized):x.date.startsWith(dq.normalized));
 }else{
  const n=q.toLocaleLowerCase('ko-KR');
  all=DATA.filter(x=>{const d=eventDetails(x);return [x.title,d.subject,d.place,d.description,x.country,x.category,x.region,x.date].some(v=>String(v??'').toLocaleLowerCase('ko-KR').includes(n));});
 }
 all=all.slice().sort((a,b)=>(dq?0:searchRank(a,q)-searchRank(b,q))||a.date.localeCompare(b.date)||(b.importance||0)-(a.importance||0)||a.id-b.id);
 return {all,shown:all.slice(0,100),dateQuery:dq};
}
function renderSearch(){
 const q=searchInput.value, result=searchEvents(q);
 if(!q.trim()){
  searchSummary.textContent='';
  searchResults.innerHTML='<div class="search-empty"><b>날짜 또는 사건명을 입력하세요.</b><br>1925 05 05 · 1925년 5월 5일 · 명성황후</div>';
  return;
 }
 searchSummary.textContent=result.all.length>100?`검색 결과 ${result.all.length.toLocaleString('ko-KR')}건 · 상위 100건 표시`:`검색 결과 ${result.all.length.toLocaleString('ko-KR')}건`;
 if(!result.shown.length){searchResults.innerHTML='<div class="search-empty">검색 결과가 없습니다.</div>';return;}
 searchResults.innerHTML=result.shown.map(x=>`<button type="button" class="search-result" data-id="${x.id}" title="${escapeHTML(eventDetails(x).description||x.title)}"><span class="sr-date">${escapeHTML(x.date)}</span><span class="sr-region">${escapeHTML(x.region)}</span><span class="sr-title">${escapeHTML(x.title)}${eventDetails(x).subject?`<small> · ${escapeHTML(eventDetails(x).subject)}</small>`:''}</span><span class="sr-category">${escapeHTML(x.category||'미분류')}</span><span class="sr-importance">★ ${escapeHTML(x.importance??'—')}</span></button>`).join('');
}
function openSearch(){searchOverlay.classList.add('open');searchInput.value='';renderSearch();requestAnimationFrame(()=>searchInput.focus());}
function closeSearch(){searchOverlay.classList.remove('open');searchInput.blur();}
function zoomForEvent(x){return /^\d{4}-\d{2}-\d{2}$/.test(x.date)?LEVELS.findIndex(v=>v.kind==='day'):/^\d{4}-\d{2}$/.test(x.date)?LEVELS.findIndex(v=>v.kind==='month'):LEVELS.findIndex(v=>v.kind==='year');}
function navigateToEvent(id){
 const x=byId.get(Number(id)); if(!x)return; const dt=parseDate(x); if(!dt)return;
 const regionKey={'유럽/아프리카':'europe','중동':'middle','동아시아/오세아니아':'east','아메리카':'americas'}[x.region];
 if(regionKey)applyMobileRegion(regionKey);
 closeSearch();
 if(zoomTransition){setTimeout(()=>navigateToEvent(id),ZOOM_DURATION+60);return;}
 cancelAnimationFrame(animation); queuedZoom=null; wheelAccum=0;
 zoomFocusEventId=x.id;const target=Math.max(0,zoomForEvent(x)); zoom=target; space.style.height=totalHeight(zoom)+'px';
 $('#level').textContent=LEVELS[zoom].name; $('#out').disabled=zoom===0; $('#in').disabled=zoom===LEVELS.length-1;
 const rowCenter=topAt(dt.t,zoom)+LEVELS[zoom].h/2; viewport.scrollTop=Math.max(0,rowCenter-viewport.clientHeight/2); render();
}
$('#searchOpen').onclick=openSearch;
$('#searchClose').onclick=closeSearch;
searchInput.addEventListener('input',renderSearch);
searchResults.addEventListener('click',e=>{const r=e.target.closest('.search-result');if(r)navigateToEvent(r.dataset.id);});
searchOverlay.addEventListener('click',e=>{if(e.target===searchOverlay)closeSearch();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&searchOverlay.classList.contains('open')){e.stopImmediatePropagation();closeSearch();}} ,true);


async function bootSameTimeWorld(){
 const statusEl=$('#status');
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
