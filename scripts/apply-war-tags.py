#!/usr/bin/env python3
"""Apply an inspected tag preview additively; keep all series/candidate IDs and links."""
import argparse,base64,gzip,hashlib,json,pathlib,re,shutil,sqlite3
from contextlib import closing

def apply(root,preview,report_dir):
 source=root/'series.db';before=hashlib.sha256(source.read_bytes()).hexdigest()
 if any((root/('series.db'+s)).exists() for s in ['-wal','-shm','-journal']):raise RuntimeError('Active series DB journal')
 report_dir.mkdir(parents=True,exist_ok=True);stage=report_dir/'series-tagged.db';shutil.copy2(source,stage)
 links=json.loads(preview.read_text(encoding='utf-8'))['links'];grouped={}
 for row in links:
  for tag in row['tags']:grouped.setdefault(tag,set()).add(row['event_id'])
 with closing(sqlite3.connect(stage)) as c,closing(sqlite3.connect(source)) as original:
  original_ids={r[0] for r in c.execute('SELECT concept_id FROM concepts')};original_links=set(c.execute('SELECT * FROM concept_events'))
  protected={table:list(c.execute('SELECT * FROM '+table)) for table in ['series','series_items','series_candidates','candidate_events','candidate_notes','series_templates']}
  ids={};next_id=max(original_ids)+1
  for name,event_ids in sorted(grouped.items()):
   row=c.execute('SELECT concept_id FROM concepts WHERE name=? AND concept_type=?',(name,'topic')).fetchone()
   if row:cid=row[0]
   else:cid=next_id;next_id+=1;c.execute('INSERT INTO concepts VALUES(?,?,?,?)',(cid,name,'topic',0))
   ids[name]=cid;c.executemany('INSERT OR IGNORE INTO concept_events VALUES(?,?)',[(cid,i) for i in sorted(event_ids)])
   c.execute('UPDATE concepts SET event_count=(SELECT COUNT(*) FROM concept_events WHERE concept_id=?) WHERE concept_id=?',(cid,cid))
  c.execute('INSERT OR REPLACE INTO metadata VALUES(?,?)',('war_tag_concept_ids',json.dumps(ids,ensure_ascii=False,sort_keys=True)))
  c.execute('INSERT OR REPLACE INTO metadata VALUES(?,?)',('war_tag_basis','Explicit names + bounded campaign/actor context; additive review, not a causal narrative'))
  c.commit()
  assert c.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()[0]==0
  assert c.execute('PRAGMA journal_mode=DELETE').fetchone()[0]=='delete'
  assert c.execute('PRAGMA quick_check').fetchone()[0]=='ok'
  assert original_links<=set(c.execute('SELECT * FROM concept_events'))
  for table,rows in protected.items():assert rows==list(c.execute('SELECT * FROM '+table)),table
  cfg_path=root/'src/series-config.js';config=json.loads(re.search(r'export default\s*(\{.*\})',cfg_path.read_text(encoding='utf-8')).group(1))
  catalog=json.loads(gzip.decompress(base64.b64decode((root/'public'/config['file']).read_bytes())))
  old_concepts={r['id']:r for r in catalog['concepts']}
  for name,cid in ids.items():
   event_ids=[r[0] for r in c.execute('SELECT event_id FROM concept_events WHERE concept_id=? ORDER BY event_id',(cid,))]
   entry={'id':cid,'name':name,'type':'topic','events':event_ids,'war_tag':True}
   if cid in old_concepts:old_concepts[cid].update(entry)
   else:catalog['concepts'].append(entry)
  catalog['version']=2;catalog['basis']='Existing concept links plus audited war/campaign context; not a causal narrative'
  data=base64.b64encode(gzip.compress(json.dumps(catalog,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=9,mtime=0))+b'\n'
  digest=hashlib.sha256(data).hexdigest();file='s/'+digest[:24]+'.txt'
  next_config={**config,'file':file,'sha256':digest,'version':2,'concept_count':len(catalog['concepts']),'war_tag_count':len(ids),'war_tag_links':sum(len(v) for v in grouped.values())}
  next_config.pop('master_sha256',None)
 if hashlib.sha256(source.read_bytes()).hexdigest()!=before:raise RuntimeError('Series DB changed during apply')
 stage.replace(source)
 # The owner's ID<TAB>text review file is refreshed immediately on every series DB change.
 with closing(sqlite3.connect(source)) as c:
  rows=c.execute('SELECT candidate_id,title FROM series_candidates ORDER BY candidate_id').fetchall()
 (root/'series_candidates_review.txt').write_text(''.join(str(i)+'\t'+title+'\n' for i,title in rows),encoding='utf-8')
 (root/'public'/file).write_bytes(data);cfg_path.write_text('export default '+json.dumps(next_config,separators=(',',':'))+';\n',encoding='utf-8')
 result={'events_scanned':json.loads(preview.read_text(encoding='utf-8'))['events_scanned'],'tagged_events':len(links),'war_tag_count':len(ids),'war_tag_links':sum(len(v) for v in grouped.values()),'counts':{k:len(v) for k,v in sorted(grouped.items())},'series_and_candidates_unchanged':True,'original_concept_links_preserved':True,'quick_check':'ok','series_before_sha256':before,'series_after_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'catalogue':next_config}
 (report_dir/'war-tags-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,required=True);p.add_argument('--preview',type=pathlib.Path,required=True);p.add_argument('--report-dir',type=pathlib.Path,required=True);a=p.parse_args();print(json.dumps(apply(a.root,a.preview,a.report_dir),ensure_ascii=False))
