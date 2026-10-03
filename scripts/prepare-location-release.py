from pathlib import Path
import base64,gzip,hashlib,json

def change(path,old,new):
 p=Path(path);s=p.read_text(encoding='utf8')
 if old not in s:
  if new in s:return
  raise RuntimeError('Source anchor missing: '+path+' '+old[:70])
 p.write_text(s.replace(old,new),encoding='utf8')

change('tests/event-map.test.cjs',"assert.equal(P.resolvePoint({country:'미상',region:'중동'}).precision,'region');","assert.equal(P.resolvePoint({country:'미상',region:'중동'}),null);")
change('tests/event-map.test.cjs','unknown locations still get an honest country or region representative point','unknown places get country representatives but never continent points')
change('tests/map-renderer.test.cjs',"assert.equal(h.api.snapshot().point.precision,'region');","assert.equal(h.api.snapshot().point,null);")
change('tests/map-renderer.test.cjs','unknown places fall back to country or region points','unknown places use a country point or remain unresolved, never a continent')
change('tests/integrated.test.cjs',"assert.equal(p.resolvePoint(e),null);","assert.equal(p.resolvePoint({...e,location_policy_version:2}),null);")
change('tests/integrated.test.cjs','explicitly withheld coordinates never fall back to geocoding, country or continent','reviewed policy-v2 withheld decisions are not reinterpreted by the viewer')
change('src/event-map.js',"p.precision==='admin1'?18:","/^admin[234]$/.test(p.precision)?7:p.precision==='admin1'?18:")
change('src/event-map.js',"'위치 확인 중'","'위치 미확정'")
change('src/event-map.js',"admin1:'주·도·성·현',", "admin1:'주·도·성·현',admin2:'군·구·지역구',admin3:'하위 행정구역',admin4:'하위 행정구역',")
change('src/event-map.js',"if(note)note.textContent=`${p.name} · ${precision} 기준 대표 좌표.","if(note)note.textContent=`${p.name} · ${precision} 기준 대표 좌표. ${p.note||''}")
change('src/event-map.js','확정할 수 있는 대표 좌표가 없어 지도 점을 표시하지 않습니다.','국가·발생 장소를 하나로 식별하지 못했습니다. 대륙 중앙점으로 대신 표시하지 않습니다.')
for name in ['src/main.js','index.html','package.json']:
 p=Path(name);p.write_text(p.read_text().replace('0.8.0','0.8.1').replace("DB_VERSION_FALLBACK='v22'","DB_VERSION_FALLBACK='v23'").replace('DB v22','DB v23'),encoding='utf8')
p=Path('scripts/export-integrated.py');s=p.read_text();s=s.replace("meta={'schema':'stw-events-export-2','data_version':'2026-10-03-integrated-v1'", "meta={'schema':'stw-events-export-2','data_version':('2026-10-03-locations-v2' if events and events[0].get('location_policy_version')==2 else '2026-10-03-integrated-v1')");p.write_text(s,encoding='utf8')
# Regenerate only source capsules whose source changed; build must not restore old code.
p=Path('source-pack/manifest.json');m=json.loads(p.read_text())
for name,old in list(m.items()):
 b=Path(name).read_bytes();h=hashlib.sha256(b).hexdigest()
 if h!=old['sha256']:
  dest='source-pack/'+h[:24]+'.txt';Path(dest).write_text(base64.b64encode(gzip.compress(b,mtime=0)).decode()+'\n');m[name]={'file':dest,'sha256':h,'size':len(b)}
  if old['file']!=dest:Path(old['file']).unlink(missing_ok=True)
p.write_text(json.dumps(m,indent=2)+'\n')
