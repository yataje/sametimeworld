#!/usr/bin/env python3
"""Apply a location-only release to a COPY of the integrated master.
All original tables and original view definitions are retained. New normalized
place/decision tables supply the public views; no original research facts are replaced.
"""
import argparse,gzip,hashlib,json,math,os,pathlib,re,shutil,sqlite3,sys
VIEWS=['event_details','web_events','events']
ALLOWED={'city','historical_city','db','admin1','admin2','admin3','admin4','named_region','country'}
def enc(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode('utf8')
def q(n):return '"'+n.replace('"','""')+'"'
def validate(p):
 if p.get('schema')!='stw-location-update-2' or p.get('version')!=2:raise ValueError('지원하지 않는 위치 업데이트입니다.')
 if not isinstance(p.get('rows'),list) or len(p['rows'])!=p.get('count'):raise ValueError('사건 수가 맞지 않습니다.')
 seen=set()
 for r in p['rows']:
  i=r.get('id');f=r.get('fields',{});lat=f.get('latitude');lon=f.get('longitude')
  if type(i)!=int or i<1 or i in seen:raise ValueError('잘못되거나 중복된 사건 ID입니다.')
  seen.add(i)
  if (lat is None)!=(lon is None):raise ValueError('위경도 쌍이 불완전합니다.')
  if lat is not None:
   if type(lat) not in (int,float) or type(lon) not in (int,float) or not math.isfinite(lat) or not math.isfinite(lon) or not(-90<=lat<=90 and -180<=lon<=180) or f.get('location_precision') not in ALLOWED:raise ValueError('잘못된 대표 좌표입니다.')
  elif f.get('map_status')!='unresolved':raise ValueError('미확정 위치의 상태가 맞지 않습니다.')
  for k,v in f.items():
   if isinstance(v,str) and len(v)>10000:raise ValueError('위치 필드가 너무 깁니다.')
 return p

def identity(c):
 rows=c.execute('SELECT id,date,title,description,place,locality,country FROM web_events ORDER BY id').fetchall()
 return [[int(r[0]),r[1],r[2],r[3] or '',r[4] or '',r[5] or '',r[6] or ''] for r in rows]

def migrate(c,p):
 validate(p)
 if c.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('기존 DB 검사에 실패했습니다.')
 actual=identity(c)
 if len(actual)!=p['count'] or hashlib.sha256(enc(actual)).hexdigest()!=p['identity_sha256']:raise ValueError('기존 사건 내용이 기준 버전과 다릅니다. 사용자 수정을 보호하기 위해 중단합니다.')
 if {r[0] for r in actual}!={r['id'] for r in p['rows']}:raise ValueError('기존 사건 ID가 다릅니다.')
 parentcols=[r[1] for r in c.execute('PRAGMA table_info(event_data)')];pk='event_id' if 'event_id' in parentcols else 'id' if 'id' in parentcols else None
 if not pk:raise ValueError('통합 원본의 사건 테이블을 찾지 못했습니다.')
 existing_views={r[0]:r[1] for r in c.execute("SELECT name,sql FROM sqlite_schema WHERE type='view'")}
 for name in VIEWS:
  if name not in existing_views:raise ValueError('필수 조회 구조가 없습니다: '+name)
 preserved={r[0]:c.execute('SELECT count(*) FROM '+q(r[0])).fetchone()[0] for r in c.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'location_%' AND name!='event_location_v2'").fetchall()}
 c.execute('BEGIN IMMEDIATE')
 try:
  c.execute('CREATE TABLE IF NOT EXISTS location_migration_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS location_places_v2(place_id INTEGER PRIMARY KEY,fingerprint TEXT NOT NULL UNIQUE,name TEXT,latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),precision TEXT NOT NULL CHECK(precision IN (\'city\',\'historical_city\',\'db\',\'admin1\',\'admin2\',\'admin3\',\'admin4\',\'named_region\',\'country\')),country_code TEXT,reference_id TEXT,source TEXT,note TEXT)')
  c.execute('CREATE TABLE IF NOT EXISTS event_location_v2(event_id INTEGER PRIMARY KEY REFERENCES event_data('+q(pk)+'),place_id INTEGER REFERENCES location_places_v2(place_id),status TEXT NOT NULL,coordinate_status TEXT,method TEXT,evidence TEXT)')
  places={};nextid=c.execute('SELECT coalesce(max(place_id),0)+1 FROM location_places_v2').fetchone()[0]
  for r in p['rows']:
   f=r['fields'];pid=None
   if f.get('latitude') is not None:
    values=[f.get('resolved_place'),f['latitude'],f['longitude'],f['location_precision'],f.get('location_country_code'),f.get('location_place_id'),f.get('location_source'),f.get('location_note')]
    h=hashlib.sha256(enc(values)).hexdigest()
    if h not in places:
     old=c.execute('SELECT place_id FROM location_places_v2 WHERE fingerprint=?',(h,)).fetchone()
     if old:places[h]=old[0]
     else:c.execute('INSERT INTO location_places_v2 VALUES(?,?,?,?,?,?,?,?,?,?)',[nextid,h]+values);places[h]=nextid;nextid+=1
    pid=places[h]
   c.execute('INSERT OR REPLACE INTO event_location_v2 VALUES(?,?,?,?,?,?)',(r['id'],pid,f.get('map_status','unresolved'),f.get('coordinate_status'),f.get('location_resolution_method'),f.get('location_evidence')))
  first='event_details_pre_location_v2' not in existing_views
  columns={name:[r[1] for r in c.execute('PRAGMA table_info('+q(name)+')')] for name in VIEWS}
  if first:
   for name in VIEWS:
    sql=existing_views[name]
    c.execute('INSERT INTO location_migration_meta(key,value) VALUES(?,?)',('original_view:'+name,sql))
    sql=re.sub(r'^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"|`[^`]+`|\[[^]]+\]|[^\s(]+)', 'CREATE VIEW '+q(name+'_pre_location_v2'),sql,count=1,flags=re.I)
    for old in VIEWS:
     sql=re.sub(r'\b(FROM|JOIN)\s+["`\[]?'+re.escape(old)+r'["`\]]?(?=\s|$|\))',lambda m:m[1]+' '+q(old+'_pre_location_v2'),sql,flags=re.I)
    c.execute(sql)
  expressions={'latitude':'p.latitude','longitude':'p.longitude','resolved_place':'p.name','location_precision':'p.precision','map_status':'l.status','coordinate_status':'l.coordinate_status','location_resolution_method':'l.method','location_country_code':'p.country_code','location_place_id':'p.reference_id','location_source':'p.source','location_note':'p.note','location_evidence':'l.evidence','location_policy_version':'2','위도':'p.latitude','경도':'p.longitude','위치정밀도':'p.precision'}
  for name in VIEWS:
   c.execute('DROP VIEW '+q(name));parts=[]
   origcols=[r[1] for r in c.execute('PRAGMA table_info('+q(name+'_pre_location_v2')+')')]
   for col in origcols:
    value=expressions.get(col);parts.append((f'CASE WHEN l.event_id IS NOT NULL THEN {value} ELSE b.{q(col)} END' if value else 'b.'+q(col))+' AS '+q(col))
   if name!='events':
    for col in ['location_country_code','location_place_id','location_source','location_note','location_evidence','location_policy_version']:
     if col not in origcols:parts.append(expressions[col]+' AS '+q(col))
   eventkey='event_id' if 'event_id' in origcols else 'id'
   c.execute('CREATE VIEW '+q(name)+' AS SELECT '+','.join(parts)+' FROM '+q(name+'_pre_location_v2')+' b LEFT JOIN event_location_v2 l ON l.event_id=b.'+q(eventkey)+' LEFT JOIN location_places_v2 p ON p.place_id=l.place_id')
  for k,v in {'policy_version':2,'data_version':'2026-10-03-locations-v2','identity_sha256':p['identity_sha256'],'patch_sha256':hashlib.sha256(enc(p)).hexdigest()}.items():c.execute('INSERT OR REPLACE INTO location_migration_meta VALUES(?,?)',(k,str(v)))
  if identity(c)!=actual:raise ValueError('위치 갱신 중 사건 본문이 변경되었습니다.')
  for table,count in preserved.items():
   if c.execute('SELECT count(*) FROM '+q(table)).fetchone()[0]!=count:raise ValueError('기존 연결 개수가 변경되었습니다: '+table)
  if c.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('관계 무결성 검사에 실패했습니다.')
  if c.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('수정 후 DB 검사에 실패했습니다.')
  c.commit()
 except Exception:c.rollback();raise
 return {'success':True,'events':len(actual),'mapped':c.execute('SELECT count(*) FROM event_location_v2 WHERE place_id IS NOT NULL').fetchone()[0],'original_tables_preserved':len(preserved),'policy':2}

def apply_copy(master,output,patch):
 master=pathlib.Path(master);output=pathlib.Path(output);validate(patch)
 if master.resolve()==output.resolve() or output.exists() or master.is_symlink():raise ValueError('원본과 다른 새 파일을 지정해야 합니다.')
 if not master.is_file():raise ValueError('기존 통합 DB가 없습니다. 기존 프로젝트를 선택하세요.')
 for suffix in ['-wal','-journal']:
  p=pathlib.Path(str(master)+suffix)
  if p.exists() and p.stat().st_size:raise ValueError('사용 중인 DB입니다. 편집기를 종료하세요.')
 before=hashlib.sha256(master.read_bytes()).hexdigest();shutil.copy2(master,output)
 try:
  with sqlite3.connect(output) as c:
   c.execute('PRAGMA foreign_keys=ON');result=migrate(c,patch)
  if hashlib.sha256(master.read_bytes()).hexdigest()!=before:raise ValueError('작업 중 원본이 변경되었습니다.')
  result['master_sha256']=hashlib.sha256(output.read_bytes()).hexdigest();return result
 except Exception:
  output.unlink(missing_ok=True);raise

def main():
 a=argparse.ArgumentParser();a.add_argument('master',type=pathlib.Path);a.add_argument('output',type=pathlib.Path);a.add_argument('patch',type=pathlib.Path);args=a.parse_args()
 with gzip.open(args.patch,'rt',encoding='utf8') as f:p=json.load(f)
 print(json.dumps(apply_copy(args.master,args.output,p),ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
