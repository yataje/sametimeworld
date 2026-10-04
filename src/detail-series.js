import {indexEventChoices,detailActions,narrationParts} from './detail-series-core.js';
import {enableListDrag} from './list-drag.js';
import {createAutoReader} from './auto-reader.js';
const make=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e;};
const button=(label,fn,cls)=>{const b=make('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
/** Detail selection never navigates. Only a subsequent action/card click executes. */
export function createDetailSeriesUI({loadCatalogue,getEvents,getCustomSeries,onDetail,getReadout}){
 const host=document.getElementById('seriesDetailNav'),choices=document.getElementById('detailSeriesChoices'),actions=document.getElementById('detailSeriesActions'),status=document.getElementById('detailSeriesStatus'),panel=document.getElementById('seriesEventPanel'),cards=document.getElementById('seriesEventCards');
 let current=null,selected=null,index=null,indexKey='',map=null,visible=false,request=0,listOpen=false,offset=0;
 const PAGE=60,buttons=new Map(),listPositions=new Map();
 enableListDrag(cards);
 const currentButton=button('현재 사건으로',()=>renderCards({focusCurrent:true}),'series-current-button');
 document.getElementById('seriesEventClose').before(currentButton);
 const setStatus=msg=>{status.textContent=msg;status.title=msg;};
 const reader=createAutoReader({synth:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,
  readout:id=>{const e=map.get(id);return narrationParts(e,getReadout(e));},
  next:id=>{if(!visible||!selected)return null;return detailActions(selected.events,id,true).next;},
  onNavigate:id=>go(id,true),onState:s=>{updateActions();if(s.message)setStatus(s.message);}});
 for(const [key,label] of [['first','처음'],['previous','이전'],['tts','자동 TTS'],['next','다음'],['list','목록']]){
  const b=button(label,()=>execute(key),'detail-series-action');b.dataset.action=key;b.disabled=true;
  if(key==='list'){b.setAttribute('aria-controls','seriesEventPanel');b.setAttribute('aria-expanded','false');}
  if(key==='previous')b.setAttribute('aria-label','이전 사건');if(key==='next')b.setAttribute('aria-label','다음 사건');
  buttons.set(key,b);actions.append(b);
 }
 function rememberList(){if(listOpen&&selected)listPositions.set(selected.id,{offset,scrollTop:cards.scrollTop});}
 function hideList(){rememberList();listOpen=false;panel.hidden=true;document.getElementById('webPanel').classList.remove('series-list-open');buttons.get('list').setAttribute('aria-expanded','false');}
 function updateActions(){
  const state=detailActions(selected?.events||[],current,!!selected);
  for(const [key,b] of buttons)b.disabled=!state.enabled||(['previous','next'].includes(key)&&state[key]===null);
  for(const key of ['previous','next']){const e=map?.get(state[key]);buttons.get(key).title=e?`${e.date_label||e.date} · ${e.title}`:(key==='previous'?'첫 사건입니다.':'마지막 사건입니다.');}
  const speech=buttons.get('tts');speech.textContent=reader.playing?'정지':'자동 TTS';speech.setAttribute('aria-pressed',String(reader.playing));
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){speech.disabled=true;speech.title='이 브라우저는 음성 읽기를 지원하지 않습니다.';}
  buttons.get('list').setAttribute('aria-expanded',String(listOpen));
 }
 function summary(){const s=detailActions(selected?.events||[],current,!!selected);return s.enabled?`${selected.title} · ${s.index+1} / ${selected.events.length.toLocaleString()}건`:'관련 항목을 선택한 후 아래 동작을 누르세요.';}
 function choose(choice){
  reader.stop();hideList();selected=choice;renderChoices();updateActions();setStatus(summary());
  [...choices.querySelectorAll('button')].find(b=>b.dataset.choiceId===choice.id)?.focus({preventScroll:true});
 }
 function renderChoices(){
  const scroll=choices.scrollLeft;choices.replaceChildren();
  const rows=index?.get(current)||[];
  if(selected&&!rows.some(s=>s.id===selected.id))selected=null;
  for(const s of rows){const b=button(s.title,()=>choose(s),'detail-series-choice');b.dataset.choiceId=s.id;b.setAttribute('aria-pressed',String(selected?.id===s.id));const kind=s.kind==='concept'?(s.war_tag?'전쟁·전역 연결':`기존 ${s.type||'개념'} 연결`):s.kind==='local'?'내 브라우저 시리즈':s.kind==='entity'?`${s.entity_label||'대상'} 기록`:'기존 자동 시리즈';b.title=`${s.title} · ${kind} · ${s.events.length.toLocaleString()}건`;choices.append(b);}
  if(!rows.length)choices.append(make('span','등록된 관련 항목 없음','detail-series-empty'));
  choices.scrollLeft=scroll;updateActions();setStatus(summary());
 }
 function renderCards({focusCurrent=false}={}){
  if(!listOpen||!selected)return;
  const ids=selected.events,n=ids.indexOf(current);if(focusCurrent&&n>=0&&(n<=offset||n>=offset+PAGE))offset=Math.max(0,n-1);
  document.getElementById('seriesEventTitle').textContent=selected.title;
  document.getElementById('seriesEventCount').textContent=`사건 ${ids.length.toLocaleString()}건 · ${offset+1}–${Math.min(offset+PAGE,ids.length)}`;
  const oldScroll=cards.scrollTop;cards.replaceChildren();
  for(const id of ids.slice(offset,offset+PAGE)){
   const e=map.get(id),b=button('',()=>go(id),'series-event-card');b.dataset.eventId=String(id);b.title=`${e.date_label||e.date||'날짜 미상'} · ${e.title}`;b.setAttribute('aria-current',id===current?'true':'false');
   const meta=make('span',e.category||'','series-card-meta');
   if(e.importance){if(e.category)meta.append(document.createTextNode(' · '));meta.append(make('span',`★ ${e.importance}`,Number.isInteger(e.importance)&&e.importance>=1&&e.importance<=5?`importance-color-${e.importance}`:''));}
   b.append(make('small',e.date_label||e.date||'날짜 미상','series-card-date'),make('strong',e.title,'series-card-title'),make('span',e.locality||e.place||e.country||'지역 미상','series-card-place'),meta);cards.append(b);
  }
  if(ids.length>PAGE){const pager=make('nav',undefined,'series-card-pages');pager.setAttribute('aria-label','사건카드 목록 페이지');const prev=button('이전 묶음',()=>{offset=Math.max(0,offset-PAGE);renderCards();cards.scrollTop=0;}),next=button('다음 묶음',()=>{offset+=PAGE;renderCards();cards.scrollTop=0;});prev.disabled=offset===0;next.disabled=offset+PAGE>=ids.length;pager.append(prev,next);cards.append(pager);}
  cards.scrollTop=oldScroll;
  if(focusCurrent)requestAnimationFrame(()=>{if(!listOpen)return;const target=cards.querySelector('[aria-current="true"]');if(!target)return;cards.style.paddingBottom=`${Math.max(12,cards.clientHeight-target.offsetHeight-24)}px`;const previous=target.previousElementSibling;const anchor=previous?.classList.contains('series-event-card')?previous:target;cards.scrollTop=cards.scrollTop+anchor.getBoundingClientRect().top-cards.getBoundingClientRect().top-12;rememberList();});
 }
 function showList(){if(!selected)return;listOpen=true;panel.hidden=false;document.getElementById('webPanel').classList.add('series-list-open');const saved=listPositions.get(selected.id);offset=saved?.offset??Math.max(0,selected.events.indexOf(current)-1);renderCards({focusCurrent:!saved});if(saved)cards.scrollTop=saved.scrollTop;updateActions();}
 function go(id,fromTts=false){if(id==null||!selected?.events.includes(id))return;if(!fromTts)reader.stop();onDetail(id,{fromTts});}
 function execute(key){
  const s=detailActions(selected?.events||[],current,!!selected);if(!s.enabled)return;
  if(key==='tts'){if(reader.playing){reader.stop();setStatus(summary());}else reader.start(current);return;}
  if(key==='list'){showList();return;}
  go(s[key]);
 }
 async function setEvent(id,{fromTts=false}={}){
  if(!fromTts)reader.stop();visible=true;current=id;const ticket=++request;
  if(selected&&!selected.events.includes(id)){selected=null;hideList();}
  updateActions();
  if(!index)choices.replaceChildren(make('span','등록된 관련 항목을 읽는 중입니다…','detail-series-empty'));
  try{
   const catalogue=await loadCatalogue();if(ticket!==request||!visible)return;
   const custom=getCustomSeries(),key=JSON.stringify(custom);
   if(!index||key!==indexKey){map=new Map(getEvents().map(e=>[e.id,e]));index=indexEventChoices(catalogue,map,custom);indexKey=key;}
   renderChoices();renderCards({focusCurrent:true});if(reader.playing)setStatus('자동 TTS 재생 중 · '+summary());
  }catch(error){if(ticket!==request||!visible)return;selected=null;hideList();choices.replaceChildren(make('span','관련 항목을 불러오지 못했습니다.','detail-series-empty'),button('다시 읽기',()=>setEvent(current),'detail-series-choice'));updateActions();setStatus(String(error.message||error));}
 }
 document.getElementById('seriesEventClose').addEventListener('click',()=>{hideList();buttons.get('list').focus();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&reader.playing)reader.stop('다른 화면으로 이동하여 자동 TTS를 정지했습니다.');});
 window.addEventListener('pagehide',()=>reader.stop());
 host.hidden=false;
 return {setEvent,stopSpeech(){reader.stop();},leave(){visible=false;request++;reader.stop();hideList();},clear(){reader.stop();selected=null;hideList();if(index)renderChoices();},get selection(){return selected;}};
}
