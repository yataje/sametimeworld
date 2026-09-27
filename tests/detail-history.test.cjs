const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('event detail includes precision metadata and a timeline return button',()=>{
 assert.match(main,/precision:'일'/);assert.match(main,/precision:'월'/);assert.match(main,/precision:'연'/);
 assert.match(main,/\['대륙',x\.region\]/);assert.match(main,/\['국가',x\.country\]/);assert.match(main,/\['카테고리',x\.category\]/);
 assert.match(html,/id="backToTimeline"/);
});

test('detail navigation participates in browser history',()=>{
 assert.match(main,/history\.pushState\(\{stwTab:'web',eventId:x\.id\}/);
 assert.match(main,/window\.addEventListener\('popstate'/);
 assert.match(main,/function returnToTimeline\(\)/);
});

test('search stays in the timeline header without the old modal',()=>{
 assert.match(html,/id="headerSearch"/);
 assert.match(html,/id="searchInput"/);
 assert.match(html,/id="searchGo"/);
 assert.match(html,/id="searchResults"/);
 assert.doesNotMatch(html,/id="searchOpen"/);
 assert.doesNotMatch(html,/class="search-overlay"/);
 assert.doesNotMatch(main,/SEARCH_HISTORY_KEY|SEARCH_HISTORY_LIMIT|searchOverlay|openSearch\(/);
});
