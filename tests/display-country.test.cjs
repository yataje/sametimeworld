const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../src/main.js',`file://${__filename}`),'utf8');
function helper(){
 const from=source.indexOf('const DISPLAY_COUNTRY_ALIASES=');
 const to=source.indexOf('let bins=',from);
 assert.ok(from>=0&&to>from,'display-country helper must exist');
 const ctx={Map,Set,String};vm.createContext(ctx);vm.runInContext(source.slice(from,to),ctx);return ctx.displayCountryName;
}
test('timeline country labels keep the place but remove long polity wording',()=>{
 const f=helper();
 const cases={
  '잉글랜드 왕국':'잉글랜드','프랑스 왕국':'프랑스','무굴 제국':'무굴','오스만 제국':'오스만',
  '스페인 왕국·포르투갈 왕국':'스페인·포르투갈','에스파냐령 페루':'페루','포르투갈령 브라질':'브라질',
  '폴란드 왕국 / 폴란드-리투아니아 연방':'폴란드-리투아니아','조선':'조선','명':'명'
 };
 for(const [input,expected] of Object.entries(cases))assert.equal(f(input),expected,input);
});
test('timeline uses compact labels without changing underlying country data',()=>{
 assert.match(source,/escapeHTML\(displayCountryName\(x\.country\)\)/);
 assert.match(source,/\['국가',x\.country\]/);
});
