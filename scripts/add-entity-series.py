#!/usr/bin/env python3
"""Add explicit unit/vessel memberships without changing existing IDs or event text."""
import argparse,base64,gzip,hashlib,json,pathlib,re,shutil,sqlite3
from contextlib import closing

ENTITIES={
 'easy-company':('이지중대','미 육군 제101공수사단 제506낙하산보병연대 E중대'),
 'us-1st-marine-division':('해병대 제1사단','미국 해병대 제1사단'),
 'enterprise-cv6':('엔터프라이즈 CV-6','미국 해군 항공모함 USS Enterprise (CV-6)'),
}
def compact(value):return re.sub(r'[\s·ㆍ()（）\-–—]','',str(value or '')).lower()
def identify(row):
 subject=compact(row.get('subject')); result={}
 body='\n'.join(line for line in str(row.get('description') or '').splitlines() if not re.match(r'^\s*(?:출처(?:\s*파일)?|원문 날짜|검증 상태|날짜 검증|원역법|입력 파일|파일명)\s*[:：]',line))
 text=compact(str(row.get('title') or '')+' '+body)
 for key,(name,identity) in ENTITIES.items():
  if subject==compact(name):result[key]='대상 필드: '+name
 if re.search(r'(?:엔터프라이즈|enterprise)(?:호)?cv6',text):result['enterprise-cv6']='본문의 CV-6 함번 명시'
 if ('이지중대' in text or 'easycompany' in text) and ('506' in text or '101공수' in text or '101stairborne' in text):result['easy-company']='본문의 이지중대 및 제506연대/제101공수사단 명시'
 if re.search(r'(?:미국|미)해병대(?:제)?1사단|(?:미국|미)제1해병사단|1stmarinedivision',text) and '대한민국해병' not in text:result['us-1st-marine-division']='본문의 미국 제1해병사단 명시'
 return result

def apply(root,out):
 source=root/'series.db'; before=hashlib.sha256(source.read_bytes()).hexdigest()
 if any((root/('series.db'+s)).exists() for s in ['-wal','-shm','-journal']):raise RuntimeError('Active series DB journal')
 out.mkdir(parents=True,exist_ok=True);stage=out/'series-entities.db';shutil.copy2(source,stage)
 with closing(sqlite3.connect(root/'sametimeworld.db')) as m:
  m.row_factory=sqlite3.Row;events=[dict(row) for row in m.execute('SELECT * FROM event_data')]
 grouped={key:[] for key in ENTITIES}; audit=[]
 for row in events:
  for key,reason in identify(row).items():
   grouped[key].append(row);audit.append({'event_id':row['event_id'],'title':row['title'],'entity':key,'reason':reason})
 cfg_path=root/'src/series-config.js';config=json.loads(re.search(r'export default\s*(\{.*\})',cfg_path.read_text(encoding='utf-8')).group(1))
 catalog=json.loads(gzip.decompress(base64.b64decode((root/'public'/config['file']).read_bytes())))
 with closing(sqlite3.connect(stage)) as c:
  tables=['series','series_items','series_candidates','candidate_events','candidate_notes','series_templates','concepts','concept_events']
  protected={t:set(c.execute('SELECT * FROM '+t)) for t in tables}
  cid=c.execute('SELECT max(concept_id) FROM concepts').fetchone()[0]+1;sid=c.execute('SELECT max(series_id) FROM series').fetchone()[0]+1
  counts={}; identities={}
  for key,(name,identity) in ENTITIES.items():
   public_id='entity-'+key
   if c.execute('SELECT 1 FROM series WHERE public_id=?',(public_id,)).fetchone():raise RuntimeError('Entity series already exists: '+key)
   members=sorted(grouped[key],key=lambda row:(row['year'] if row['year'] is not None else 99999,row['month'] or 0,row['day'] or 0,row['event_id']))
   assert members,key
   ids=[row['event_id'] for row in members];description=identity+' · 대상·본문에 명시된 기록을 날짜순으로 연결한 모음'
   c.execute('INSERT INTO concepts VALUES(?,?,?,?)',(cid,name,'topic',len(ids)))
   c.executemany('INSERT INTO concept_events VALUES(?,?)',[(cid,i) for i in ids])
   c.execute('INSERT INTO series VALUES(?,?,?,?,?,?,?,?,?,?,?)',(sid,public_id,name,'entity',description,None,'active','explicit_subject_and_body',cid,'2026-10-04',1))
   c.executemany('INSERT INTO series_items VALUES(?,?,?,?,?,?)',[(sid,i,n,'explicit_entity',1.0,'대상·본문의 부대/함선 식별') for n,i in enumerate(ids,1)])
   catalog['concepts'].append({'id':cid,'name':name,'type':'topic','events':ids,'entity_tag':True})
   catalog['series'].append({'id':public_id,'title':name,'description':description,'kind':'entity','concept_ids':[cid],'match':'any','events':ids})
   counts[name]=len(ids);identities[key]={'concept_id':cid,'series_id':sid,'public_id':public_id};cid+=1;sid+=1
  c.execute('INSERT OR REPLACE INTO metadata VALUES(?,?)',('entity_series_ids',json.dumps(identities,ensure_ascii=False)))
  c.commit();assert c.execute('PRAGMA journal_mode=DELETE').fetchone()[0]=='delete'
  assert c.execute('PRAGMA quick_check').fetchone()[0]=='ok'
  for t,rows in protected.items():assert rows<=set(c.execute('SELECT * FROM '+t)),t
 if hashlib.sha256(source.read_bytes()).hexdigest()!=before:raise RuntimeError('Series DB changed during apply')
 stage.replace(source)
 with closing(sqlite3.connect(source)) as c:rows=c.execute('SELECT candidate_id,title FROM series_candidates ORDER BY candidate_id').fetchall()
 (root/'series_candidates_review.txt').write_text(''.join(str(i)+'\t'+title+'\n' for i,title in rows),encoding='utf-8')
 data=base64.b64encode(gzip.compress(json.dumps(catalog,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=9,mtime=0))+b'\n'
 digest=hashlib.sha256(data).hexdigest();file='s/'+digest[:24]+'.txt';(root/'public'/file).write_bytes(data)
 cfg={**config,'file':file,'sha256':digest,'series_count':len(catalog['series']),'concept_count':len(catalog['concepts']),'entity_series_count':3}
 cfg_path.write_text('export default '+json.dumps(cfg,separators=(',',':'))+';\n',encoding='utf-8')
 report={'events_scanned':len(events),'counts':counts,'identities':identities,'original_rows_and_links_preserved':True,'quick_check':'ok','catalogue':cfg,'series_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
 (out/'entity-series-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 (out/'entity-series-audit.tsv').write_text('event_id\t사건명\t시리즈\t연결 근거\n'+''.join(f"{r['event_id']}\t{r['title']}\t{ENTITIES[r['entity']][0]}\t{r['reason']}\n" for r in audit),encoding='utf-8-sig')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args();print(json.dumps(apply(a.root,a.output),ensure_ascii=False))
