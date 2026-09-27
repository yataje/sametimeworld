const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');
const main=fs.readFileSync(new URL('../src/main.js',\`file://\${__filename.replaceAll('\\\\','/')}\`),'utf8');
const html=fs.readFileSync(new URL('../index.html',\`file://\${__filename.replaceAll('\\\\','/')}\`),'utf8');

test('event detail includes precision metadata and a timeline return button',()=>{
 assert.match(main,/precision:'일'/);assert.match(main,/precision:'월'/);assert.match(main,/precision:'연'/);
 assert.match(main,/\\['대륙',x\\.region\\]/);assert.match(main,/\\['국가',x\\.country\\]/);assert.match(main,/\\['카테고리',x\\.category\\]/);
 assert.match(html,/id="backToTimeline"/);
});

test('detail navigation participates in browser history',()=>{
 assert.match(main,/history\\.pushState\\(\\{stwTab:'web',eventId:x\\.id\\}/);
 assert.match(main,/window\\.addEventListener\\('popstate'/);
 assert.match(main,/function returnToTimeline\\(\\)/);
});

test('recent search history is stored separately from event search data',()=>{
 assert.match(main,/SEARCH_HISTORY_LIMIT=10/);
 assert.match(main,/localStorage\\.setItem\\(SEARCH_HISTORY_KEY/);
 assert.match(main,/class="search-history-item"/);
});
