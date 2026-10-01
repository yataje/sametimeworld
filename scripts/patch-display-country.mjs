import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'src/main.js');
let source=fs.readFileSync(target,'utf8');

const localityField="locality:String(x.locality??'')";
const geoFields="locality:String(x.locality??''),map_region:String(x.map_region??''),latitude:x.latitude==null?null:Number(x.latitude),longitude:x.longitude==null?null:Number(x.longitude),location_precision:String(x.location_precision??'')";
if(source.includes(localityField)&&!source.includes("map_region:String(x.map_region??'')"))source=source.replace(localityField,geoFields);

for(const old of ['function displayCountryName(value)','function displayTimelinePlace(x)']){
 if(!source.includes(old))continue;
 const starts=[source.indexOf('const DISPLAY_COUNTRY_ALIASES='),source.indexOf('const DISPLAY_PLACE_ALIASES=')].filter(n=>n>=0);
 const start=starts.length?Math.min(...starts):-1;
 const end=source.indexOf('let bins=',start);
 if(start>=0&&end>start)source=source.slice(0,start)+source.slice(end);
}
source=source.replace(/escapeHTML\(displayCountryName\(x\.country\)\)/g,"escapeHTML(displayTimelinePlace(x))");
source=source.replace(/escapeHTML\(displayTimelinePlace\(x\)\)/g,"escapeHTML(displayTimelinePlace(x))");

const anchor="const escapeHTML=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));";
if(!source.includes(anchor))throw new Error('timeline-place patch anchor not found');

const helper=`
const DISPLAY_PLACE_ALIASES=new Map([
 ['잉글랜드 왕국','잉글랜드'],['프랑스 왕국','프랑스'],['스페인 왕국','스페인'],['스페인 군주국','스페인'],['포르투갈 왕국','포르투갈'],
 ['무굴 제국','무굴'],['오스만 제국','오스만'],['사파비 왕조','사파비'],['사파비 이란','사파비'],['신성로마제국','신성로마'],['신성 로마 제국','신성로마'],
 ['러시아 차르국','러시아'],['모스크바 대공국/러시아 차르국','러시아'],['네덜란드 공화국','네덜란드'],['스웨덴 왕국','스웨덴'],['덴마크 왕국','덴마크'],
 ['폴란드 왕국 / 폴란드-리투아니아 연방','폴란드-리투아니아'],['아유타야 왕국','아유타야'],['조호르 술탄국','조호르'],
 ['비자야나가라 제국','비자야나가라'],['빌카밤바 신잉카국','빌카밤바'],['무로마치 막부','무로마치'],['오다 정권','오다']
]);
const PLACE_STATUS_WORDS=/(?:왕국|제국|군주국|공화국|연방|왕조|차르국|대공국|정권|막부|술탄국|자치령|보호령|식민지|총독령|부왕령|점령지|점령군정|군정|점령군|점령세력|식민\\s*세력|공동체|정착지|정부|통치령|령)$/;
function stripPlaceStatus(value){
 let part=String(value??'').trim();if(!part)return '';
 const direct=DISPLAY_PLACE_ALIASES.get(part);if(direct)return direct;
 part=part.replace(/\\([^)]*(?:정부|왕조|정권|점령|식민|군정)[^)]*\\)/g,'').trim();
 part=part.replace(/^(?:에스파냐|스페인|포르투갈|잉글랜드|영국|프랑스|네덜란드)령\\s*/,'');
 part=part.replace(/^(.{1,22}?)의\\s+(?:탈주\\s+노예\\s+)?(?:공동체|식민\\s*세력|식민지|정착지|점령지|점령군정|자치령).*$/,'$1');
 part=part.replace(/^(?:오스만|스페인|에스파냐|포르투갈|잉글랜드|영국|프랑스|네덜란드)\\s+(.+?)(?:\\s+(?:지방|지역|총독령|부왕령|식민지|식민\\s*세력|점령지|점령군정))$/,'$1');
 part=part.replace(/\\s+(?:총대주교좌|대교구|교구)$/,'');
 while(PLACE_STATUS_WORDS.test(part))part=part.replace(PLACE_STATUS_WORDS,'').trim();
 part=part.replace(/\\s+(?:식민|점령|자치|군정|통치)\\s*(?:세력|정부|당국)$/,'').trim();
 return part;
}
function compactPurePlace(value,{locality=false}={}){
 const original=String(value??'').trim();if(!original)return '';
 const direct=DISPLAY_PLACE_ALIASES.get(original);if(direct)return direct;
 let text=original.replace(/[“”"'「」『』]/g,'').trim();
 if(locality){
   text=text.split(/\\s*[;|]\\s*/)[0];
   const possessive=text.match(/^(.{1,24}?)의\\s+/);
   if(possessive)text=possessive[1];
 }
 const parts=text.split(/\\s*[·/]\\s*/).map(stripPlaceStatus).filter(Boolean);
 const cleaned=[...new Set(parts)].filter(p=>!/(?:식민\\s*세력|점령군|점령세력|군정당국|통치당국)$/.test(p));
 if(locality&&cleaned.length>1)return cleaned[0];
 return cleaned.join('·')||stripPlaceStatus(text)||original;
}
function displayTimelinePlace(x){
 const locality=compactPurePlace(x?.map_region,{locality:true})||compactPurePlace(x?.locality,{locality:true});
 if(locality)return locality;
 return compactPurePlace(x?.country)||'미상';
}
`;
source=source.replace(anchor,anchor+helper);
const before=source;
source=source.replace(/escapeHTML\(x\.country\|\|'미상'\)/g,"escapeHTML(displayTimelinePlace(x))");
source=source.replace(/escapeHTML\(displayCountryName\(x\.country\)\)/g,"escapeHTML(displayTimelinePlace(x))");
if(source===before && !source.includes('escapeHTML(displayTimelinePlace(x))'))throw new Error('timeline place render expression not found');
fs.writeFileSync(target,source);
console.log('Applied pure-place timeline labels.');
