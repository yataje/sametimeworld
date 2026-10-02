#!/usr/bin/env python3
"""Read the integrated master without mutations; export a deterministic public snapshot."""
from __future__ import annotations
import argparse,datetime,gzip,hashlib,json,pathlib,re,sqlite3

def timeline_date(row:dict)->str:
 """Index label only, not a claim of an exact Gregorian event date."""
 if row.get('day_comparison_eligible')==1 and row.get('normalized_gregorian_date'):
  return row['normalized_gregorian_date']
 if row.get('normalized_gregorian_start') and row.get('normalized_gregorian_end'):
  return row['normalized_gregorian_start']+'/'+row['normalized_gregorian_end']
 y1,y2=row.get('year_start'),row.get('year_end')
 if row.get('date_precision')=='decade' and y1 is not None and y2 is not None:return f'{y1:04d}/{y2:04d}'
 labels=[row.get('display_start_label'),row.get('display_end_label')]
 valid=[s for s in labels if isinstance(s,str) and re.fullmatch(r'\d{4}(?:-\d{2}){0,2}',s)]
 if valid and (y1 is None or int(valid[0][:4])==y1):return '/'.join(valid)
 if y1 is not None:return str(y1) if y2 in (None,y1) else f'{y1:04d}/{y2:04d}'
 if y2 is not None:return str(y2)
 # Preserve the already supplied index anchor, never scrape another calendar's digits.
 return str(row.get('timeline_anchor') or '')

def export(master:pathlib.Path,output:pathlib.Path)->dict:
 before=hashlib.sha256(master.read_bytes()).hexdigest()
 with sqlite3.connect(master.resolve().as_uri()+'?mode=ro',uri=True) as c:
  c.row_factory=sqlite3.Row
  if c.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('Invalid master database')
  sources={}
  for r in c.execute('SELECT DISTINCT e.event_id,s.url FROM event_sources e JOIN sources s USING(source_id) ORDER BY e.event_id,s.url'):
   sources.setdefault(r['event_id'],[]).append(r['url'])
  details={r['event_id']:dict(r) for r in c.execute('SELECT event_id,year_start,year_end,display_start_label,display_end_label,normalized_gregorian_date,normalized_gregorian_start,normalized_gregorian_end,date_basis,range_semantics,resolved_place,source_review_level FROM event_details')}
  events=[];fixes=[]
  for row in c.execute('SELECT * FROM web_events ORDER BY id'):
   e=dict(row);d=details[e['id']];e.update(d)
   e.pop('event_id',None)
   e['sources']=sources.get(e['id'],[])
   e['source_calendar']=e.get('calendar') or ''
   e['timeline_date']=timeline_date(e)
   e['timeline_index_basis']='source_claim_not_independently_reverified'
   if e.get('normalized_gregorian_start') and e.get('normalized_gregorian_end'):
    e['normalized_gregorian_range']={'start':e['normalized_gregorian_start'],'end':e['normalized_gregorian_end']}
   if e.get('date_precision')=='decade':e['date_label']=f"{e['year_start']}–{e['year_end']}년 · 연대 범위"
   elif e.get('date_precision')=='circa' and re.fullmatch(r'\d{4}',str(e.get('date_label') or '')):e['date_label']+='년경'
   if e['timeline_anchor'][:4]!=e['timeline_date'][:4]:fixes.append({'id':e['id'],'previous_anchor':e['timeline_anchor'],'timeline_date':e['timeline_date']})
   if not re.match(r'^\d{4}',e['timeline_date']):raise ValueError(f"No usable index bounds: {e['id']}")
   events.append(e)
 if len({e['id'] for e in events})!=len(events):raise ValueError('Duplicate event IDs')
 if hashlib.sha256(master.read_bytes()).hexdigest()!=before:raise RuntimeError('Master changed during export')
 meta={'schema':'stw-events-export-2','data_version':'2026-10-03-integrated-v1','events_count':len(events),'source_master_sha256':before,'timeline_anchor_corrections':fixes,'coordinates_available':sum(e['latitude'] is not None and e['longitude'] is not None for e in events),'sources_available':sum(bool(e['sources']) for e in events),'unclassified_events':sum(e['region'] not in ['유럽/아프리카','중동','동아시아/오세아니아','아메리카'] for e in events),'viewer_contract':'date is source text; timeline_date is an indexing interval, not a verified date; respect map_status; preserve existing leader payload'}
 output.parent.mkdir(parents=True,exist_ok=True)
 payload=json.dumps({'meta':meta,'events':events},ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
 output.write_bytes(gzip.compress(payload,compresslevel=9,mtime=0))
 output.with_name('export-meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 return {**meta,'compressed_bytes':output.stat().st_size,'uncompressed_bytes':len(payload),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('master',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);a=p.parse_args();print(json.dumps(export(a.master,a.output),ensure_ascii=False,indent=2))
