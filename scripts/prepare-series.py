#!/usr/bin/env python3
"""Add explicitly tagged automatic series to a copied master; export a public lazy catalogue."""
import base64,gzip,hashlib,json,pathlib,sqlite3,sys
GROUPS=[
 ('industry','산업과 기술',['산업','기술','과학기술']),
 ('transport','교통과 이동',['교통','증기선','해상 교통','운송기술']),
 ('trade','무역과 경제',['무역','경제','해상무역']),
 ('slavery','노예제와 강제노동',['노예제','노예무역','강제노동','노예제폐지','노예제 저항']),
 ('science','과학과 천문',['과학','천문','천문학','천문 관측']),
 ('medicine','의학과 질병',['의학','질병','보건','공중보건']),
 ('education','교육과 출판',['교육','출판','인쇄']),
 ('culture','문화와 예술',['문화','예술','문학','음악']),
 ('diplomacy','외교와 국제관계',['외교','조약','국제관계']),
 ('war','전쟁과 군사',['전쟁','군사','군사기술'])]
def prepare(master,repo):
 c=sqlite3.connect(master);c.execute('pragma foreign_keys=on')
 concepts=[]
 for cid,name,typ in c.execute("SELECT concept_id,name,type FROM concepts WHERE type!='continent' ORDER BY concept_id"):
  ids=[r[0] for r in c.execute('SELECT DISTINCT event_id FROM event_concepts WHERE concept_id=? ORDER BY event_id',(cid,))]
  if ids:concepts.append({'id':cid,'name':name,'type':typ,'events':ids})
 series=[]
 for slug,title,names in GROUPS:
  cc=[x for x in concepts if x['type']=='topic' and x['name'] in names];ids=sorted(set(i for x in cc for i in x['events']));cid=[x['id'] for x in cc]
  if not ids:continue
  public='auto-'+slug;desc='기존 주제 연결: '+', '.join(x['name'] for x in cc)+' · 수록 자료 기준 자동 모음'
  rule=json.dumps({'schema':1,'any_concept_ids':cid,'basis':'inherited_source_labels_not_causal_story'},ensure_ascii=False,separators=(',',':'))
  c.execute("INSERT INTO series(public_id,title,description,curation_status,selection_mode,rules_json) VALUES(?,?,?,'automatic_unreviewed','rules',?) ON CONFLICT(public_id) DO UPDATE SET title=excluded.title,description=excluded.description,rules_json=excluded.rules_json",(public,title,desc,rule))
  sid=c.execute('SELECT series_id FROM series WHERE public_id=?',(public,)).fetchone()[0];c.execute('DELETE FROM series_items WHERE series_id=?',(sid,))
  keys={r[0]:r[1:] for r in c.execute('select event_id,coalesce(year_start,sort_year,9999),sort_month,sort_day from event_data')}
  ordered=sorted(ids,key=lambda i:(*keys[i],i));c.executemany("INSERT INTO series_items(series_id,event_id,sequence,role) VALUES(?,?,?,'tag_match')",[(sid,i,n+1) for n,i in enumerate(ordered)])
  series.append({'id':public,'title':title,'description':desc,'kind':'automatic','concept_ids':cid,'match':'any','events':ordered})
 c.execute("INSERT OR REPLACE INTO metadata VALUES('series_version','S1')");c.commit()
 assert c.execute('pragma integrity_check').fetchone()[0]=='ok';assert not c.execute('pragma foreign_key_check').fetchall();c.close()
 raw=json.dumps({'schema':1,'version':1,'basis':'Existing source concept links, not independent historical validation','series':series,'concepts':concepts},ensure_ascii=False,separators=(',',':')).encode()
 encoded=base64.b64encode(gzip.compress(raw,mtime=0,compresslevel=9))+b'\n';h=hashlib.sha256(encoded).hexdigest();name='s/'+h[:24]+'.txt';out=repo/'public'/name;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(encoded)
 cfg={'file':name,'sha256':h,'version':1,'series_count':len(series),'concept_count':len(concepts),'master_sha256':hashlib.sha256(master.read_bytes()).hexdigest()}
 (repo/'src/series-config.js').write_text('export default '+json.dumps(cfg,separators=(',',':'))+';\n')
 print(json.dumps({**cfg,'bytes':len(encoded),'series':[(s['title'],len(s['events'])) for s in series]},ensure_ascii=False))
if __name__=='__main__':prepare(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]))
