const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename.replaceAll('\\','/')}`),'utf8');
const shared='\n출처 파일: 이지중대_해병대_엔터프라이즈_통합_20자_연표.txt (줄 12)\n등록 상태: 사용자 제공 텍스트 이관';
const rows=[
 {id:1,date:'1933-06-16',title:'항공모함 건조 승인',description:'대상: 엔터프라이즈 CV-6\n장소: 미국 워싱턴 D.C.'+shared},
 {id:2,date:'1941-02-01',title:'제1해병사단 창설',description:'대상: 해병대 제1사단'+shared},
 {id:3,date:'1942-08',title:'중대 편성',description:'대상: 이지중대'+shared},
 {id:4,date:'1943',title:'타라와 전투',description:'미 해병대 대규모 사상자'},
 {id:5,date:'1944-06-06',title:'강하',subject:'이지중대',place:'노르망디',description:'공수 작전'},
];
function context(data=rows){
 const ctx={DATA:data,pad:n=>String(n).padStart(2,'0'),utc:Date.UTC,ymd:t=>{const d=new Date(t);return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function parseSearchDateQuery('),source.indexOf('function hideSearchSuggestions(')),ctx);
 return ctx;
}
for(const [q,expected] of [['해병대',[2,4]],['이지중대',[3,5]],['엔터프라이즈',[1]],['노르망디',[5]],['사용자 제공',[]]]){
 test('semantic search ranking: '+q,()=>assert.deepEqual(Array.from(context().searchEvents(q).all,x=>x.id),expected));
}
test('partial dates remain searchable',()=>{
 assert.deepEqual(Array.from(context().searchEvents('1942년 8월').all,x=>x.id),[3]);
 assert.deepEqual(Array.from(context().searchEvents('1944년 6월 6일').all,x=>x.id),[5]);
 assert.equal(context().parseSearchDateQuery('1944-02-31'),null);
});
test('autocomplete is chronological even when an older match is weaker',()=>{
 const data=[{id:1,date:'1800',title:'기타',description:'이지중대 언급'},{id:2,date:'1944',title:'이지중대',description:''}];
 assert.deepEqual(Array.from(context(data).searchEvents('이지중대').all,x=>x.id),[1,2]);
});
test('autocomplete is capped at ten while preserving the full match count',()=>{
 const data=Array.from({length:25},(_,i)=>({id:i+1,date:'1944',title:'검색 '+String(i+1),description:'검색'}));
 const r=context(data).searchEvents('검색');
 assert.equal(r.all.length,25);
 assert.equal(r.shown.length,10);
});
test('autocomplete sorts all matching fields by date ascending',()=>{
 const data=[
  {id:1,date:'1940',title:'다른 사건',subject:'알파'},
  {id:2,date:'1941',title:'알파'},
  {id:3,date:'1939',title:'또 다른 사건',country:'알파'},
  {id:4,date:'1938',title:'기타',description:'알파 기록'}
 ];
 assert.deepEqual(Array.from(context(data).searchEvents('알파').all,x=>x.id),[4,3,1,2]);
});
test('selected event stays visible without breaking chronological order',()=>{
 assert.ok(source.includes('function selectTimelineCards('),'Focused card selection is missing');
 const ctx={};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function selectTimelineCards('),source.indexOf('function render(){')),ctx);
 const items=[{id:1},{id:2},{id:3},{id:4}];
 assert.deepEqual(Array.from(ctx.selectTimelineCards(items,7,4),x=>x.id),[1,2,3,4]);
 assert.deepEqual(Array.from(ctx.selectTimelineCards(items,2,4),x=>x.id),[1,4]);
});
test('Enter and magnifier use the best autocomplete result',()=>{
 assert.match(source,/function goToBestSearchResult\(\)[\s\S]*searchEvents\(searchInput\.value,seriesFilteredEvents\(\)\)\.shown\[0\]/);
 assert.match(source,/if\(e\.key==='Enter'\)\{e\.preventDefault\(\);goToBestSearchResult\(\);return;\}/);
 assert.match(source,/searchGo\.addEventListener\('click',goToBestSearchResult\)/);
});
test('clicking an autocomplete item navigates to that event',()=>{
 assert.match(source,/searchResults\.addEventListener\('click'/);
 assert.match(source,/closest\('\.search-suggestion'\)/);
 assert.match(source,/navigateToEvent\(result\.dataset\.id\)/);
});

test('repeated keyword input reuses parsed and normalized event records',()=>{
 const ctx=context();let parsed=0;const details=ctx.eventDetails;ctx.eventDetails=x=>{parsed++;return details(x);};
 ctx.searchEvents('해병');const initial=parsed;ctx.searchEvents('해병대');ctx.searchEvents('노르망디');
 assert.equal(parsed,initial,'Typing re-parsed every event description');
 assert.equal(initial,rows.length);
});
test('war tags are searchable without tagging an unrelated record',()=>{
 const ctx=context([{id:1,date:'1942',title:'엘 알라메인 전투',war_tags:['제2차 세계대전']},{id:2,date:'1942',title:'문학 작품 발표'}]);
 assert.deepEqual(Array.from(ctx.searchEvents('2차대전').all,x=>x.id),[1]);
});
test('search suggestions update during Korean composition without losing focus',async()=>{
 assert.ok(source.includes('function createSearchScheduler('),'Missing input scheduler');
 const ctx={setTimeout,clearTimeout};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function createSearchScheduler('),source.indexOf('const searchScheduler=')),ctx);
 let searches=0;const schedule=ctx.createSearchScheduler(()=>searches++,{delay:15});
 schedule.schedule();schedule.schedule();schedule.schedule();assert.equal(searches,0);
 await new Promise(r=>setTimeout(r,30));assert.equal(searches,1);
 schedule.compositionStart();schedule.schedule();await new Promise(r=>setTimeout(r,30));assert.equal(searches,2,'Suggestions must refresh while the Korean IME still has focus');
 schedule.compositionEnd();await new Promise(r=>setTimeout(r,30));assert.equal(searches,3);
 schedule.schedule();schedule.cancel();await new Promise(r=>setTimeout(r,30));assert.equal(searches,3);
});

test('date queries reuse event spans and compute the query interval once',()=>{const ctx=context();let spans=0;const span=ctx.eventDateSpan;ctx.eventDateSpan=x=>{spans++;return span(x);};ctx.searchEvents('1942');spans=0;ctx.searchEvents('1943');assert.equal(spans,1,'Repeated date query recalculated all record or query intervals');});
