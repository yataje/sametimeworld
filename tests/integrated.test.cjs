const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename}`),'utf8');
function model(){
 const c={Date,utc:Date.UTC,ymd:t=>{const d=new Date(t);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]},pad:n=>String(n).padStart(2,'0')};vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('function normalizeRegion('),source.indexOf('function updateVersionLabels(')),c);
 vm.runInContext(source.slice(source.indexOf('function parseDate('),source.indexOf('function configureTimelineStart(')),c);
 vm.runInContext(source.slice(source.indexOf('function eventPrecision('),source.indexOf('function eventDetails(')),c);
 return c;
}
test('integrated normalization preserves withheld map status and explicit date contract',()=>{
 const c=model(),[e]=c.normalizeEvents([{id:1,date:'1805',date_label:'원문 연도',timeline_date:'1805/1806',map_status:'unresolved',day_comparison_eligible:0,latitude:null,longitude:null}]);
 assert.equal(e.map_status,'unresolved');assert.equal(e.date_label,'원문 연도');assert.equal(e.timeline_date,'1805/1806');assert.equal(e.eligible_for_normalized_day_index,false);
});
test('coordinates reject blanks, booleans, incomplete pairs and out-of-range numbers',()=>{
 const c=model();for(const pair of [['',0],[true,0],[91,10],[30,181],[null,30]]){const [e]=c.normalizeEvents([{id:1,latitude:pair[0],longitude:pair[1]}]);assert.equal(e.latitude,null);assert.equal(e.longitude,null);}
 const [e]=c.normalizeEvents([{id:1,latitude:0,longitude:0}]);assert.equal(e.latitude,0);assert.equal(e.longitude,0);
});
test('integrated records never silently receive replacement or duplicate IDs',()=>{
 const c=model();assert.throws(()=>c.normalizeEvents([{date:'1805'}]),/id|identifier/i);assert.throws(()=>c.normalizeEvents([{id:1},{id:1}]),/duplicate/i);
});
test('western timeline bounds override source-calendar numerals without changing the display label',()=>{
 const c=model(),e={date:'히즈라 1220년(출처 서력 1805–1806년 대응)',timeline_date:'1805/1806',date_precision:'year_range',eligible_for_normalized_day_index:false};
 assert.equal(c.parseDate(e).y,1805);const span=c.eventDateSpan(e);assert.equal(span.from,Date.UTC(1805,0,1));assert.equal(span.to,Date.UTC(1807,0,1)-1);assert.equal(c.eventDayComparable(e),false);
});
test('decade spans remain decades without fabricating a single year or exact day',()=>{
 const c=model(),e={date:'1850',timeline_date:'1850/1859',date_precision:'decade',eligible_for_normalized_day_index:false};
 assert.equal(c.eventDateSpan(e).to,Date.UTC(1860,0,1)-1);assert.equal(c.eventDayComparable(e),false);
});
test('explicitly withheld coordinates never fall back to geocoding, country or continent',async()=>{
 const p=await import('../src/point-resolver.js');for(const e of [{map_status:'unresolved',country:'프랑스',latitude:null,longitude:null},{map_status:'unresolved',country:'프랑스',latitude:48,longitude:2}])assert.equal(p.resolvePoint(e),null);
});
test('active inherited coordinates keep their status instead of becoming verified observations',async()=>{
 const p=await import('../src/point-resolver.js'),e={map_status:'inherited_context_checked_not_reverified',resolved_place:'빈',latitude:48.2082,longitude:16.3738,location_precision:'city'};
 const v=p.resolvePoint(e);assert.equal(v.name,'빈');assert.equal(v.status,e.map_status);assert.equal(v.lat,e.latitude);
});
test('integrated partial dates are never considered exact-day search matches',()=>{
 const c=model(),[e]=c.normalizeEvents([{id:3,date:'1600-01-01',date_precision:'day',day_comparison_eligible:0,map_status:'unresolved'}]);assert.equal(c.eventDayComparable(e),false);
});
test('unclassified events have an explicit list and can open details without a false region',()=>{
 assert.match(source,/function initUnclassifiedEvents\(/);assert.match(source,/!REGIONS\.includes\(x\.region\)/);assert.match(fs.readFileSync(new URL('../index.html',`file://${__filename}`),'utf8'),/id="unclassifiedOpen"/);
});
