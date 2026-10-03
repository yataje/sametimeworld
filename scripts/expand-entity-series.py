#!/usr/bin/env python3
"""Reusable explicit subject series registry. Preview, then additive DB/catalogue refresh."""
import argparse,base64,datetime,gzip,hashlib,importlib.util,json,pathlib,re,shutil,sqlite3,unicodedata
from contextlib import closing
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'scripts/series-entity-rules.json').read_text(encoding='utf-8'))
DEFINITIONS=CONFIG['definitions']
spec=importlib.util.spec_from_file_location('legacy_entities',ROOT/'scripts/add-entity-series.py')
LEGACY=importlib.util.module_from_spec(spec);spec.loader.exec_module(LEGACY)
LABELS={'person':'인물','military_unit':'부대','naval_vessel':'군함','vessel':'선박','organization':'조직·기관','institution':'제도·행사','technology':'기술','scientific_program':'연구계획','resource':'자원','transport':'교통수단','infrastructure':'시설','weapon':'무기','publication':'저술','movement':'운동·사조'}
TEMPLATES={'person':'person_life','military_unit':'military_unit_history','naval_vessel':'vessel_history','vessel':'vessel_history','organization':'organization_history','institution':'institution_history','technology':'technology_history','scientific_program':'scientific_program_history','resource':'resource_history','transport':'transport_history','infrastructure':'infrastructure_history','weapon':'weapon_history','publication':'publication_history','movement':'social_history'}
def alias_pattern(alias):
 parts=unicodedata.normalize('NFKC',alias).split();pattern=r'\s*'.join(re.escape(p) for p in parts)
 if re.search('[A-Za-z]',alias):pattern=r'(?<![A-Za-z])'+pattern+r'(?![A-Za-z])'
 return re.compile(pattern,re.I)
COMPILED={d['key']:[alias_pattern(a) for a in d['aliases']] for d in DEFINITIONS}
def clean_body(value):
 lines=[line for line in str(value or '').splitlines() if not re.match(r'^\s*(?:출처(?:\s*파일)?|원문 날짜|검증 상태|날짜 검증|원역법|입력 파일|파일명)\s*[:：]',line)]
 return re.sub(r'https?://\S+','','\n'.join(lines))
def identify(row):
 text=unicodedata.normalize('NFKC',' '.join(str(row.get(k) or '') for k in ['title','subject'])+' '+clean_body(row.get('description')))
 context=text+' '+str(row.get('category') or '');result={};legacy=LEGACY.identify(row)
 for d in DEFINITIONS:
  key=d['key'];year=row.get('year')
  if d.get('year_start') is not None and (year is None or year<d['year_start'] or year>d['year_end']):continue
  if d.get('legacy'):
   if key in legacy:result[key]=legacy[key]
   continue
  if d.get('require') and not re.search(d['require'],context,re.I):continue
  if d.get('exclude') and re.search(d['exclude'],context,re.I):continue
  haystack=text+(' '+str(row.get('country') or '') if d['kind']=='organization' else '')
  for alias,pattern in zip(d['aliases'],COMPILED[key]):
   if pattern.search(haystack):result[key]='명시된 대상명: '+alias;break
 for _ in range(3):
  for d in DEFINITIONS:
   inherited=[key for key in d.get('inherit',[]) if key in result]
   if inherited:result.setdefault(d['key'],'등록된 소속 관계: '+', '.join(inherited))
 return result
def preview(root):
 with closing(sqlite3.connect(root/'sametimeworld.db')) as c:
  c.row_factory=sqlite3.Row;events=[dict(r) for r in c.execute('SELECT * FROM event_data')]
 grouped={d['key']:[] for d in DEFINITIONS};audit=[]
 for row in events:
  for key,reason in identify(row).items():
   grouped[key].append(row);audit.append({'event_id':row['event_id'],'title':row['title'],'key':key,'reason':reason})
 return events,grouped,audit
def next_id(c,table,category):
 start,end=c.execute('SELECT id_start,id_end FROM series_categories WHERE category_code=?',(category,)).fetchone()
 column='series_id' if table=='series' else 'candidate_id'
 used={r[0] for r in c.execute('SELECT '+column+' FROM '+table)}
 value=start+1
 while value in used:value+=1
 if end is not None and value>end:raise RuntimeError('Category ID range exhausted')
 return value
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def apply(root,out,events,grouped,audit):
 source=root/'series.db';before=sha(source);master_before=sha(root/'sametimeworld.db')
 if any(pathlib.Path(str(db)+s).exists() for db in [source,root/'sametimeworld.db'] for s in ['-wal','-shm','-journal']):raise RuntimeError('Active source or series DB journal')
 with closing(sqlite3.connect(root/'sametimeworld.db')) as m:assert {r[0] for r in m.execute('SELECT event_id FROM event_data')}=={r['event_id'] for r in events},'Event snapshot does not match master'
 stage=out/'series-expanded.db';shutil.copy2(source,stage)
 cfg_path=root/'src/series-config.js';cfg=json.loads(re.search(r'export default\s*(\{.*\})',cfg_path.read_text(encoding='utf-8')).group(1))
 catalog=json.loads(gzip.decompress(base64.b64decode((root/'public'/cfg['file']).read_bytes())))
 now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec='seconds');by_id={r['event_id']:r for r in events}
 new_series=new_candidates=new_links=0;report_rows=[]
 with closing(sqlite3.connect(stage)) as c:
  c.row_factory=sqlite3.Row
  registry_row=c.execute("SELECT value FROM metadata WHERE key='entity_series_registry'").fetchone();registry=json.loads(registry_row[0]) if registry_row else {}
  protected={t:set(tuple(r) for r in c.execute('SELECT * FROM '+t)) for t in ['series_items','candidate_events','candidate_people','person_name_review','concepts','concept_events','series_concepts']}
  original_series={r['series_id']:dict(r) for r in c.execute('SELECT * FROM series')}
  original_candidates={r['candidate_id']:dict(r) for r in c.execute('SELECT * FROM series_candidates')}
  for template,title in [('military_unit_history','부대·편제사'),('vessel_history','함선·선박 기록'),('organization_history','조직·기관사'),('institution_history','제도·행사사'),('scientific_program_history','연구계획사'),('infrastructure_history','시설·인프라사'),('publication_history','저술·출판물사')]:
   c.execute('INSERT OR IGNORE INTO series_templates VALUES(?,?,?,?,1)',(template,title,'명시된 대상의 기존 사건을 연결하며, 자료 추가 시 같은 ID로 갱신',2))
  active={};catalog_map={s['id']:s for s in catalog['series']}
  for d in DEFINITIONS:
   key=d['key'];category=d['category'];members=sorted(grouped[key],key=lambda r:(r['year'] if r['year'] is not None else 99999,r['month'] or 0,r['day'] or 0,r['event_id']))
   ids=[r['event_id'] for r in members];reg=registry.setdefault(key,{})
   title=d.get('candidate_title',d['name']);candidate=c.execute('SELECT * FROM series_candidates WHERE candidate_id=?',(reg.get('candidate_id',-1),)).fetchone()
   if not candidate:candidate=c.execute('SELECT * FROM series_candidates WHERE title=? ORDER BY candidate_id LIMIT 1',(title,)).fetchone()
   if candidate:cid=candidate['candidate_id']
   else:
    cid=next_id(c,'series_candidates',category);new_candidates+=1
    c.execute('INSERT INTO series_candidates VALUES(?,?,?,?,?,?,?,?,?,?)',(cid,title,TEMPLATES[d['kind']],None,len(ids),4,'pending','명시 대상 시리즈 규칙 등록; 자료 2건 이상이면 활성화',now,category))
   reg['candidate_id']=cid
   for eid in ids:
    c.execute('INSERT OR IGNORE INTO candidate_events VALUES(?,?,?)',(cid,eid,'entity_rule:'+key))
   c.execute('UPDATE series_candidates SET event_count=(SELECT count(*) FROM candidate_events WHERE candidate_id=?) WHERE candidate_id=?',(cid,cid))
   public_id='entity-'+key
   existing=c.execute('SELECT * FROM series WHERE public_id=?',(public_id,)).fetchone()
   if len(ids)>=CONFIG['minimum_active_events'] or existing:
    if existing:sid=existing['series_id']
    else:
     sid=next_id(c,'series',category);new_series+=1
     description=d.get('basis',LABELS[d['kind']]+' 대상이 명시된 기록을 날짜순으로 연결한 모음')
     c.execute('INSERT INTO series VALUES(?,?,?,?,?,?,?,?,?,?,?)',(sid,public_id,d['name'],'entity',description,None,'active','explicit_entity_registry',None,now,category))
    reg['series_id']=sid;active[key]=sid
    for eid in ids:
     c.execute('INSERT OR IGNORE INTO series_items VALUES(?,?,?,?,?,?)',(sid,eid,0,'explicit_entity',1.0,'entity_rule:'+key));new_links+=c.execute('SELECT changes()').fetchone()[0]
    all_ids=[r[0] for r in c.execute('SELECT event_id FROM series_items WHERE series_id=?',(sid,))]
    assert set(all_ids)<=by_id.keys()
    all_ids.sort(key=lambda eid:(by_id[eid]['year'] if by_id[eid]['year'] is not None else 99999,by_id[eid]['month'] or 0,by_id[eid]['day'] or 0,eid))
    for n,eid in enumerate(all_ids,1):c.execute('UPDATE series_items SET sequence=? WHERE series_id=? AND event_id=?',(n,sid,eid))
    c.execute('UPDATE series SET category_code=? WHERE series_id=?',(category,sid))
    category_name=c.execute('SELECT name FROM series_categories WHERE category_code=?',(category,)).fetchone()[0]
    old=catalog_map.get(public_id,{})
    entry={**old,'id':public_id,'title':d['name'],'description':c.execute('SELECT description FROM series WHERE series_id=?',(sid,)).fetchone()[0],'kind':'entity','events':all_ids,'entity_type':d['kind'],'entity_label':LABELS[d['kind']],'category_code':category,'category_name':category_name}
    concept=c.execute('SELECT source_concept_id FROM series WHERE series_id=?',(sid,)).fetchone()[0]
    if concept is not None:entry['entity_concept_id']=concept
    # Explicit series_items become the authority; existing concepts remain intact for custom collections.
    entry.pop('concept_ids',None);entry.pop('match',None);catalog_map[public_id]=entry
    state='active'
   else:state='waiting_for_events'
   report_rows.append({'key':key,'name':d['name'],'category_code':category,'kind':d['kind'],'candidate_id':cid,'series_id':reg.get('series_id'),'matched_events':len(ids),'state':state})
  broad={1:1001,2:2001,3:3001,5:5001,7:7001,8:8001}
  for d in DEFINITIONS:
   key=d['key']
   if key not in active:continue
   parent=active.get(d.get('parent')) if d.get('parent') else broad.get(d['category'])
   if parent!=active[key]:c.execute('UPDATE series SET parent_series_id=? WHERE series_id=?',(parent,active[key]))
  for s in catalog_map.values():
   row=c.execute('SELECT category_code FROM series WHERE public_id=?',(s['id'],)).fetchone()
   if row:
    s['category_code']=row[0];s['category_name']=c.execute('SELECT name FROM series_categories WHERE category_code=?',(row[0],)).fetchone()[0]
  catalog['series']=sorted(catalog_map.values(),key=lambda s:(s.get('category_code',99),s.get('kind')=='entity',s['title']))
  for k,v in [('entity_series_registry',json.dumps(registry,ensure_ascii=False,sort_keys=True)),('concepts_count',str(c.execute('SELECT count(*) FROM concepts').fetchone()[0])),('catalog_series_count',str(len(catalog['series']))),('entity_series_rules_sha256',sha(root/'scripts/series-entity-rules.json'))]:c.execute('INSERT OR REPLACE INTO metadata VALUES(?,?)',(k,v))
  c.commit();assert c.execute('PRAGMA journal_mode=DELETE').fetchone()[0]=='delete';assert c.execute('PRAGMA quick_check').fetchone()[0]=='ok'
  for t,rows in protected.items():
   if t=='series_items':assert {(r[0],r[1]) for r in rows}<={(r[0],r[1]) for r in c.execute('SELECT * FROM '+t)}
   else:assert rows<=set(tuple(r) for r in c.execute('SELECT * FROM '+t)),t
  for sid,old in original_series.items():
   new=dict(c.execute('SELECT * FROM series WHERE series_id=?',(sid,)).fetchone())
   assert all(new[k]==v for k,v in old.items() if k not in ['category_code','parent_series_id']),sid
  for cid,old in original_candidates.items():
   new=dict(c.execute('SELECT * FROM series_candidates WHERE candidate_id=?',(cid,)).fetchone())
   assert all(new[k]==v for k,v in old.items() if k!='event_count'),cid
 if sha(source)!=before or sha(root/'sametimeworld.db')!=master_before:raise RuntimeError('Original DB changed while staging')
 stage.replace(source)
 with closing(sqlite3.connect(source)) as c:review=c.execute('SELECT candidate_id,title FROM series_candidates ORDER BY candidate_id').fetchall()
 (root/'series_candidates_review.txt').write_text(''.join(str(i)+'\t'+t+'\n' for i,t in review),encoding='utf-8')
 data=base64.b64encode(gzip.compress(json.dumps(catalog,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=9,mtime=0))+b'\n';digest=hashlib.sha256(data).hexdigest();file='s/'+digest[:24]+'.txt';(root/'public'/file).write_bytes(data)
 new_cfg={**cfg,'file':file,'sha256':digest,'series_count':len(catalog['series']),'entity_series_count':len(active)}
 cfg_path.write_text('export default '+json.dumps(new_cfg,separators=(',',':'))+';\n',encoding='utf-8')
 report={'events_scanned':len(events),'registered_definitions':len(DEFINITIONS),'active_target_series':len(active),'catalogue_series':len(catalog['series']),'new_series':new_series,'new_candidate_names':new_candidates,'new_series_links':new_links,'waiting_for_events':sum(r['state']=='waiting_for_events' for r in report_rows),'master_unchanged':True,'original_ids_and_memberships_preserved':True,'quick_check':'ok','series_sha256':sha(source),'catalogue':new_cfg,'rows':report_rows}
 (out/'series-expansion-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 names={d['key']:d['name'] for d in DEFINITIONS}
 (out/'series-membership-audit.tsv').write_text('event_id\t사건명\t시리즈명\t연결 근거\n'+''.join(f"{r['event_id']}\t{r['title']}\t{names[r['key']]}\t{r['reason']}\n" for r in audit),encoding='utf-8-sig')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,default=ROOT);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--apply',action='store_true');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 events,groups,audit=preview(a.root)
 if a.apply:r=apply(a.root,a.output,events,groups,audit);print(json.dumps({k:v for k,v in r.items() if k!='rows'},ensure_ascii=False))
 else:
  r=[{'key':d['key'],'name':d['name'],'events':len(groups[d['key']]),'examples':[e['title'] for e in groups[d['key']][:4]]} for d in DEFINITIONS];(a.output/'preview.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');print('Preview written; no DB changed')
