const FIREBASE_LEADER_GROUP_ALIASES={
  '영국':'United Kingdom','United Kingdom':'United Kingdom',
  '프랑스':'France','France':'France',
  '독일':'Germany','Germany':'Germany',
  '러시아':'Russia','Russia':'Russia',
  '이탈리아':'Italy','Italy':'Italy',
  '헝가리':'Hungary','Hungary':'Hungary',
  '아프리카의 뿔 지역':'Horn of Africa area','Horn of Africa area':'Horn of Africa area',
  '남아프리카':'South Africa','South Africa':'South Africa',
  '라이베리아':'Liberia','Liberia':'Liberia',
  '튀르키예':'Turkey','Turkey':'Turkey',
  '이란':'Iran','Iran':'Iran',
  '이라크':'Iraq','Iraq':'Iraq',
  '사우디아라비아 지역':'Saudi Arabia','Saudi Arabia':'Saudi Arabia',
  '이집트':'Egypt','Egypt':'Egypt',
  '한반도':'Korea','Korea':'Korea',
  '대한민국':'South Korea','South Korea':'South Korea',
  '북한':'North Korea','North Korea':'North Korea',
  '중국':'China','China':'China',
  '일본':'Japan','Japan':'Japan',
  '베트남':'Vietnam','Vietnam':'Vietnam',
  '필리핀':'Philippines','Philippines':'Philippines',
  '인도네시아':'Indonesia','Indonesia':'Indonesia',
  '오스트레일리아':'Australia','Australia':'Australia',
  '뉴질랜드':'New Zealand','New Zealand':'New Zealand',
  '미국':'United States','United States':'United States',
  '캐나다':'Canada','Canada':'Canada',
  '멕시코':'Mexico','Mexico':'Mexico',
  '브라질':'Brazil','Brazil':'Brazil',
  '아르헨티나':'Argentina','Argentina':'Argentina',
  '칠레':'Chile','Chile':'Chile',
  '오스트리아-헝가리':'Austria-Hungary','Austria-Hungary':'Austria-Hungary',
  '오스트리아':'Austria','Austria':'Austria',
  '스페인':'Spain','Spain':'Spain',
  '네덜란드':'Netherlands','Netherlands':'Netherlands'
};

const FIREBASE_POLITY_ALIASES={
  '영국':'United Kingdom',
  '프랑스 제2공화국':'French Second Republic',
  '프랑스 제2제국':'Second French Empire',
  '프랑스 제3공화국':'French Third Republic',
  '비시 프랑스':'Vichy France',
  '프랑스 제4공화국':'French Fourth Republic',
  '프로이센 왕국':'Kingdom of Prussia',
  '독일 제국':'German Empire',
  '나치 독일':'Nazi Germany',
  '서독':'West Germany',
  '동독':'East Germany',
  '러시아 제국':'Russian Empire',
  '러시아 공화국':'Russian Republic',
  '소련':'Soviet Union',
  '이탈리아 왕국':'Kingdom of Italy',
  '이탈리아 공화국':'Republic of Italy',
  '오스만 제국':'Ottoman Empire',
  '조선':'Joseon',
  '대한제국':'Korean Empire',
  '대한민국':'South Korea: Republic of Korea',
  '청':'Qing dynasty',
  '중화민국':'Republic of China',
  '중화인민공화국':"People's Republic of China",
  '일본 제국':'Empire of Japan',
  '응우옌 왕조':'Nguyễn dynasty'
};


function leaderDateBound(value,isEnd=false){
 const v=String(value||'');
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 if(/^\d{4}-\d{2}$/.test(v))return isEnd?new Date(Date.UTC(Number(v.slice(0,4)),Number(v.slice(5,7)),0)).toISOString().slice(0,10):`${v}-01`;
 if(/^\d{4}$/.test(v))return `${v}-${isEnd?'12-31':'01-01'}`;
 return '';
}
export async function loadFirebaseLeaderGroups(fetchJSON){
 const raw=await fetchJSON('leaders');
 if(!raw||typeof raw!=='object')throw new Error('지도자 자료가 비어 있습니다.');
 const groups={};
 for(const x of Object.values(raw)){
  if(!x||typeof x!=='object')continue;
  const country=String(x.country_en||x.country||'').trim(),group=FIREBASE_LEADER_GROUP_ALIASES[country]||country;
  const polity=String(x.polity_en||x.polity||'');
  const from=x.possible_from||leaderDateBound(x.start),to=x.possible_to||leaderDateBound(x.end,true);
  const name=String(x.name_ko||x.name||x.name_en||'').trim();
  if(!group||!name||!from||!to||from>to)continue;
  (groups[group]??=[]).push({id:x.id,grp:group,polity:FIREBASE_POLITY_ALIASES[polity]||polity,name,
   role_type:x.role_type||'other_leader',office:x.office||x.office_en||'',active_from:from,active_to:to,
   start_precision:x.start_precision||'unknown',end_precision:x.end_precision||'unknown',
   is_acting:x.acting?1:0,verification_status:x.verification||x.verification_status||'',review_required:x.review_required?1:0});
 }
 if(!Object.keys(groups).length)throw new Error('사용 가능한 지도자 자료가 비어 있습니다.');
 return groups;
}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ready=false, failed=false, lastDate='';
export function setLeaderData(groups){
 if(!groups||typeof groups!=='object'||!Object.values(groups).some(rows=>Array.isArray(rows)&&rows.length))throw new Error('지도자 자료가 비어 있습니다.');
 LEADER_GROUP_DATA=groups;ready=true;failed=false;lastDate='';
}
export function leadersForDate(dateKey){
 const result={};
 for(const [region,cfgs] of Object.entries(LEADER_REGION_CONFIG))for(const cfg of cfgs)result[`${region}:${cfg.key}`]=localLeaderRows(cfg,dateKey);
 return result;
}
export function refreshLeaderHeaders(centerT){
 const dateKey=new Date(centerT).toISOString().slice(0,10);
 if(dateKey===lastDate)return;
 lastDate=dateKey;
 const mode=failed?'error':ready?'done':'loading',result=ready?leadersForDate(dateKey):null;
 for(const region of Object.keys(LEADER_REGION_CONFIG)){
  const el=document.getElementById(`leaders-${region}`);if(!el)continue;
  el.innerHTML=leaderRegionHTML(region,dateKey,result,mode);
  el.dataset.date=dateKey;
  const head=el.closest('.region-head');
  head.classList.remove('leader-loading','leader-ok','leader-error');
  head.classList.add(`leader-${mode==='done'?'ok':mode}`);
  const dot=head.querySelector('.leader-live-dot');
  if(dot)dot.title=`지도자 · ${dateKey} 기준${failed?' · 불러오기 실패':''}`;
 }
}
export async function loadLeaderHeaders(currentDate,fetchJSON){
 refreshLeaderHeaders(currentDate());
 try{
  setLeaderData(await loadFirebaseLeaderGroups(fetchJSON));
 }catch(error){
  failed=true;lastDate='';console.error('지도자 자료 불러오기 실패',error);
 }
 refreshLeaderHeaders(currentDate());
}
const LEADER_REGION_CONFIG={
 europe:[
  {key:'uk',label:'영국',eras:[{from:'1830-01-01',display:'영국',titles:['United Kingdom']}]},
  {key:'france',label:'프랑스',eras:[
   {from:'1830-01-01',to:'1852-12-02',display:'프랑스',titles:['French Second Republic']},
   {from:'1852-12-02',to:'1870-09-04',display:'프랑스',titles:['Second French Empire']},
   {from:'1870-09-04',to:'1940-07-10',display:'프랑스',titles:['French Third Republic']},
   {from:'1940-07-10',to:'1944-08-25',display:'프랑스',titles:['Vichy France','Free France']},
   {from:'1944-08-25',to:'1946-10-27',display:'프랑스',titles:['Provisional Government of the French Republic']},
   {from:'1946-10-27',display:'프랑스',titles:['French Fourth Republic']}]},
  {key:'germany',label:'독일',eras:[
   {from:'1830-01-01',to:'1871-01-18',display:'프로이센',titles:['Kingdom of Prussia']},
   {from:'1871-01-18',to:'1918-11-09',display:'독일제국',titles:['German Empire']},
   {from:'1918-11-09',to:'1933-01-30',display:'독일',titles:['Weimar Republic']},
   {from:'1933-01-30',to:'1945-05-08',display:'독일',titles:['Nazi Germany']},
   {from:'1945-05-08',to:'1949-05-23',display:'독일',titles:['Allied-occupied Germany']},
   {from:'1949-05-23',display:'독일',titles:['West Germany','East Germany']}]},
  {key:'russia',label:'러시아',eras:[
   {from:'1830-01-01',to:'1917-03-15',display:'러시아 제국',titles:['Russian Empire']},
   {from:'1917-03-15',to:'1917-11-07',display:'러시아',titles:['Russian Republic']},
   {from:'1917-11-07',to:'1922-12-30',display:'러시아',titles:['Russian Soviet Federative Socialist Republic']},
   {from:'1922-12-30',display:'소련',titles:['Soviet Union']}]},
  {key:'italy',label:'이탈리아',eras:[
   {from:'1830-01-01',to:'1861-03-17',display:'사르데냐',titles:['Kingdom of Sardinia']},
   {from:'1861-03-17',to:'1946-06-18',display:'이탈리아',titles:['Kingdom of Italy']},
   {from:'1946-06-18',display:'이탈리아',titles:['Italy']}]},
  {key:'hungary',label:'헝가리',eras:[
   {from:'1830-01-01',to:'1867-03-30',display:'헝가리',titles:['Kingdom of Hungary']},
   {from:'1867-03-30',to:'1918-11-16',display:'오헝',titles:['Austria-Hungary']},
   {from:'1918-11-16',to:'1920-03-01',display:'헝가리',titles:['First Hungarian Republic']},
   {from:'1920-03-01',to:'1946-02-01',display:'헝가리',titles:['Kingdom of Hungary (1920–1946)']},
   {from:'1946-02-01',to:'1949-08-20',display:'헝가리',titles:['Second Hungarian Republic']},
   {from:'1949-08-20',display:'헝가리',titles:["Hungarian People's Republic"]}]},
  {key:'ethiopia',label:'에티오피아',eras:[{from:'1830-01-01',display:'에티오피아',titles:['Ethiopian Empire']}]},
  {key:'southafrica',label:'남아공',eras:[{from:'1910-05-31',display:'남아공',titles:['Union of South Africa']}]},
  {key:'liberia',label:'라이베리아',eras:[{from:'1847-07-26',display:'라이베리아',titles:['Liberia']}]}
 ],
 middle:[
  {key:'turkey',label:'튀르키예',eras:[{from:'1830-01-01',to:'1922-11-01',display:'오스만',titles:['Ottoman Empire']},{from:'1922-11-01',display:'튀르키예',titles:['Turkey']}]},
  {key:'iran',label:'이란',eras:[{from:'1830-01-01',to:'1925-12-15',display:'카자르 이란',titles:['Qajar Iran']},{from:'1925-12-15',display:'이란',titles:['Pahlavi Iran']}]},
  {key:'iraq',label:'이라크',eras:[{from:'1920-11-11',to:'1932-10-03',display:'이라크',titles:['Mandatory Iraq']},{from:'1932-10-03',display:'이라크',titles:['Kingdom of Iraq']}]},
  {key:'saudi',label:'사우디',eras:[{from:'1902-01-01',to:'1921-11-02',display:'네지드',titles:['Emirate of Nejd and Hasa']},{from:'1921-11-02',to:'1926-01-08',display:'네지드',titles:['Sultanate of Nejd']},{from:'1926-01-08',to:'1932-09-23',display:'헤자즈·네지드',titles:['Kingdom of Hejaz and Nejd']},{from:'1932-09-23',display:'사우디',titles:['Saudi Arabia']}]},
  {key:'egypt',label:'이집트',eras:[{from:'1830-01-01',to:'1914-12-19',display:'이집트',titles:['Khedivate of Egypt']},{from:'1914-12-19',to:'1922-02-28',display:'이집트',titles:['Sultanate of Egypt']},{from:'1922-02-28',display:'이집트',titles:['Kingdom of Egypt']}]}
 ],
 east:[
  {key:'korea',label:'조선',eras:[{from:'1830-01-01',to:'1897-10-12',display:'조선',titles:['Joseon']},{from:'1897-10-12',to:'1910-08-29',display:'대한제국',titles:['Korean Empire']},{from:'1910-08-29',to:'1945-08-15',display:'조선',titles:['Korea under Japanese rule']},{from:'1945-08-15',to:'1948-08-15',display:'한국',titles:['South Korea']},{from:'1948-08-15',display:'대한민국',titles:['South Korea']}]},
  {key:'china',label:'중국',eras:[{from:'1830-01-01',to:'1912-02-12',display:'청',titles:['Qing dynasty']},{from:'1912-02-12',to:'1949-10-01',display:'중화민국',titles:['Republic of China (1912–1949)']},{from:'1949-10-01',display:'중국',titles:['China']}]},
  {key:'japan',label:'일본',roleOrder:'state-first',eras:[{from:'1830-01-01',to:'1947-05-03',display:'일본',titles:['Empire of Japan']},{from:'1947-05-03',display:'일본',titles:['Japan']}]},
  {key:'vietnam',label:'베트남',eras:[{from:'1830-01-01',to:'1945-03-11',display:'베트남',titles:['Nguyễn dynasty']},{from:'1945-03-11',to:'1945-08-25',display:'베트남',titles:['Empire of Vietnam']},{from:'1945-09-02',display:'베트남',titles:['North Vietnam']}]},
  {key:'philippines',label:'필리핀',eras:[{from:'1830-01-01',to:'1898-06-12',display:'필리핀',titles:['Captaincy General of the Philippines']},{from:'1898-06-12',to:'1901-03-23',display:'필리핀',titles:['First Philippine Republic']},{from:'1901-03-23',to:'1935-11-15',display:'필리핀',titles:['Insular Government of the Philippine Islands']},{from:'1935-11-15',to:'1946-07-04',display:'필리핀',titles:['Commonwealth of the Philippines']},{from:'1946-07-04',display:'필리핀',titles:['Philippines']}]},
  {key:'indonesia',label:'인도네시아',eras:[{from:'1830-01-01',to:'1945-08-17',display:'인도네시아',titles:['Dutch East Indies']},{from:'1945-08-17',display:'인도네시아',titles:['Indonesia']}]},
  {key:'australia',label:'호주',eras:[{from:'1901-01-01',display:'호주',titles:['Australia']}]},
  {key:'newzealand',label:'뉴질랜드',eras:[{from:'1841-05-03',to:'1907-09-26',display:'뉴질랜드',titles:['Colony of New Zealand']},{from:'1907-09-26',display:'뉴질랜드',titles:['Dominion of New Zealand']}]}
 ],
 americas:[
  {key:'usa',label:'미국',eras:[{from:'1830-01-01',display:'미국',titles:['United States']}]},
  {key:'canada',label:'캐나다',eras:[{from:'1830-01-01',to:'1867-07-01',display:'캐나다',titles:['Province of Canada']},{from:'1867-07-01',display:'캐나다',titles:['Canada']}]},
  {key:'mexico',label:'멕시코',eras:[{from:'1830-01-01',display:'멕시코',titles:['Mexico']}]},
  {key:'brazil',label:'브라질',eras:[{from:'1830-01-01',to:'1889-11-15',display:'브라질 제국',titles:['Empire of Brazil']},{from:'1889-11-15',display:'브라질',titles:['Brazil']}]},
  {key:'argentina',label:'아르헨티나',eras:[{from:'1830-01-01',display:'아르헨티나',titles:['Argentina']}]},
  {key:'chile',label:'칠레',eras:[{from:'1830-01-01',display:'칠레',titles:['Chile']}]}
 ]
};
const LEADER_REGION_LAYOUT={
 europe:[{label:'유럽',keys:['uk','france','germany','russia','italy','hungary']},{label:'아프리카',keys:['ethiopia','southafrica','liberia']}],
 middle:[{label:'서아시아',keys:['turkey','iran','iraq']},{label:'아라비아·이집트',keys:['saudi','egypt']}],
 east:[{label:'동아시아',keys:['korea','china','japan']},{label:'동남아·오세아니아',keys:['vietnam','philippines','indonesia','australia','newzealand']}],
 americas:[{label:'북미',keys:['usa','canada','mexico']},{label:'중남미',keys:['brazil','argentina','chile']}]
};
let LEADER_GROUP_DATA={};
const LOCAL_POLITY_ALIASES={"Weimar Republic":["Weimar Republic of Germany"],"Kingdom of Prussia":["Kingdom of Prussia","Electorate of Brandenburg, Kingdom of Prussia"],"Russian Soviet Federative Socialist Republic":["Russian Soviet Federative Socialist Republic, Sovereign state"],"Kingdom of Sardinia":["Kingdom of Sardinia, Duchy of Savoy"],"Italy":["Republic of Italy"],"Turkey":["Republic of Turkey"],"Ottoman Empire":["Ottoman (Turkish) Empire"],"Qajar Iran":["Persia: Qajar dynasty","Sublime State of Persia: Qajar dynasty"],"Pahlavi Iran":["Imperial State of Iran: Pahlavi dynasty"],"Mandatory Iraq":["Mandatory Iraq: Kingdom of Iraq under British Administration"],"South Korea":["South Korea: Republic of Korea"],"Republic of China (1912–1949)":["Republic of China"],"China":["People's Republic of China"],"Japan":["State of Japan"],"Empire of Japan":["Empire of Japan","Tokugawa shogunate of Japan"],"Nguyễn dynasty":["Nguyễn dynasty","Việt Nam: Nguyễn dynasty"],"North Vietnam":["Democratic Republic of Vietnam (North Vietnam, 1945–1976)"],"Indonesia":["Republic of Indonesia"],"Colony of New Zealand":["New Zealand"],"Mexico":["Mexico","United Mexican States","Second Federal Republic of Mexico","Second Mexican Empire"],"Brazil":["Empire of Brazil","First Brazilian Republic","Vargas Era Brazil","Fourth Brazilian Republic"],"Argentina":["Argentine Confederation","Argentine Republic"],"Chile":["Conservative Republic of Chile","Liberal Republic of Chile","Parliamentary Era Chile","Presidential Republic"],"Kingdom of Hungary (1920–1946)":["Kingdom of Hungary"]};
const LEADER_GROUP_MAP={uk:['United Kingdom'],france:['France'],germany:['Germany'],russia:['Russia'],italy:['Italy'],hungary:['Hungary'],ethiopia:['Horn of Africa area'],southafrica:['South Africa'],liberia:['Liberia'],turkey:['Turkey'],iran:['Iran'],iraq:['Iraq'],saudi:['Saudi Arabia'],egypt:['Egypt'],korea:['Korea','South Korea','North Korea'],china:['China'],japan:['Japan'],vietnam:['Vietnam'],philippines:['Philippines'],indonesia:['Indonesia'],australia:['Australia'],newzealand:['New Zealand'],usa:['United States'],canada:['Canada'],mexico:['Mexico'],brazil:['Brazil'],argentina:['Argentina'],chile:['Chile']};
const LEADER_ROLE_ORDER={russia:['party','gov','state','governor','other'],japan:['state','gov','party','governor','other'],germany:['state','gov','party','governor','other'],hungary:['state','gov','party','governor','other'],china:['state','gov','party','governor','other'],korea:['state','party','gov','governor','other'],italy:['gov','state','party','governor','other']};
const COLONIAL_LEADER_RULES={
 canada:[{from:'1850-01-01',to:'1867-07-01',controllerGroup:'United Kingdom',tag:'英',suppressCrowdedLocal:true}],
 korea:[{from:'1910-08-29',to:'1945-08-15',controllerGroup:'Japan',tag:'日',localTag:'임정'}],
 vietnam:[{from:'1887-10-17',to:'1945-03-09',controllerGroup:'France',tag:'佛'}],
 philippines:[{from:'1850-01-01',to:'1898-06-12',controllerGroup:'Spain',tag:'西'},{from:'1898-12-10',to:'1946-07-04',controllerGroup:'United States',tag:'美'}],
 indonesia:[{from:'1850-01-01',to:'1949-12-27',controllerGroup:'Netherlands',tag:'蘭',suppressCrowdedLocal:true}]
};
function activeEra(cfg,dateKey){return cfg.eras.find(x=>dateKey>=x.from&&(!x.to||dateKey<x.to))||null;}
function activeEraTitles(cfg,dateKey){const e=activeEra(cfg,dateKey);return e?e.titles:[];}
function activeEraDisplay(cfg,dateKey){const e=activeEra(cfg,dateKey);return e?(e.display||cfg.label):cfg.label;}
export function leaderRegionHTML(region,dateKey,result=null,mode='loading'){
 const cfgs=LEADER_REGION_CONFIG[region]||[],byKey=new Map(cfgs.map(c=>[c.key,c]));
 const layout=LEADER_REGION_LAYOUT[region]||[];
 return layout.map(group=>{
  const items=group.keys.map(key=>{
   const cfg=byKey.get(key);if(!cfg)return '';
   const era=activeEra(cfg,dateKey);if(!era)return '';
   const display=activeEraDisplay(cfg,dateKey),rows=result?.[`${region}:${cfg.key}`]||[],names=result?chooseLeaderNames(cfg,rows):[];
   let value=mode==='loading'?'…':(mode==='error'?'×':(names.join(' · ')||'—'));
   const uncertain=rows.some(r=>r.start_precision!=='day'||r.end_precision!=='day');
   let tip=mode==='error'?'지도자 자료를 불러오지 못했습니다. 새로고침해 주세요.':`${dateKey} · ${names.join(' · ')||`${display}: 해당 날짜의 자료 없음`}${uncertain?' · 재임 날짜 불확실(원본 정밀도 유지)':''}`;
   return `<span class="leader-inline-item ${names.length?'':'no-data'}" data-leader-key="${cfg.key}"><b>${escapeHTML(display)}:</b><span class="leader-names" title="${escapeHTML(tip)}">${escapeHTML(value)}</span></span>`;
  }).filter(Boolean).join('');
  return `<div class="leader-subrow"><div class="leader-subregion">${escapeHTML(group.label)}</div><div class="leader-inline-list">${items||'<span class="leader-inline-item no-data"><span class="leader-names">—</span></span>'}</div></div>`;
 }).join('');
}
function localRole(rec){
 if(rec.role_type==='head_of_government')return 'gov';
 if(['head_of_state','monarch_or_traditional_ruler','regent'].includes(rec.role_type))return 'state';
 if(rec.role_type==='party_leader')return 'party';
 if(rec.role_type==='governor_or_representative')return 'governor';
 return 'other';
}
function precisionValue(p){return p==='day'?3:(p==='month'?2:(p==='year'?1:0));}
function normalizedPolityName(s){return String(s||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[–—-]/g,' ').replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff\u3040-\u30ff\u3400-\u9fff가-힣]+/g,' ').replace(/\s+/g,' ').trim();}
function activePolityNames(cfg,dateKey){const names=new Set();for(const t of activeEraTitles(cfg,dateKey)){names.add(t);for(const a of LOCAL_POLITY_ALIASES[t]||[])names.add(a);}return [...names];}
function polityMatches(rec,cfg,dateKey){const p=normalizedPolityName(rec.polity),names=activePolityNames(cfg,dateKey).map(normalizedPolityName).filter(Boolean);if(!p||!names.length)return false;return names.some(n=>p===n||(n.length>7&&p.includes(n))||(p.length>7&&n.includes(p)));}
function leaderGroupsForCfg(cfg,dateKey){if(cfg.key==='hungary'&&dateKey<'1918-11-16')return ['Austria-Hungary','Austria','Hungary'];if(cfg.key==='korea'){if(dateKey>='1948-09-09')return ['South Korea','North Korea','Korea'];if(dateKey>='1948-07-24')return ['South Korea','Korea'];return ['Korea'];}return LEADER_GROUP_MAP[cfg.key]||[];}
function activeGroupRows(group,dateKey){return (LEADER_GROUP_DATA[group]||[]).filter(r=>r.active_from<=dateKey&&r.active_to>=dateKey);}
function roleOrderFor(cfg,override=null){if(override==='state-first')return ['state','gov','party','governor','other'];if(override==='party-first')return ['party','gov','state','governor','other'];return LEADER_ROLE_ORDER[cfg.key]||(cfg.roleOrder==='state-first'?['state','gov','party','governor','other']:['gov','state','party','governor','other']);}
function scoreLeaderRow(cfg,r,dateKey,override=null){const order=roleOrderFor(cfg,override),role=localRole(r),idx=order.indexOf(role),roleScore=Math.max(0,10-(idx>=0?idx:9))*300;const central=polityMatches(r,cfg,dateKey)?10000:0;const precision=(precisionValue(r.start_precision)+precisionValue(r.end_precision))*40;const verified=r.verification_status==='summary_and_detail_match'?90:(r.verification_status==='individual_source'?70:(r.verification_status==='source_year_only'?20:40));const review=Number(r.review_required||0)?-80:0,acting=Number(r.is_acting||0)?-25:0;return central+roleScore+precision+verified+review+acting;}
function sortLeaderRows(cfg,rows,dateKey,override=null){return rows.slice().sort((a,b)=>scoreLeaderRow(cfg,b,dateKey,override)-scoreLeaderRow(cfg,a,dateKey,override)||String(b.active_from).localeCompare(String(a.active_from)));}
function dedupeLeaderRows(rows){const seen=new Set(),out=[];for(const r of rows){const k=String(r.name||'').trim().toLowerCase();if(!k||seen.has(k))continue;seen.add(k);out.push(r);}return out;}
function localCandidates(cfg,dateKey){
 const all=leaderGroupsForCfg(cfg,dateKey).flatMap(g=>activeGroupRows(g,dateKey)).map(r=>({...r,side:'local'}));
 const central=all.filter(r=>polityMatches(r,cfg,dateKey));
 if(central.length)return central;
 // A country group may also contain dependencies and local kingdoms.
 // Missing national data must not turn those records into national leaders.
 if(cfg.key==='korea'&&colonialRuleFor(cfg,dateKey))return all.filter(r=>r.polity==='Provisional Government of the Republic of Korea');
 return [];
}
function colonialRuleFor(cfg,dateKey){return (COLONIAL_LEADER_RULES[cfg.key]||[]).find(x=>x.from<=dateKey&&dateKey<=x.to)||null;}
function controllerCandidates(cfg,dateKey,rule){if(!rule)return [];return activeGroupRows(rule.controllerGroup,dateKey).map(r=>({...r,side:'controller',controllerTag:rule.tag}));}
function displayLeaderName(r,rule=null){let name=String(r.name||'').trim();if(!name)return '';if(r.side==='controller'&&r.controllerTag)return `${name}(${r.controllerTag})`;if(r.side==='local'&&rule?.localTag&&/Provisional Government/i.test(r.polity||''))return `${name}(${rule.localTag})`;if(r.side==='local'&&rule&&/(First Philippine Republic|Revolutionary Government|Republic of Indonesia)/i.test(r.polity||''))return `${name}(독립측)`;return name;}
function localLeaderRows(cfg,dateKey){const rule=colonialRuleFor(cfg,dateKey),local=localCandidates(cfg,dateKey),controller=controllerCandidates(cfg,dateKey,rule);return [...local,...controller].map(r=>({...r,leader:r.name,label:r.name,role:localRole(r),start:r.active_from,end:r.active_to,office:r.office,review:r.review_required,_rule:rule,_dateKey:dateKey}));}
function chooseLeaderNames(cfg,rows){if(!rows.length)return [];const actualDate=rows[0]?._dateKey||'1900-01-01',rule=rows.find(r=>r._rule)?._rule||null;const local=dedupeLeaderRows(rows.filter(r=>r.side!=='controller')),controller=dedupeLeaderRows(rows.filter(r=>r.side==='controller'));if(rule){const l=sortLeaderRows(cfg,local,actualDate)[0],c=sortLeaderRows(cfg,controller,actualDate,'state-first')[0];return [l&&displayLeaderName(l,rule),c&&displayLeaderName(c,rule)].filter(Boolean).slice(0,2);}const sorted=sortLeaderRows(cfg,dedupeLeaderRows(rows),actualDate);if(!sorted.length)return [];const first=sorted[0],second=sorted.find((r,i)=>i>0&&localRole(r)!==localRole(first))||sorted[1];return [first,second].filter(Boolean).map(r=>displayLeaderName(r,null)).slice(0,2);}
