const test=require('node:test');const assert=require('node:assert/strict');
const base={region:'동아시아/오세아니아',map_status:'unresolved',latitude:null,longitude:null};
let resolver;async function point(e){resolver??=(await import('../src/point-resolver.js')).resolvePoint;return resolver({...base,...e});}
function near(p,lat,lon,epsilon=1){assert.ok(p,'A representative point must be found');assert.ok(Math.abs(p.lat-lat)<epsilon&&Math.abs(p.lon-lon)<epsilon,JSON.stringify(p));}
test('Busanpo resolves within Busan instead of rejecting an unresolved import',async()=>{near(await point({country:'조선',place:'부산포',title:'일본군의 부산 상륙과 임진왜란 발발'}),35.15,129.05);});
test('explicit event-location sentence is used when place fields are empty',async()=>{near(await point({country:'조선',description:'일본군은 부산에 상륙했다.',title:'군대의 상륙'}),35.15,129.05);});
test('Vienna under Austria never becomes Vinh Vietnam',async()=>{near(await point({country:'오스트리아',place:'빈',title:'빈 증시 붕괴'}),48.21,16.37,.5);});
test('California province is more specific than a US country representative',async()=>{const p=await point({country:'미국',place:'캘리포니아주',region:'아메리카'});assert.ok(p);assert.equal(p.precision,'admin1');near(p,37,-120,5);});
test('historical Korea permits a North Korean administrative region',async()=>{const p=await point({country:'조선',place:'함경남도'});assert.ok(p);assert.equal(p.precision,'admin1');near(p,40,127.6,3);});
test('registered Japanese prefecture is an administrative point',async()=>{const p=await point({country:'일본',place:'가고시마현'});assert.ok(p);assert.equal(p.precision,'admin1');near(p,31.6,130.6,3);});
test('a known country always has its own last-resort representative',async()=>{const p=await point({country:'프랑스',place:'자료에서 위치를 확인하지 못함',region:'유럽/아프리카'});assert.ok(p);assert.equal(p.precision,'country');near(p,46.5,2,7);});
test('neither UI continent nor empty country is converted to a point',async()=>{assert.equal(await point({country:'',place:'미상',region:'유럽/아프리카'}),null);assert.equal(await point({country:'',region:'아메리카'}),null);});
test('US and France do not average to the Atlantic when no event place is given',async()=>{assert.equal(await point({country:'미국·프랑스',place:'',region:'아메리카'}),null);});
test('background birthplace does not move a Seoul event to Busan',async()=>{near(await point({country:'조선',place:'서울',title:'회의 개최',description:'부산 출신 인물이 서울에서 회의를 열었다.'}),37.56,126.98,.5);});
test('a source URL is not evidence of the event location',async()=>{const p=await point({country:'프랑스',title:'법률 제정',description:'출처: https://example.com/부산/서울'});assert.equal(p.precision,'country');});
test('invalid or continent-level stored points cannot bypass the policy',async()=>{const p=await point({country:'일본',latitude:0,longitude:0,location_precision:'region',map_status:'inherited_context_checked_not_reverified'});assert.equal(p.precision,'country');near(p,36,138,8);});
test('correct city point survives repair',async()=>{const p=await point({country:'오스트리아',place:'빈',latitude:48.2082,longitude:16.3738,location_precision:'city',map_status:'reference_coordinate_checked'});near(p,48.2082,16.3738,.001);});
test('post-repair explicit unresolved decision remains unresolved',async()=>{assert.equal(await point({location_policy_version:2,country:'',location_resolution_method:'multiple_locations',region:'유럽/아프리카'}),null);});
