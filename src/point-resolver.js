import geo from './geography-reference.js';
import world from './world-data.js';
import {ALIASES,GROUPS,regionId} from './map-core.js';

const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[“”"'「」『』]/g,'').replace(/\s+/g,' ').trim();
const trimSuffix=s=>norm(s).replace(/특별시$|광역시$|자치시$|자치도$|자치구$|직할시$|도$|주$|현$|부$|시$/,'');
const HISTORICAL=new Map([
 ['한양','서울'],['한성','서울'],['경성','서울'],
 ['스탈린그라드','볼고그라드'],['차리친','볼고그라드'],
 ['콘스탄티노폴리스','이스탄불'],['비잔티움','이스탄불'],
 ['에도','도쿄도'],['동경','도쿄도'],
 ['페트로그라드','상트페테르부르크'],['레닌그라드','상트페테르부르크']
]);
const adminIndex=new Map(),cityIndex=new Map();
function add(index,name,row){const k=trimSuffix(name);if(!k)return;(index.get(k)??index.set(k,[]).get(k)).push(row);}
for(const row of geo.admin1)for(const n of row.n||[])add(adminIndex,n,row);
for(const row of geo.cities)for(const n of row.n||[])add(cityIndex,n,row);
const countryByCode=new Map(world.features.map(f=>[f.properties.code,f.properties]));
function countryCodes(value){
 const s=String(value??'').trim();
 if(ALIASES[s])return [...ALIASES[s]];
 const clean=s.replace(/\([^)]*\)/g,'').trim();
 if(ALIASES[clean])return [...ALIASES[clean]];
 const parts=clean.split(/[·,/]/).map(x=>x.trim()).filter(Boolean),out=[];
 if(parts.length>1&&parts.every(p=>ALIASES[p]))for(const p of parts)out.push(...ALIASES[p]);
 return [...new Set(out)];
}
function cleanCandidate(value){
 let s=String(value??'').trim();if(!s||/^(?:미상|전국|세계|해당 날짜의 자료 없음)$/.test(s))return '';
 s=s.replace(/\([^)]*(?:현재|현대)[^)]*\)/g,'').trim();
 const modern=s.match(/(?:,|·)?\s*현재\s+(?:대한민국|한국|중국|일본|러시아|미국|영국|프랑스|이탈리아|스페인|포르투갈|인도|튀르키예|터키|이란|페루|멕시코|브라질)?\s*([^,;]+)/);
 if(modern?.[1])s=modern[1].trim();
 s=s.split(/[;|]/)[0].trim();
 const possessive=s.match(/^(.{1,28}?)의\s+(?:탈주\s+노예\s+)?(?:공동체|식민\s*세력|식민지|정착지|점령지|점령군정|자치령)/);
 if(possessive)s=possessive[1];
 s=s.replace(/\s+(?:총대주교좌|대교구|교구)$/,'');
 s=s.replace(/\s+(?:왕국|제국|군주국|공화국|연방|왕조|차르국|대공국|정권|막부|술탄국|자치령|보호령|식민지|총독령|부왕령|점령지|점령군정|군정|점령군|점령세력|식민\s*세력|공동체|정착지|정부|통치령)$/,'');
 return s.trim();
}
function scoreCandidate(row,codes){
 if(!codes?.length)return 0;
 return codes.includes(row.c)?10:-10;
}
function choose(index,name,codes){
 const key=trimSuffix(name),direct=index.get(key)||[];
 if(direct.length)return direct.slice().sort((a,b)=>scoreCandidate(b,codes)-scoreCandidate(a,codes))[0];
 let best=null,bestLen=0;
 for(const [k,rows] of index){
  if(k.length<2||(!key.includes(k)&&!k.includes(key)))continue;
  const ranked=rows.slice().sort((a,b)=>scoreCandidate(b,codes)-scoreCandidate(a,codes))[0];
  const score=scoreCandidate(ranked,codes);
  if(score<0)continue;
  if(k.length>bestLen){best=ranked;bestLen=k.length;}
 }
 return best;
}
function candidateNames(event){
 const vals=[event.map_region,event.locality,event.place,event.country].filter(Boolean).map(cleanCandidate).filter(Boolean);
 const out=[];
 for(let v of vals){
  const h=HISTORICAL.get(v);if(h)v=h;
  out.push(v);
  for(const p of v.split(/\s*[·/,]\s*/))if(p&&p!==v)out.push(p);
 }
 return [...new Set(out)];
}
function regionFallback(event){
 const id=regionId(event.region);if(!id)return {name:'세계',lon:0,lat:0,precision:'world'};
 const b=GROUPS[id].bounds;return {name:GROUPS[id].label,lon:(b[0]+b[2])/2,lat:-(b[1]+b[3])/2,precision:'region'};
}
export function resolvePoint(event){
 const lat=Number(event.latitude),lon=Number(event.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lon))return {name:event.map_region||event.locality||event.place||event.country||'위치',lat,lon,precision:event.location_precision||'db'};
 const codes=countryCodes(event.country);
 for(const name of candidateNames(event)){
  const wantsAdmin=/(?:주|도|현|부|성|자치구|직할시|특별시|광역시)$/.test(name);
  const first=wantsAdmin?choose(adminIndex,name,codes):choose(cityIndex,name,codes);
  const second=wantsAdmin?choose(cityIndex,name,codes):choose(adminIndex,name,codes);
  const hit=first||second;if(hit)return {name,lon:hit.x,lat:hit.y,precision:first===choose(adminIndex,name,codes)?'admin1':'city'};
 }
 const pts=codes.map(c=>countryByCode.get(c)).filter(Boolean);
 if(pts.length){
  const lon=pts.reduce((s,p)=>s+p.labelPoint[0],0)/pts.length;
  const lat=-pts.reduce((s,p)=>s+p.labelPoint[1],0)/pts.length;
  return {name:cleanCandidate(event.country)||event.country||'국가',lon,lat,precision:'country'};
 }
 return regionFallback(event);
}
