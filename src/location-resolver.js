/** Deterministic geography lookup. A matched representative is NOT an exact historical site.
 * Primary fields > event title > locative sentences > administrative area > country.
 * UI continents are never used, and ambiguous countries are never averaged.
 */
import geo from './geography-reference.js';
import extra from './location-extra.js';
import world from './world-data.js';
import {ALIASES} from './map-core.js';
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').normalize('NFC').replace(/[“”"'「」『』]/g,'').replace(/\s+/g,' ').trim();
const valid=v=>v!==null&&v!==undefined&&typeof v!=='boolean'&&String(v).trim()!==''&&Number.isFinite(Number(v));
const forbidden=new Set(['region','world','continent','unknown','unresolved']);
const suffix=/(?:특별자치도|특별자치시|특별시|광역시|자치도|자치구|직할시|지방|지역|도|주|현|성|군|구|시)$/;
const historical={부산포:'부산',제물포:'인천',한양:'서울',한성:'서울',경성:'서울',에도:'도쿄',동경:'도쿄',북경:'베이징',북평:'베이징',남경:'난징',상해:'상하이',스탈린그라드:'볼고그라드',차리친:'볼고그라드',콘스탄티노폴리스:'이스탄불',비잔티움:'이스탄불',페트로그라드:'상트페테르부르크',레닌그라드:'상트페테르부르크'};
const historicalCountries=[
 [/희망봉|케이프|코이코이/,'ZAF',['ZAF']],
 [/브라질/,'BRA',['BRA']], [/뉴네덜란드|뉴욕|매사추세츠|버지니아|메릴랜드/,'USA',['USA']],
 [/누에바에스파냐|누에바 에스파냐/,'MEX',['MEX','GTM','USA','BLZ']], [/누벨프랑스/,'CAN',['CAN','USA']],
 [/고와|탈로|보네|술라웨시|바타비아/,'IDN',['IDN']], [/팀북투|송가이/,'MLI',['MLI','NER']],
 [/페루/,'PER',['PER']], [/필리핀/,'PHL',['PHL']], [/퉁구|버마/,'MMR',['MMR']],
 [/사파비|페르시아/,'IRN',['IRN']], [/사드 왕조/,'MAR',['MAR']],
 [/무굴|마라타|비자푸르|데칸/,'IND',['IND','PAK','BGD','AFG']],
 [/에도|도쿠가와|도요토미/,'JPN',['JPN']],
 [/^(조선|대한제국|한국\(일제강점기\)|고려)(?:$|[ (·])/,'KOREA',['KOR','PRK']],
 [/잉글랜드|그레이트브리튼|스코틀랜드/,'GBR',['GBR','IRL']],
 [/^오스만(?: 제국)?$/,'TUR',['TUR','EGY','SYR','IRQ','ISR','PSE','JOR','LBN','GRC','BGR','ROU','ALB','MKD','SRB','BIH','TUN','LBY']],
 [/^신성로마제국$/,'DEU',['DEU','AUT','CZE','CHE','BEL','NLD','ITA']],
 [/^오스트리아[-· ]헝가리$|^오스트리아 제국$/,'AUT',['AUT','HUN','CZE','SVK','SVN','HRV','BIH']],
 [/교황령|베네치아|토스카나/,'ITA',['ITA']], [/러시아 차르국|러시아 제국|소련/,'RUS',['RUS','UKR','BLR','GEO','ARM','AZE','KAZ','UZB','TKM','TJK','KGZ','EST','LVA','LTU']],
 [/^(명|청)(?:나라|조| 왕조| 제국)?$/,'CHN',['CHN','TWN']],
];
const countryMap=new Map(world.features.map(f=>[f.properties.code,f]));
const countryAliases=new Map(Object.entries(ALIASES).map(([name,codes])=>[norm(name),codes]));
for(const f of world.features){countryAliases.set(norm(f.properties.name),[f.properties.code]);countryAliases.set(norm(f.properties.code),[f.properties.code]);}
const index=new Map();let allRows=[];
function addName(name,row){const key=norm(name).replace(/\s+(?=(?:주|도|현|성|군|구|시)$)/,'');if(!key||key.length>85)return;const rows=index.get(key)||[];if(!rows.some(x=>x.id===row.id))rows.push(row);index.set(key,rows);}
function register(row,precision,source,i){
 if(!valid(row.x)||!valid(row.y)||Math.abs(row.x)>180||Math.abs(row.y)>90)return;
 const r={...row,precision,id:row.id||`${source}:${precision}:${i}`,source:row.source||source};allRows.push(r);
 for(const name of row.n||[]){addName(name,r);const n=norm(name),base=n.replace(suffix,'');if(base.length>=2&&base!==n)addName(base,r);
  if(precision==='admin1'&&base.length>=2){const ends=row.c==='JPN'?['현','도','부']:row.c==='CHN'?['성','자치구']:['주','도'];for(const end of ends)addName(base+end,r);}
 }
}
geo.cities.forEach((r,i)=>register(r,'city','Natural Earth / existing name catalogue',i));
geo.admin1.forEach((r,i)=>register(r,'admin1','Natural Earth / existing name catalogue',i));
(extra.records||[]).forEach((r,i)=>register(r,r.precision,'GeoNames',i));
for(const [old,modern] of Object.entries(historical))for(const r of index.get(norm(modern))||index.get(norm(modern)+'도')||[])addName(old,r);
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const names=[...index.keys()].filter(k=>k.length>=2||k==='빈').sort((a,b)=>b.length-a.length||a.localeCompare(b));
const matcher=new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(escaped).join('|')})(?=$|[^\\p{L}\\p{N}]|에서|으로|에서의|에|의|은|는|을|를|과|와|시|군|구|현|성|주|도|항|지방법원|법원|역)`, 'gu');
function clean(s){return norm(s).replace(/https?:\/\/\S+/g,' ').replace(/(?:출처|자료 출처|source|참고)\s*:[^\n]*/gi,' ');}
function countryContext(value){
 const s=norm(value),modern=s.match(/(?:현재|현대|현)\s*([^()]+)/);if(modern){const c=countryContext(modern[1]);if(c.codes.length)return {...c,basis:'explicit_modern_geography'};}
 // Named colonial territory takes precedence over the foreign company/metropole.
 for(const [re,core,codes] of historicalCountries)if(re.test(s))return {codes,core,name:String(value),basis:'historical_core_representative'};
 let codes=countryAliases.get(s);if(!codes){const stripped=s.replace(/\([^)]*\)/g,'').replace(/\s*(왕국|공화국|군주국|왕조|제국|식민정부|임시정부)$/,'').trim();codes=countryAliases.get(stripped);}
 if(codes)return {codes:[...codes],core:codes.length===1?codes[0]:null,name:String(value),basis:'declared_country'};
 const parts=s.split(/[·,/]| 및 |와 |과 /).map(x=>x.trim()).filter(Boolean),out=[];
 for(const p of parts){const hit=countryAliases.get(p)||countryAliases.get(p.replace(/\s*(왕국|공화국|제국|왕조)$/,''));if(hit)out.push(...hit);}
 return {codes:[...new Set(out)],core:[...new Set(out)].length===1?out[0]:null,name:String(value||''),basis:'declared_country'};
}
function precisionWanted(text,codes){
 if(/(?:군|구|district|county)\s*$/i.test(text))return 'admin2';
 if(/현\s*$/.test(text))return codes.includes('JPN')?'admin1':'admin2';
 if(/(?:도|주|성|province|prefecture|state)\s*$/i.test(text))return 'admin1';return null;
}
function dist(a,b){return Math.hypot((a.x-b.x)*Math.cos((a.y+b.y)*Math.PI/360),a.y-b.y);}
function collapse(rows){const out=[];for(const r of rows)if(!out.some(x=>x.c===r.c&&x.precision===r.precision&&dist(x,r)<.28))out.push(r);return out;}
function hits(text,field,ctx,title=''){
 const s=clean(text).replace(/([가-힣])\s+(주|도|현|성|군|구|시)(?=$|[\s·,;])/g,'$1$2');if(!s||/^(미상|위치 미상|자료 없음|세계|유럽\/아프리카)$/.test(s))return [];
 const found=[];const ordinary=new Set(['군대','전쟁','학교','정부','은행','계획','지역','공화국','제국','동맹','왕국','수도','항구','공장','혁명','노동','건설','상륙','사건','회의','발발','전국','조약','협정','문화','경제','정치','종교','일반','개혁','연합','해군','육군','군사','중앙','결정','완료']);matcher.lastIndex=0;let m;
 while((m=matcher.exec(s))){if(ordinary.has(m[1]))continue;const tail=s.slice(m.index+m[0].length),prefix=s.slice(Math.max(0,m.index-25),m.index);
  if(field==='description'){
   if(!/^(?:에서|에\s|에$|에[는서])/.test(tail))continue;
   if(/^(?:에서|에)?\s*(?:관한|대한|따르면|관하여|대하여|비유|관심|영향)/.test(tail))continue;
  }
  if(!/출생|탄생/.test(title)&&(/^(?:에서)?\s*(?:출신|출생|태어난|고향)/.test(tail)||/(?:출신|출생지|고향|배경)\s*$/.test(prefix)))continue;
  const wanted=precisionWanted(m[0]+(tail.match(/^(?:시|군|구|현|성|주|도)/)?.[0]||''),ctx.codes);
  let rows=(index.get(m[1])||[]).filter(r=>!ctx.codes.length||ctx.codes.includes(r.c));
  if(wanted){const typed=rows.filter(r=>r.precision===wanted||(wanted==='admin2'&&/^admin[234]$/.test(r.precision)));if(typed.length)rows=typed;}
  else {const cities=rows.filter(r=>r.precision==='city');if(cities.length)rows=cities;}
  if(field==='title')rows=rows.filter(r=>r.source.startsWith('Natural Earth')||r.precision!=='city'||/^PPLC|^PPLA/.test(r.feature||'')||/^(?:에서|에\s)/.test(tail));
  const primary=rows.filter(r=>r.source.startsWith('Natural Earth'));if(primary.length)rows=primary;
  rows=collapse(rows);
  if(rows.length>1){const scoped=rows.filter(r=>(r.n||[]).some(n=>s.includes(norm(n)))&&r.a&&s.includes(norm(r.a)));if(scoped.length===1)rows=scoped;}
  if(rows.length===1)found.push({row:rows[0],matched:m[0],field,position:m.index,explicitAdmin:!!wanted});
 }
 return found.filter((x,i,a)=>a.findIndex(y=>y.row.id===x.row.id)===i);
}
function asPoint(hit){const r=hit.row;return {name:(r.n||[]).find(n=>/[가-힣]/.test(n))||(r.n||[])[0]||hit.matched,lat:r.y,lon:r.x,precision:r.precision,country_code:r.c,place_id:r.id,status:'gazetteer_context_matched',method:`${hit.field}_name_country_match`,matched:hit.matched,source:r.source,evidence:hit.field==='description'?'본문의 발생 장소 표현':'등록 지명과 국가·행정구역 문맥',note:'현대 지명 자료의 대표점이며 사건 현장의 정확한 좌표를 뜻하지 않습니다.'};}
function stored(event){if(!valid(event.latitude)||!valid(event.longitude)||forbidden.has(event.location_precision)||Math.abs(Number(event.latitude))>90||Math.abs(Number(event.longitude))>180)return null;
 if(Number(event.latitude)===0&&Number(event.longitude)===0)return null;
 if(event.map_status==='unresolved')return null;
 return {name:event.resolved_place||event.map_region||event.locality||event.place||event.country||'기존 위치',lat:Number(event.latitude),lon:Number(event.longitude),precision:event.location_precision||'db',status:event.map_status||'inherited_context_checked_not_reverified',method:event.location_resolution_method||'preserved_existing',source:event.location_source||'previous database',country_code:event.location_country_code||null,place_id:event.location_place_id||null,note:event.location_note||''};
}
function representative(ctx){
 if(ctx.core==='KOREA'){
  // Bounding-box centre of the two modern Korean polygons, never a continent centre.
  const coords=world.features.filter(f=>ctx.codes.includes(f.properties.code)).flatMap(f=>f.geometry.coordinates.flat(Infinity).reduce((a,v,i,all)=>(i%2===0&&a.push([v,all[i+1]]),a),[]));
  const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
  return {name:'한반도 대표점',lon:(Math.min(...xs)+Math.max(...xs))/2,lat:(Math.min(...ys)+Math.max(...ys))/2,precision:'country',country_code:'KOR+PRK',status:'country_representative',method:'historical_country_representative',source:'Natural Earth modern Korean land bounds',note:'조선·대한제국의 세부 위치 미확정. 한반도 개략 대표점이며 역사적 국경의 중심을 계산한 것은 아닙니다.'};
 }
 const f=countryMap.get(ctx.core);if(!f)return null;const p=f.properties;
 return {name:ctx.name||p.name,lon:p.labelPoint[0],lat:-p.labelPoint[1],precision:'country',country_code:ctx.core,place_id:'country:'+ctx.core,status:'country_representative',method:ctx.basis,source:'Natural Earth country label point',note:ctx.basis==='historical_core_representative'?`${ctx.name}의 세부 위치 미확정. 현대 ${p.name} 권역 대표점으로 표시하며 당시 영토의 정확한 중심을 뜻하지 않습니다.`:'세부 위치를 확정하지 못해 국가 대표점으로 표시합니다. 사건의 실제 현장 좌표는 아닙니다.'};
}
export function resolveLocation(event){
 if(/^(?:배핀섬\s*)?요크사운드(?:\s*일대)?$|^york sound$/i.test(String(event.place||'').trim()))return {name:String(event.place),lon:-66.483333,lat:62.408333,precision:'named_region',status:'inherited_context_checked_not_reverified',method:'preserved_named_region',source:'existing named-region reference',note:'기존 자료의 지명 대표점입니다.'};
 if(event.location_policy_version===2){if(event.map_status==='unresolved')return null;return stored(event);}
 const prev=stored(event);if(prev&&event.map_status==='reference_coordinate_checked'&&prev.precision!=='country')return prev;
 let ctx=countryContext(event.country);
 // Country qualifiers in the place field represent geography, not actor nationality.
 for(const v of [event.place,event.locality]){const m=String(v||'').match(/(?:현재|현대|현)\s*([^),;]+)/);if(m){const c=countryContext(m[1]);if(c.codes.length)ctx=c;}}
 const locHits=[...hits(event.place,'place',ctx,event.title),...hits(event.locality,'locality',ctx,event.title),...hits(event.map_region,'map_region',ctx,event.title)];
 const direct=locHits.filter((h,i,a)=>a.findIndex(x=>x.row.id===h.row.id)===i);
 const heading=hits(event.title,'title',ctx,event.title),body=hits(event.description,'description',ctx,event.title);
 const finer=(h,area)=>h.row.c===area.row.c&&(h.row.precision==='city'||/^admin[234]$/.test(h.row.precision))&&dist(h.row,area.row)<4;
 if(direct.length===1){const h=direct[0];if(h.row.precision==='admin1'){const fine=[...heading,...body].filter(x=>finer(x,h));if(collapse(fine.map(x=>x.row)).length===1&&fine.length)return asPoint(fine[0]);}return asPoint(h);}
 if(direct.length>1){const specific=direct.filter(h=>h.row.precision==='city'||/^admin[234]$/.test(h.row.precision));if(specific.length===1&&direct.every(h=>h===specific[0]||h.row.precision==='admin1'&&finer(specific[0],h)))return asPoint(specific[0]);return representative(ctx);}
 if(heading.length===1)return asPoint(heading[0]);
 if(!heading.length&&body.length===1)return asPoint(body[0]);
 if(prev&&prev.precision!=='country')return prev;
 // A province recorded in the country field still deserves a province point.
 const area=hits(event.country,'country_field',ctx,event.title).filter(x=>x.row.precision==='admin1');if(area.length===1)return asPoint(area[0]);
 return representative(ctx);
}
export const geographyStats=()=>({cities:geo.cities.length,admin1:geo.admin1.length,supplemental:(extra.records||[]).length,aliases:index.size});
