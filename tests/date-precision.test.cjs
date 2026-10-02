const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename}`),'utf8');
function context(data=[]){
 const ctx={DATA:data,Date,pad:n=>String(n).padStart(2,'0'),utc:Date.UTC,ymd:t=>{const d=new Date(t);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]},LEVELS:[{kind:'decade'},{kind:'five'},{kind:'year'},{kind:'month'},{kind:'fortnight'},{kind:'week'},{kind:'day'}]};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function parseDate('),source.indexOf('function configureTimelineStart(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function parseSearchDateQuery('),source.indexOf('function hideSearchSuggestions(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function zoomForEvent('),source.indexOf('function navigateToEvent(')),ctx);return ctx;
}
test('partial dates stay visible at fine zoom without becoming exact-day comparisons',()=>{
 const m=context();assert.equal(typeof m.eventFitsLevel,'function');
 for(const row of [{date:'1550'},{date:'1550-05'},{date:'1550/1551',date_precision:'year_range'},{date:'1550-05-10',eligible_for_normalized_day_index:false}]){assert.equal(m.eventFitsLevel(row,6),true,JSON.stringify(row));assert.equal(m.eventDayComparable(row),false,JSON.stringify(row));}
 assert.equal(m.eventDayComparable({date:'1550-05-10',eligible_for_normalized_day_index:true,normalized_gregorian_date:'1550-05-10'}),true);
 assert.equal(m.eventFitsLevel({date:'1944-06-06'},6),true,'legacy rows are preserved');
});
test('date search separates original date labels from normalized same-day matches',()=>{
 const data=[{id:1,date:'1550-05-10',eligible_for_normalized_day_index:false},{id:2,date:'1550-05-10',eligible_for_normalized_day_index:true,normalized_gregorian_date:'1550-05-10'},{id:3,date:'1550',date_precision:'year'}];const m=context(data);
 assert.deepEqual(Array.from(m.searchEvents('1550-05-10').all,x=>x.id),[2]);
 assert.deepEqual(Array.from(m.searchEvents('1550').all,x=>x.id).sort(),[1,2,3]);
});
test('source ranges remain visible across their possible years without fabricated days',()=>{
 const m=context([{id:1,date:'1550/1552',date_precision:'year_range'}]);
 assert.deepEqual(Array.from(m.searchEvents('1551').all,x=>x.id),[1]);
 assert.equal(m.parseDate({date:'1550/1552',date_precision:'year_range'}).precision,'연도 범위');
 assert.equal(m.eventFitsLevel({date:'1550/1552',date_precision:'year_range'},6),true);
 const t=m.eventDisplayTime({date:'1550/1552',date_precision:'year_range'},6);assert.ok(t>Date.UTC(1550,0,1)&&t<Date.UTC(1553,0,1));
});
test('search navigation picks a truthful zoom level and rejects malformed dates',()=>{
 const m=context();assert.equal(m.zoomForEvent({date:'1550-05-10',eligible_for_normalized_day_index:false}),3);
 assert.equal(m.zoomForEvent({date:'1550'}),2);assert.equal(m.zoomForEvent({date:'1550-05'}),3);
 assert.equal(m.parseDate({date:'1550-02-30'}),null);
});
test('long source-date ranges wrap inside search cards',()=>{
 const css=fs.readFileSync(new URL('../src/style.css',`file://${__filename}`),'utf8');
 assert.ok(/\.search-suggestion \.ss-date\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/.test(css),'Source-date ranges must wrap');
});
test('fine timeline zoom keeps all cards and day rows can grow with card size',()=>{
 assert.ok(source.includes("level.kind==='day'?Infinity:level.limit"),'Day zoom must not cap cards');
 assert.ok(source.includes('function updateDayBinHeights()'),'Day rows must support variable height');
 assert.ok(source.includes('displaySettings.eventFont/100'),'Row height must follow the card-size setting');
 assert.ok(source.includes('one representative card only'),'Ranges must not repeat every day');
});
test('year-only and month-only records get dedicated undated summary rows from month zoom onward',()=>{
 const m={Date,utc:Date.UTC,pad:n=>String(n).padStart(2,'0')};vm.createContext(m);
 vm.runInContext(source.slice(source.indexOf('function specialTimelineBucket('),source.indexOf('function rebuildEventIndexes(')),m);
 vm.runInContext(source.slice(source.indexOf('function eventPrecision('),source.indexOf('function eventDayComparable(')),m);
 assert.equal(m.specialTimelineBucket({date:'1601',date_precision:'year'},2),null);
 assert.deepEqual(JSON.parse(JSON.stringify(m.specialTimelineBucket({date:'1601',date_precision:'year'},3))),{key:'year:1601',kind:'year',year:1601,month:0,time:Date.UTC(1601,0,1),label:'1601년 주요사건',note:'날짜 미정'});
 assert.deepEqual(JSON.parse(JSON.stringify(m.specialTimelineBucket({date:'1601-03',date_precision:'month'},6))),{key:'month:1601-03',kind:'month',year:1601,month:3,time:Date.UTC(1601,2,1),label:'1601년 3월 주요사건',note:'일자 미정'});
 assert.equal(m.specialTimelineBucket({date:'1601-03-12',date_precision:'day'},6),null);
});
test('summary rows do not show the approximate symbol because the row itself states date uncertainty',()=>{
 assert.match(source,/timelineCardHTML\(x,z,\{summary=false\}/);
 assert.match(source,/\$\{fuzzy\?'≈ ':''\}/);
 assert.match(source,/timelineRegionCards\(row\.events,z,level,\{summary:true\}\)/);
});

test('verified intervals are distinguished from unresolved original labels',()=>{
 const m=context();assert.equal(typeof m.eventDateBasis,'function');
 assert.equal(m.eventDateBasis({date_basis:'verified_gregorian_interval',normalized_gregorian_range:{start:'1608-05-10',end:'1608-05-11'},range_semantics:'event_duration'}),'검증된 그레고리력 기간');
 assert.equal(m.eventDateBasis({date_basis:'verified_gregorian_interval',normalized_gregorian_range:{start:'1606-09-03',end:'1606-10-01'}}),'검증된 그레고리력 범위 · 발생일 미상');
});
test('timeline coverage includes imported leaders before the earliest event',()=>{
 const m={utc:Date.UTC,DEFAULT_START_YEAR:1830};vm.createContext(m);
 vm.runInContext(source.slice(source.indexOf('function configureTimelineStart('),source.indexOf('function rebuildTimelineBins(')),m);
 m.configureTimelineStart([{date:'1550'}],[{possible_from:'1500-01-01',start:'1485'}]);assert.equal(m.start,Date.UTC(1500,0,1));
});
test('date navigation can visit 1500 and 1540 even without an event',()=>{
 const m=context([]);m.start=Date.UTC(1500,0,1);m.end=Date.UTC(1961,0,1);assert.equal(typeof m.dateNavigationTarget,'function');
 assert.equal(m.dateNavigationTarget('1500').t,Date.UTC(1500,0,1));assert.equal(m.dateNavigationTarget('1540').zoom,2);assert.equal(m.dateNavigationTarget('1499'),null);assert.equal(m.dateNavigationTarget('1550-02-30'),null);
});
test('first coverage period remains centered in tall viewports',()=>{
 for(const height of [600,800,1200])for(const [h,duration] of [[350,365*86400000],[122,86400000]]){
  const from=Date.UTC(1500,0,1),m={viewport:{clientHeight:height},LEVELS:[{h}],bins:[[0,1,2].map(i=>({t:from+i*duration,end:from+(i+1)*duration,top:i*h,height:h}))]};vm.createContext(m);
  vm.runInContext(source.slice(source.indexOf('function indexFor('),source.indexOf('function rebuildEventIndexes(')),m);
  vm.runInContext(source.slice(source.indexOf('function totalHeight('),source.indexOf('function label(')),m);
  const scroll=Math.max(0,m.topAt(from,0)+h/2-height/2),center=m.timeAt(scroll+height/2,0);
  assert.ok(center>=from&&center<from+duration,`First period drifted for height${height}, row${h}`);
  const target=from+duration*1.2;assert.ok(Math.abs(m.timeAt(m.topAt(target,0),0)-target)<1,'time/position mapping remains inverse');
 }
});
test('render positions and leader dates respect padding across resize and zoom',()=>{
 const from=Date.UTC(1500,0,1),day=86400000,elements={'#loc':{},'#status':{}},m={Date,activeAppTab:'experience',zoom:0,zoomFocusEventId:null,DATA:[],REGIONS:[],viewport:{clientHeight:800,scrollTop:0},space:{style:{}},rows:{innerHTML:''},document:{activeElement:null},LEVELS:[{h:350,kind:'year',name:'1년',limit:12},{h:122,kind:'day',name:'1일',limit:7}],bins:[Array.from({length:4},(_,i)=>({t:from+i*365*day,end:from+(i+1)*365*day,top:i*350,height:350})),Array.from({length:1500},(_,i)=>({t:from+i*day,end:from+(i+1)*day,top:i*122,height:122}))],maps:[new Map(),new Map()],specialRowsBefore:[new Map(),new Map()],$:s=>elements[s],pad:n=>String(n).padStart(2,'0'),DAY:day,ymd:t=>{const d=new Date(t);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}};m.refreshLeaderHeaders=t=>m.headerTime=t;vm.createContext(m);
 vm.runInContext(source.slice(source.indexOf('function indexFor('),source.indexOf('function rebuildEventIndexes(')),m);
 vm.runInContext(source.slice(source.indexOf('function totalHeight('),source.indexOf('let renderQueued=')),m);
 m.render();assert.match(m.rows.innerHTML,/top:225px;height:350px/);assert.equal(elements['#loc'].textContent,'1500년');assert.equal(new Date(m.headerTime).getUTCFullYear(),1500);
 m.viewport.clientHeight=1200;m.render();assert.match(m.rows.innerHTML,/top:425px;height:350px/);assert.equal(new Date(m.headerTime).getUTCFullYear(),1500);assert.equal(m.space.style.height,'2250px');
 const anchorY=500,target=Date.UTC(1501,4,1),oldScroll=m.topAt(target,0)-anchorY,oldTime=m.timeAt(oldScroll+anchorY,0),newScroll=m.topAt(oldTime,1)-anchorY;
 assert.ok(Math.abs(m.timeAt(newScroll+anchorY,1)-target)<1,'Zoom retains the chosen time at its screen anchor');
});
