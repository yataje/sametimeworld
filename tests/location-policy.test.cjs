const test=require('node:test'),assert=require('node:assert/strict');
test('new source-text and country representatives survive the map reader',async()=>{
 const {resolvePoint}=await import('../src/point-resolver.js');
 for(const status of ['source_text_representative','country_representative','historical_region_representative']){
  const p=resolvePoint({map_status:status,resolved_place:'부산',latitude:35.14,longitude:129.06,location_precision:'admin2'});
  assert.ok(p);assert.equal(p.status,status);assert.equal(p.precision,'admin2');
 }
});
test('all legacy continent or world fallbacks are absent',async()=>{
 const {resolvePoint}=await import('../src/point-resolver.js');
 for(const region of ['유럽/아프리카','중동','동아시아/오세아니아','아메리카',''])assert.equal(resolvePoint({region,country:'알 수 없음',place:''}),null);
 assert.equal(resolvePoint({region:'유럽/아프리카',country:'알 수 없음',latitude:0,longitude:0,location_precision:'world'}),null);
});
test('known country fallback is possible but different countries are never averaged',async()=>{
 const {resolvePoint}=await import('../src/point-resolver.js');
 assert.equal(resolvePoint({country:'프랑스'}).precision,'country');
 assert.equal(resolvePoint({country:'영국·미국'}),null);
});
test('direct city homonyms exclude conflicting countries',async()=>{
 const {resolvePoint}=await import('../src/point-resolver.js');
 const p=resolvePoint({country:'오스트리아',place:'빈'});assert.ok(p.lat>47&&p.lon<17);
 const mismatch=resolvePoint({country:'오스트리아',place:'Vinh'});assert.notEqual(mismatch?.precision,'city');
});
