const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(new URL('../'+p,`file://${__filename}`),'utf8');
const source=read('src/main.js');
function renderer(name,next){
 const ctx={searchArrivalId:null,seriesState:{active:null},escapeHTML:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),displayTimelinePlace:()=> '서울',eventDetails:()=>({description:'설명'}),eventPrecision:()=> 'day',eventDayComparable:()=>true};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf(`function ${name}(`),source.indexOf(`function ${next}(`)),ctx);return ctx[name];
}
for(const [name,next,selector] of [['timelineCardHTML','timelineRegionCards','event-importance'],['searchSuggestionHTML','hideSearchSuggestions','ss-meta']]){
 const render=renderer(name,next);
 for(let level=1;level<=5;level++)test(`${name} renders level ${level} color without a DOM observer`,()=>{
  const html=render({id:1,date:'1900',title:'사건',category:'정치',importance:level},2);
  assert.match(html,new RegExp(`class="[^"]*importance-color-${level}[^"]*"[^>]*>★ ${level}</span>`));
  assert.match(html,new RegExp(`class="${selector}`));assert.match(html,/정치/);
 });
 for(const value of [null,0,6,NaN])test(`${name} preserves unknown/out-of-range importance ${value}`,()=>{
  const html=render({id:1,date:'1900',title:'사건',importance:value},2);
  assert.ok(!/importance-color-[1-5]/.test(html));assert.ok(html.includes(`★ ${value??'—'}`));
 });
}
test('the five colors retain the original palette and override contextual text colors',()=>{
 const css=read('src/style.css');
 for(const [i,color] of ['747D8C','B8C2D1','4FC3F7','FFB020','FF4D4F'].entries())assert.match(css,new RegExp(`\\.importance-color-${i+1}\\s*\\{\\s*color:\\s*#${color}\\s*!important;?\\s*\\}`,'i'));
});
test('the temporary global text scanner is removed',()=>{
 assert.doesNotMatch(read('index.html'),/importance-color-test|MutationObserver|createTreeWalker/);
});
