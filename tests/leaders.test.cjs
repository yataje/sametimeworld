const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function model() {
  const file = path.join(__dirname, '../src/leaders.js');
  assert.ok(fs.existsSync(file), 'Leader selection and rendering are missing');
  return import(pathToFileURL(file));
}
const row = (name, from, to, polity='United States') => ({name, polity, role_type:'head_of_state', active_from:from, active_to:to, start_precision:'day', end_precision:'day'});
test('Packaged leader data is selected and normalized without losing date precision', async () => {
  const m=await model();
  assert.equal(typeof m.loadPackagedLeaderGroups,'function');
  const groups=await m.loadPackagedLeaderGroups(async path=>{
    assert.equal(path,'leaders');
    return {l1:{id:1,country:'한반도',country_en:'Korea',polity:'대한제국',polity_en:'Korean Empire',name:'고종',name_ko:'고종',start:'1897-10-12',end:'1907-07-19',possible_from:'1897-10-12',possible_to:'1907-07-19',start_precision:'day',end_precision:'day',role_type:'monarch_or_traditional_ruler'}};
  });
  m.setLeaderData(groups);
  assert.equal(m.leadersForDate('1900-06-01')['east:korea'][0].name,'고종');
  await assert.rejects(m.loadPackagedLeaderGroups(async()=>null),/비어/);
});
test('date changes replace leaders and exclude other polities in the same country group', async () => {
  const m = await model();
  m.setLeaderData({'United States':[row('매킨리','1897-03-04','1901-09-14'),row('루스벨트','1901-09-14','1909-03-04'),row('지역 수장','1890-01-01','1910-01-01','Cherokee Nation')]});
  assert.deepEqual(m.leadersForDate('1900-06-01')['americas:usa'].map(x=>x.name), ['매킨리']);
  assert.deepEqual(m.leadersForDate('1902-01-01')['americas:usa'].map(x=>x.name), ['루스벨트']);
  assert.deepEqual(m.leadersForDate('1830-01-01')['americas:usa'], []);
});
test('countries stay in their continent and empty dates do not invent leaders', async () => {
  const m = await model();
  m.setLeaderData({'Korea':[row('고종','1897-10-12','1907-07-19','Korean Empire')]});
  const result=m.leadersForDate('1900-06-01');
  assert.deepEqual(result['east:korea'].map(x=>x.name), ['고종']);
  const east=m.leaderRegionHTML('east','1900-06-01',result,'done');
  assert.match(east,/대한제국/);assert.match(east,/고종/);
  assert.doesNotMatch(m.leaderRegionHTML('europe','1900-06-01',result,'done'),/고종/);
  assert.match(m.leaderRegionHTML('east','1830-01-01',m.leadersForDate('1830-01-01'),'done'),/자료 없음/);
});
test('names are escaped and approximate dates stay in tooltips without visual suffixes', async () => {
  const m=await model();
  m.setLeaderData({'United States':[{...row('<name>','1900-01-01','1900-12-31'),start_precision:'year',end_precision:'year'}]});
  const html=m.leaderRegionHTML('americas','1900-06-01',m.leadersForDate('1900-06-01'),'done');
  assert.match(html,/&lt;name&gt;/);assert.doesNotMatch(html,/<name>/);assert.match(html,/날짜 불확실/);assert.doesNotMatch(html,/≈/);
});
test('an unrelated dependency is not substituted when national leadership is absent', async () => {
  const m=await model();
  m.setLeaderData({'New Zealand':[row('섬의 군주','1890-01-01','1910-12-31','Cook Islands')]});
  assert.deepEqual(m.leadersForDate('1900-06-01')['east:newzealand'], []);
});
test('sixteenth-century headers derive actual polities without the 1830 era cutoff',async()=>{
 const m=await model();const groups=await m.loadPackagedLeaderGroups(async()=>[
 {id:9001,country_en:'Korea',country:'한반도',region:'동아시아/오세아니아',polity_en:'Joseon',polity:'조선',name:'명종',start:'1545',end:'1567',start_precision:'year',end_precision:'year',role_type:'monarch_or_traditional_ruler'},
 {id:9002,country_en:'Vietnam',country:'베트남',region:'동아시아/오세아니아',polity_en:'Mac dynasty',polity:'막 왕조',name:'막 왕조 군주',start:'1546',end:'1564',start_precision:'year',end_precision:'year',role_type:'monarch_or_traditional_ruler'},
 {id:9003,country_en:'Vietnam',country:'베트남',region:'동아시아/오세아니아',polity_en:'Restored Le dynasty',polity:'중흥 레 왕조',name:'레 왕조 군주',start:'1548',end:'1556',start_precision:'year',end_precision:'year',role_type:'monarch_or_traditional_ruler'},
 {id:9004,country_en:'France',country:'프랑스',region:'유럽/아프리카',polity_en:'Kingdom of France',polity:'프랑스 왕국',name:'앙리2세',start:'1547',end:'1559',start_precision:'year',end_precision:'year',role_type:'monarch_or_traditional_ruler'}
 ]);m.setLeaderData(groups);const result=m.leadersForDate('1550-06-01');
 const east=m.leaderRegionHTML('east','1550-06-01',result,'done');assert.match(east,/명종/);assert.match(east,/막 왕조 군주/);assert.match(east,/레 왕조 군주/);assert.match(east,/막 왕조/);assert.match(east,/중흥 레 왕조/);assert.match(east,/날짜 불확실/);
 assert.doesNotMatch(east,/앙리2세/);assert.match(m.leaderRegionHTML('europe','1550-06-01',result,'done'),/앙리2세/);
 assert.doesNotMatch(m.leaderRegionHTML('east','1600-01-01',m.leadersForDate('1600-01-01'),'done'),/명종/);
});
test('historical role explanations remain available in header tooltips',async()=>{
 const m=await model();m.setLeaderData(await m.loadPackagedLeaderGroups(async()=>[{id:999,country:'스페인',region:'유럽/아프리카',polity:'카스티야',name:'후아나',start:'1504',end:'1555',start_precision:'year',end_precision:'year',office:'명목상 여왕',notes:'1506년 이후 실권을 행사하지 않음'}]));
 const html=m.leaderRegionHTML('europe','1550-01-01',m.leadersForDate('1550-01-01'),'done');assert.match(html,/1506년 이후 실권을 행사하지 않음/);
});
test('historical leader evidence stays in data but source links are hidden in the header',async()=>{
 const m=await model();m.setLeaderData(await m.loadPackagedLeaderGroups(async()=>[{id:1000,country:'한반도',region:'동아시아/오세아니아',polity:'조선',name:'중종',start:'1506',end:'1544',start_precision:'year',end_precision:'year',source_urls:'https://example.org/jungjong | javascript:alert(1)'}]));
 const html=m.leaderRegionHTML('east','1540-01-01',m.leadersForDate('1540-01-01'),'done');assert.match(html,/중종/);assert.doesNotMatch(html,/출처1|leader-source|href=/);assert.doesNotMatch(html,/≈/);
});
