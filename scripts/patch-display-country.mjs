import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'src/main.js');
let source=fs.readFileSync(target,'utf8');
const marker='function displayCountryName(value)';
if(!source.includes(marker)){
  const anchor="const escapeHTML=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));";
  if(!source.includes(anchor))throw new Error('display-country patch anchor not found');
  const helper=`\nconst DISPLAY_COUNTRY_ALIASES=new Map([\n ['잉글랜드 왕국','잉글랜드'],['프랑스 왕국','프랑스'],['스페인 왕국','스페인'],['스페인 군주국','스페인'],['포르투갈 왕국','포르투갈'],\n ['무굴 제국','무굴'],['오스만 제국','오스만'],['사파비 왕조','사파비'],['사파비 이란','사파비'],['신성로마제국','신성로마'],['신성 로마 제국','신성로마'],\n ['러시아 차르국','러시아'],['모스크바 대공국/러시아 차르국','러시아'],['네덜란드 공화국','네덜란드'],['스웨덴 왕국','스웨덴'],['덴마크 왕국','덴마크'],\n ['아유타야 왕국','아유타야'],['조호르 술탄국','조호르'],['비자야나가라 제국','비자야나가라'],['빌카밤바 신잉카국','빌카밤바'],\n ['폴란드 왕국 / 폴란드-리투아니아 연방','폴란드-리투아니아'],['일본 도쿠가와 정권','도쿠가와'],['무로마치 막부','무로마치'],['오다 정권','오다']\n]);\nfunction displayCountryName(value){\n const original=String(value??'').trim();if(!original)return '미상';\n const direct=DISPLAY_COUNTRY_ALIASES.get(original);if(direct)return direct;\n const colonial=original.replace(/^(?:에스파냐|스페인|포르투갈|잉글랜드|영국|프랑스|네덜란드)령\\s*/,'').trim();\n const parts=colonial.split(/\\s*[·/]\\s*/).filter(Boolean).map(part=>DISPLAY_COUNTRY_ALIASES.get(part)||part\n   .replace(/\\s+(?:왕국|제국|군주국|공화국|왕조|차르국|대공국|정권)$/,'')\n   .replace(/(?:왕국|제국|군주국|공화국|왕조|차르국|대공국|정권)$/,'').trim());\n const compact=[...new Set(parts.filter(Boolean))].join('·');\n return compact||original;\n}\n`;
  source=source.replace(anchor,anchor+helper);
}
const before=source;
source=source.replace(/escapeHTML\(x\.country\|\|'미상'\)/g,"escapeHTML(displayCountryName(x.country))");
if(source===before && !source.includes('escapeHTML(displayCountryName(x.country))'))throw new Error('country render expression not found');
fs.writeFileSync(target,source);
console.log('Applied compact timeline country labels.');
