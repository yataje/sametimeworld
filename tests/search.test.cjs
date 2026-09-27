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
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function parseSearchDateQuery('),source.indexOf('function renderSearch(')),ctx);return ctx;
}
for(const [q,expected] of [['해병대',[2,4]],['이지중대',[3,5]],['엔터프라이즈',[1]],['노르망디',[5]],['사용자 제공',[]]]){
 test('semantic search: '+q,()=>assert.deepEqual(Array.from(context().searchEvents(q).all,x=>x.id),expected));
}
test('partial dates remain searchable',()=>{
 assert.deepEqual(Array.from(context().searchEvents('1942년 8월').all,x=>x.id),[3]);
 assert.deepEqual(Array.from(context().searchEvents('1944년 6월 6일').all,x=>x.id),[5]);
 assert.equal(context().parseSearchDateQuery('1944-02-31'),null);
});
test('title and subject relevance precede description matches',()=>{
 const data=[{id:1,date:'1800',title:'기타',description:'이지중대 언급'},{id:2,date:'1944',title:'이지중대',description:''}];
 assert.equal(context(data).searchEvents('이지중대').all[0].id,2);
});
test('result cap reports total without losing matches',()=>{
 const data=Array.from({length:125},(_,i)=>({id:i+1,date:'1944',title:'검색',description:''}));
 const r=context(data).searchEvents('검색');assert.equal(r.all.length,125);assert.equal(r.shown.length,100);
});
test('selected event stays first and visible even below the card limit',()=>{
 assert.ok(source.includes('function selectTimelineCards('),'Focused card selection is missing');
 const ctx={};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function selectTimelineCards('),source.indexOf('function render(){')),ctx);
 const items=[{id:1},{id:2},{id:3},{id:4}];
 assert.deepEqual(Array.from(ctx.selectTimelineCards(items,7,4),x=>x.id),[4,1,2,3]);
 assert.deepEqual(Array.from(ctx.selectTimelineCards(items,2,4),x=>x.id),[4,1]);
});

const nearbyRows=[
 {id:10,date:'1925-05-04',title:'가까운 사건',importance:1},
 {id:11,date:'1925-04-01',title:'주요 사건',importance:9},
 {id:12,date:'1925-03-01',title:'같은 중요도',importance:9},
 {id:13,date:'1925-05-06',title:'이후 사건',importance:8},
 {id:14,date:'1923-01-01',title:'범위 밖',importance:10},
 {id:15,date:'1925-05',title:'일자 미상',importance:10},
 {id:16,date:'1925',title:'월일 미상',importance:10},
 {id:17,date:'1925-06',title:'이후 월',importance:9},
 {id:18,date:'1925-02-30',title:'잘못된 날짜',importance:10},
];
test('empty date search offers important nearby events without claiming exact matches',()=>{
 const r=context(nearbyRows).searchEvents('1925-05-05');
 assert.equal(r.all.length,0);
 assert.ok(r.nearby,'Expected nearby recommendations');
 assert.deepEqual(Array.from(r.nearby.before,x=>x.id),[11,12,10]);
 assert.deepEqual(Array.from(r.nearby.after,x=>x.id),[17,13]);
});
test('recommendations are capped on each side and disabled for matches and text',()=>{
 const data=Array.from({length:8},(_,i)=>({id:i+1,date:'1925-05-04',title:'사건',importance:i}));
 const ctx=context(data);
 assert.equal(ctx.searchEvents('1925-05-05').nearby?.before.length,5);
 for(const q of ['1925-05-04','1925년 5월','1925','없는 사건','','1925-02-30'])assert.equal(ctx.searchEvents(q).nearby??null,null);
});
test('empty month and year searches use the whole requested period',()=>{
 const ctx=context([{id:1,date:'1924',importance:9},{id:2,date:'1926-01',importance:8}]);
 assert.deepEqual(Array.from(ctx.searchEvents('1925').nearby?.before||[],x=>x.id),[1]);
 assert.deepEqual(Array.from(ctx.searchEvents('1925-12').nearby?.after||[],x=>x.id),[2]);
});
test('empty date rendering separates recommendations and keeps clickable event ids',()=>{
 const ctx=context(nearbyRows);
 Object.assign(ctx,{searchInput:{value:'1925-05-05'},searchResults:{innerHTML:''},searchSummary:{textContent:''},escapeHTML:s=>String(s)});
 vm.runInContext(source.slice(source.indexOf('function renderSearch('),source.indexOf('function openSearch(')),ctx);
 ctx.renderSearch();
 assert.match(ctx.searchResults.innerHTML,/\[해당 날짜의 기록된 자료가 없음\]/);
 assert.match(ctx.searchResults.innerHTML,/이전 주요 사건/);
 assert.match(ctx.searchResults.innerHTML,/이후 주요 사건/);
 assert.match(ctx.searchResults.innerHTML,/data-id="11"/);
 assert.match(ctx.searchSummary.textContent,/검색 결과 0건/);
 ctx.searchInput.value='없는 사건';ctx.renderSearch();
 assert.doesNotMatch(ctx.searchResults.innerHTML,/이전 주요 사건/);
 ctx.DATA=[];ctx.searchInput.value='1925-05-05';ctx.renderSearch();
 assert.match(ctx.searchResults.innerHTML,/이전 자료가 없습니다/);
 assert.match(ctx.searchResults.innerHTML,/이후 자료가 없습니다/);
});
