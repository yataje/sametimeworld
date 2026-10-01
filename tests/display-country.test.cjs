const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename}`),'utf8');
function helpers(){
 const from=source.indexOf('const DISPLAY_PLACE_ALIASES='),to=source.indexOf('let bins=',from);
 assert.ok(from>=0&&to>from,'pure-place helper must exist');
 const ctx={Map,Set,String};vm.createContext(ctx);vm.runInContext(source.slice(from,to),ctx);return ctx;
}
test('timeline uses only a compact place from locality',()=>{
 const {displayTimelinePlace}=helpers();
 const rows=[
  [{locality:'상투메의 탈주 노예 공동체',country:'포르투갈 식민 세력'},'상투메'],
  [{locality:'누에바에스파냐 북부 변경의 여러 원주민 지역',country:'누에바에스파냐'},'누에바에스파냐 북부 변경'],
  [{locality:'콘스탄티노폴리스 총대주교좌',country:'러시아'},'콘스탄티노폴리스'],
  [{locality:'하베시 지방',country:'오스만 제국'},'하베시 지방'],
  [{locality:'페루 부왕령',country:'에스파냐령 페루'},'페루']
 ];
 for(const [row,expected] of rows)assert.equal(displayTimelinePlace(row),expected,JSON.stringify(row));
});
test('fallback removes polity, colonial and occupation wording',()=>{
 const {displayTimelinePlace}=helpers();
 const cases={
  '스페인 왕국·포르투갈 왕국':'스페인·포르투갈','에스파냐령 페루':'페루','포르투갈령 브라질':'브라질',
  '무굴 제국':'무굴','오스만 제국':'오스만','프랑스 점령군정':'프랑스','조선':'조선'
 };
 for(const [country,expected] of Object.entries(cases))assert.equal(displayTimelinePlace({country}),expected,country);
});
test('source country remains unchanged outside timeline display',()=>{
 assert.match(source,/escapeHTML\(displayTimelinePlace\(x\)\)/);
 assert.match(source,/\['국가',x\.country\]/);
});
