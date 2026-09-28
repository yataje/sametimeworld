import {SUBREGIONS,resolveSubregion} from './subregions.js';
// Accepted map prototype v0.3 motion. Map coordinates: longitude, minus latitude.
  'use strict';
  const WORLD_BOUNDS=Object.freeze([-30,-90,330,90]); // Pacific-centred, Europe left / Americas right.
  const GROUPS={
    europe:{label:'유럽 / 아프리카',bounds:[-25,-76,70,38]},
    middle:{label:'중동',bounds:[24,-50,76,-7]},
    east:{label:'동아시아 / 오세아니아',bounds:[66,-63,190,51]},
    americas:{label:'아메리카 / 하와이',bounds:[-171,-80,-30,59]}
  };
  const names={
    미국:'USA',캐나다:'CAN',멕시코:'MEX',쿠바:'CUB',브라질:'BRA',칠레:'CHL',페루:'PER',볼리비아:'BOL',아르헨티나:'ARG',우루과이:'URY',베네수엘라:'VEN',콜롬비아:'COL',파나마:'PAN',아이티:'HTI',자메이카:'JAM',그린란드:'GRL',
    영국:'GBR',프랑스:'FRA',독일:'DEU',스페인:'ESP',포르투갈:'PRT',이탈리아:'ITA',스위스:'CHE',네덜란드:'NLD',벨기에:'BEL',룩셈부르크:'LUX',덴마크:'DNK',노르웨이:'NOR',스웨덴:'SWE',핀란드:'FIN',아이슬란드:'ISL',아일랜드:'IRL',러시아:'RUS',폴란드:'POL',오스트리아:'AUT',헝가리:'HUN',체코:'CZE',슬로바키아:'SVK',루마니아:'ROU',불가리아:'BGR',그리스:'GRC',세르비아:'SRB',알바니아:'ALB',몬테네그로:'MNE',크로아티아:'HRV',보스니아:'BIH',우크라이나:'UKR',리투아니아:'LTU',라트비아:'LVA',에스토니아:'EST',조지아:'GEO',
    중국:'CHN',일본:'JPN',몽골:'MNG',인도:'IND',파키스탄:'PAK',방글라데시:'BGD',부탄:'BTN',네팔:'NPL',스리랑카:'LKA',베트남:'VNM',캄보디아:'KHM',태국:'THA',미얀마:'MMR',라오스:'LAO',말레이시아:'MYS',인도네시아:'IDN',필리핀:'PHL',대만:'TWN',
    이란:'IRN',이라크:'IRQ',튀르키예:'TUR',시리아:'SYR',레바논:'LBN',요르단:'JOR',이스라엘:'ISR',팔레스타인:'PSE',사우디아라비아:'SAU',예멘:'YEM',쿠웨이트:'KWT',오만:'OMN',아프가니스탄:'AFG',
    이집트:'EGY',리비아:'LBY',알제리:'DZA',모로코:'MAR',튀니지:'TUN',수단:'SDN',에티오피아:'ETH',에리트레아:'ERI',소말리아:'SOM',케냐:'KEN',탄자니아:'TZA',나이지리아:'NGA',니제르:'NER',가나:'GHA',베냉:'BEN',토고:'TGO',카메룬:'CMR',가봉:'GAB',잠비아:'ZMB',나미비아:'NAM',레소토:'LSO',남아프리카공화국:'ZAF',마다가스카르:'MDG',콩고:'COD',
    오스트레일리아:'AUS',뉴질랜드:'NZL',파푸아뉴기니:'PNG',솔로몬제도:'SLB',뉴칼레도니아:'NCL',피지:'FJI',바누아투:'VUT'
  };
  const ALIASES={...Object.fromEntries(Object.entries(names).map(([k,v])=>[k,[v]])),
    한국:['KOR','PRK'],대한민국:['KOR'],북한:['PRK'],조선:['KOR','PRK'],대한제국:['KOR','PRK'],
    청:['CHN'],청나라:['CHN'],청제국:['CHN'],호주:['AUS'],버마:['MMR'],시암:['THA'],터키:['TUR'],페르시아:['IRN'],
    남아프리카:['ZAF'],남아프리카연방:['ZAF'],남서아프리카:['NAM'],바수토랜드:['LSO'],다호메:['BEN'],북로디지아:['ZMB'],
    프로이센:['DEU'],작센:['DEU'],바이에른:['DEU'],'북독일 연방':['DEU'],'독일 연방':['DEU'],
    '중국(청)':['CHN'],'한국(조선·대한제국 전환기)':['KOR','PRK'],
    '러시아 제국(현 조지아)':['GEO'],'오스트리아 제국(현 체코)':['CZE'],'오스트리아 제국(현 크로아티아)':['HRV'],
    '오스만 제국(레바논)':['LBN'],'오스만 제국(현 레바논)':['LBN'],'오스만 제국(현 이스라엘)':['ISR'],
    '오스만 제국(시리아)':['SYR'],'오스만 제국(요르단)':['JOR'],'오스만 제국(팔레스타인)':['PSE'],'오스만 제국(현 그리스)':['GRC']
  };
  const MIDDLE = new Set(['TUR','IRN','IRQ','SYR','LBN','JOR','ISR','PSE','SAU','YEM','KWT','OMN','ARE','QAT','AFG','EGY']);
  function regionId(s){
    s=String(s||'');
    if(/중동/.test(s))return 'middle';
    if(/아메리카|하와이/.test(s))return 'americas';
    if(/동아시아|오세아니아/.test(s))return 'east';
    if(/유럽|아프리카/.test(s))return 'europe';
    return null;
  }
  function ease(t){t=Math.max(0,Math.min(1,t)); return t*t*t*(t*(t*6-15)+10);}
  function expandBounds(b, areaFactor=5){
    const k=Math.sqrt(Math.max(1,Number(areaFactor)||1)),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
    const w=(b[2]-b[0])*k/2,h=(b[3]-b[1])*k/2;
    return [cx-w,cy-h,cx+w,cy+h];
  }
  function fitCamera(b,width,height,{padding=36,focusX=width/2,focusY=height/2}={}){
    const s=Math.max(.01,Math.min(Math.max(1,width-2*padding)/Math.max(.1,b[2]-b[0]),Math.max(1,height-2*padding)/Math.max(.1,b[3]-b[1])));
    return {x:(b[0]+b[2])/2-(focusX-width/2)/s,y:(b[1]+b[3])/2-(focusY-height/2)/s,scale:s};
  }
  // Translation is measured in map coordinates, independent of zoom or the
  // layout's off-centre focus. Do NOT pre-position the screen-space anchor:
  // doing that at world scale caused a large detour and subsequent reversal.
  const APPROACH_TIMING=Object.freeze({panEnd:.40,zoomStart:.175});
  function nearestCamera(from,to){
    const raw=to.x-from.x;
    let dx=((raw+180)%360+360)%360-180;
    if(dx===-180&&raw>0)dx=180; // Equal routes: retain the original direction.
    return {...to,x:from.x+dx};
  }
  function panEase(t){
    const p=Math.max(0,Math.min(1,t));
    // Gentle launch, prompt travel, gradual stop. Derivative is zero at both
    // ends. Speed scales with actual path length; a short trip never inherits
    // the speed of a previous, much longer trip.
    return p*p*(6+p*(-8+3*p));
  }
  function cameraAt(a,b,t,{kind='direct'}={}){
    if(t<=0)return {...a};
    const dest=nearestCamera(a,b);
    if(t>=1)return dest;
    let pan=ease(t),zoom=pan;
    if(kind==='approach'){
      pan=panEase(t/APPROACH_TIMING.panEnd);
      zoom=ease((t-APPROACH_TIMING.zoomStart)/(1-APPROACH_TIMING.zoomStart));
    }
    const scale=zoom===0?a.scale:zoom===1?dest.scale:Math.exp(Math.log(a.scale)+(Math.log(dest.scale)-Math.log(a.scale))*zoom);
    // One straight, shortest segment on this horizontally wrapping flat map.
    // No intermediate destination, overshoot, or zoom-dependent translation.
    return {x:a.x+(dest.x-a.x)*pan,y:a.y+(dest.y-a.y)*pan,scale};
  }
  function countryCodes(s){
    s=String(s||'').trim();
    if(ALIASES[s])return [...ALIASES[s]];
    if(/오스만 제국|소련|오스트리아.헝가리|오스트리아 제국|러시아 제국|유고슬라비아|체코슬로바키아|만주국/.test(s))return [];
    const clean=s.replace(/\([^)]*\)/g,'').trim();
    if(ALIASES[clean])return [...ALIASES[clean]];
    const parts=clean.split(/[·,/]/).map(x=>x.trim()).filter(Boolean);
    if(parts.length>1){
      const matches=parts.map(x=>ALIASES[x]);
      // Partial matches must not silently omit an unrecognised co-location.
      if(matches.every(Boolean))return [...new Set(matches.flat())];
    }
    return [];
  }
  function placeCountry(s){
    s=String(s||'').trim();
    const exact=countryCodes(s);if(exact.length)return exact;
    // Only an explicit leading country is interpreted. No inferred cities,
    // battlefields, capitals, coastlines, or title-based guesses.
    for(const k of Object.keys(ALIASES).sort((a,b)=>b.length-a.length)){
      if(s.startsWith(k+' ') && !/제국|령|점령/.test(s.slice(k.length,k.length+6)))return [...ALIASES[k]];
    }
    return [];
  }
  function resolve(e){
    const country=String(e.country||'').trim(),place=String(e.place||'').trim(),r=regionId(e.region);
    const fallback=(note)=>({level:r?'region':'world',region:r,codes:[],label:r?GROUPS[r].label:'세계 전체',basis:'region',historical:false,note});
    if(/전세계|전지구|^세계$|국가 비귀속|^국제/.test(country)||/^세계 여러/.test(place))
      return {level:'world',region:null,codes:[],label:'세계 전체',basis:'global',historical:false,note:'전 지구 사건 · 특정 지역을 칠하지 않습니다.'};
    if(/해역|연안|인근|해협|태평양|대서양|북해|흑해|발트해|필리핀해|카리브해|산호해|바렌츠해/.test(place||country))
      return fallback('해역·이동 경로 미연결 · 기록된 대륙으로 대체');
    const p=placeCountry(place),c=countryCodes(country),codes=p.length?p:c;
    const local=codes.length<=1?resolveSubregion(e,codes):null;if(local)return local;
    if(codes.length){
      const historical=/제국|프로이센|일제|조선|대한|청|소련|연방|령|작센|바이에른/.test(country);
      return {level:'country',region:r,codes,label:p.length?place:country,basis:p.length?'place':'country',historical,
        note:historical?'역사 지명 · 현대 윤곽은 위치 참고용입니다.':'국가 단위 표시 · 도시·건물 경계는 연결하지 않았습니다.'};
    }
    return fallback('정확한 위치 미연결 · 기록된 대륙으로 대체');
  }
  function formatDate(s){const p=String(s).split('-');return `${p[0]}년`+(p[1]?` ${Number(p[1])}월`:'')+(p[2]?` ${Number(p[2])}일`:'');}
export {WORLD_BOUNDS,SUBREGIONS,GROUPS,ALIASES,MIDDLE,APPROACH_TIMING,nearestCamera,panEase,regionId,ease,expandBounds,fitCamera,cameraAt,resolve,formatDate};
