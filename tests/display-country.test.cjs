const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename}`),'utf8');
function helpers(){
 const from=source.indexOf('const DISPLAY_PLACE_ALIASES=');
 const to=source.indexOf('let bins=',from);
 assert.ok(from>=0&&to>from,'timeline place helper must exist');
 const ctx={Map,Set,String};vm.createContext(ctx);vm.runInContext(source.slice(from,to),ctx);return ctx;
}
test('timeline prefers locality over long historical polity labels',()=>{
 const {displayTimelinePlace}=helpers();
 assert.equal(displayTimelinePlace({locality:'상투메',country:'상투메의 탈주 노예 공동체·포르투갈 식민 세력'}),'상투메');
 assert.equal(displayTimelinePlace({locality:'하베시',country:'에티오피아·오스만 하베시 지방'}),'하베시');
 assert.equal(displayTimelinePlace({locality:'콘스탄티노폴리스',country:'러시아·콘스탄티노폴리스 총대주교좌'}),'콘스탄티노폴리스');
});
test('historical polity fallback is geography-first when locality is absent',()=>{
 const {displayTimelinePlace}=helpers();
 const cases={
  '상투메의 탈주 노예 공동체·포르투갈 식민 세력':'상투메·포르투갈',
  '에티오피아·오스만 하베시 지방':'에티오피아·하베시',
  '러시아·콘스탄티노폴리스 총대주교좌':'러시아·콘스탄티노폴리스',
  '스페인 왕국·포르투갈 왕국':'스페인·포르투갈',
  '에스파냐령 페루':'페루',
  '포르투갈령 브라질':'브라질',
  '무굴 제국':'무굴',
  '조선':'조선'
 };
 for(const [input,expected] of Object.entries(cases))assert.equal(displayTimelinePlace({country:input}),expected,input);
});
test('only timeline rendering is compacted; source country data remains intact',()=>{
 assert.match(source,/escapeHTML\(displayTimelinePlace\(x\)\)/);
 assert.match(source,/\['국가',x\.country\]/);
});
