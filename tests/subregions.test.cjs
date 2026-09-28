const test=require('node:test'),assert=require('node:assert/strict');
const core=()=>import('../src/map-core.js');
const event=(extra={})=>({country:'미국',region:'아메리카',...extra});
test('California in the explicit place overrides the country scope',async()=>{
 const C=await core(),r=C.resolve(event({place:'미국 캘리포니아주 캠프 펜들턴'}));
 assert.equal(r.level,'subregion');assert.equal(r.subregionId,'US-CA');assert.equal(r.basis,'place');
});
test('a clear description location works without a separate place field',async()=>{
 const C=await core(),r=C.resolve(event({description:'미국 캘리포니아 윌로우스에서 노백린·김종림 등이 한인 비행사 양성을 추진했다.'}));
 assert.equal(r.subregionId,'US-CA');assert.equal(r.basis,'description');
});
test('California aliases use the same stable region ID',async()=>{
 const C=await core();for(const place of ['California','캘리포니아','캘리포니아 주','캘리포니아주'])assert.equal(C.resolve(event({place})).subregionId,'US-CA');
});
test('birthplace background must not redirect an event in another place',async()=>{
 const C=await core();assert.notEqual(C.resolve(event({description:'캘리포니아 출신 연구자가 뉴욕주에서 실험했다.'})).subregionId,'US-CA');
 assert.equal(C.resolve(event({description:'캘리포니아 출신 연구자가 뉴욕주에서 실험했다.'})).subregionId,'US-NY');
 assert.equal(C.resolve(event({description:'캘리포니아 출신 연구자가 파리에서 실험했다.'})).level,'country');
});
test('multiple event locations remain broad rather than picking the first',async()=>{
 const C=await core();for(const place of ['캘리포니아와 뉴욕주','캘리포니아에서 뉴욕주로 이동'])assert.equal(C.resolve(event({place})).level,'country');
 assert.equal(C.resolve(event({description:'캘리포니아와 뉴욕주에서 동시 실험을 진행했다.'})).level,'country');
});
test('Washington state and Washington DC are separate; bare Washington stays broad',async()=>{
 const C=await core();assert.equal(C.resolve(event({place:'워싱턴주 퓨젓사운드'})).subregionId,'US-WA');
 assert.equal(C.resolve(event({place:'미국 워싱턴 D.C.'})).subregionId,'US-DC');
 assert.equal(C.resolve(event({place:'미국 워싱턴'})).level,'country');
});
test('explicit event place takes precedence over background description',async()=>{
 const C=await core();assert.equal(C.resolve(event({place:'뉴욕주',description:'캘리포니아에서 온 연구팀의 실험.'})).subregionId,'US-NY');
 assert.equal(C.resolve(event({place:'프랑스 파리',description:'캘리포니아에서 준비를 진행했다.'})).codes[0],'FRA');
 assert.equal(C.resolve(event({place:'미국 보스턴',description:'캘리포니아에서 준비했다.'})).level,'country');
});
test('nongeographic uses, negation and source metadata do not become locations',async()=>{
 const C=await core();for(const description of ['캘리포니아호에서 실험했다.','USS California에서 실험했다.','캘리포니아에서는 실험하지 않았다.','출처: 캘리포니아에서 발행한 문서\n다른 곳에서 실험했다.','https://example.org/California에서'])assert.equal(C.resolve(event({description})).level,'country',description);
});
test('country mismatch does not silently highlight an American state',async()=>{
 const C=await core();assert.equal(C.resolve({country:'프랑스',region:'유럽/아프리카',description:'캘리포니아에서 일어난 일을 논의했다.'}).codes[0],'FRA');
});
test('unknown places and offshore records retain the existing fallbacks',async()=>{
 const C=await core();assert.equal(C.resolve({country:'미상',region:'중동'}).level,'region');
 assert.equal(C.resolve({country:'미상',region:'미상'}).level,'world');
 assert.notEqual(C.resolve(event({place:'캘리포니아 연안'})).level,'subregion');
});
test('a registered subregion has a real closed polygon and tight finite bounds',async()=>{
 const C=await core(),r=C.resolve(event({place:'캘리포니아'}));assert.ok(r.bounds);assert.equal(r.bounds.length,4);
 assert.ok(r.bounds.every(Number.isFinite));assert.ok(r.bounds[2]-r.bounds[0]<12);assert.ok(r.bounds[3]-r.bounds[1]<12);
 const {SUBREGIONS}=await import('../src/subregions.js');const f=SUBREGIONS.find(f=>f.id==='US-CA');
 const ring=f.geometry.coordinates[0];assert.ok(ring.length>20);assert.deepEqual(ring[0],ring.at(-1));
});
test('the whole-world view places Europe before Asia and America on the right',async()=>{
 const C=await core();assert.ok(C.WORLD_BOUNDS);assert.equal(C.WORLD_BOUNDS[2]-C.WORLD_BOUNDS[0],360);
 const cam=C.fitCamera(C.WORLD_BOUNDS,1440,900),xs=[10,55,135,-100].map(x=>C.nearestCamera(cam,{x}).x);
 assert.ok(xs[0]<xs[1]&&xs[1]<xs[2]&&xs[2]<xs[3]);assert.ok(xs[0]<cam.x&&xs[3]>cam.x);
});
test('the supported catalogue includes relevant eastern states but disambiguates Georgia',async()=>{
 const C=await core();for(const [place,id] of [['버지니아주 뉴포트뉴스','US-VA'],['테네시주','US-TN'],['미국 조지아주','US-GA']])assert.equal(C.resolve(event({place})).subregionId,id);
 assert.equal(C.resolve({country:'조지아',place:'조지아',region:'유럽/아프리카'}).level,'country');
});
test('a geographic-looking substring and a study are not an event location',async()=>{
 const C=await core();for(const description of ['캘리포니아설에서 근거를 찾았다.','캘리포니아의 연구에서 결과를 얻었다.'])assert.equal(C.resolve(event({description})).level,'country');
});
test('a multi-country record cannot silently discard other countries',async()=>{
 const C=await core(),r=C.resolve({country:'미국·캐나다',region:'아메리카',description:'캘리포니아에서 연구를 진행했다.'});
 assert.equal(r.level,'country');assert.deepEqual(r.codes,['USA','CAN']);
});
