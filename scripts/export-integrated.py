#!/usr/bin/env python3
"""Export the lean SameTimeWorld SQLite master to the public event snapshot."""
from __future__ import annotations
from contextlib import closing
import argparse, gzip, hashlib, json, pathlib, re, sqlite3

REGIONS={'유럽/아프리카','중동','동아시아/오세아니아','아메리카'}

def timeline_date(row:dict)->str:
    """Return the viewer index interval while preserving source text in date/original_date."""
    date=str(row.get('date') or '').strip()
    end_date=str(row.get('end_date') or '').strip()
    precision=str(row.get('date_precision') or '').strip()
    year=row.get('year')
    year_end=row.get('year_end')

    if precision=='decade' and year is not None:
        first=int(year)
        return f'{first:04d}/{int(year_end) if year_end is not None else first+9:04d}'

    # Already machine-readable dates stay authoritative for the viewer.
    if re.fullmatch(r'\d{4}(?:-\d{2})?(?:-\d{2})?',date):
        if end_date and re.fullmatch(r'\d{4}(?:-\d{2})?(?:-\d{2})?',end_date):
            return date+'/'+end_date
        return date

    # Ranges and approximate dates need only a stable chronological index.
    if year is not None:
        y1=int(year)
        if year_end is not None and int(year_end)!=y1:
            return f'{y1:04d}/{int(year_end):04d}'
        return f'{y1:04d}'
    if year_end is not None:
        return f'{int(year_end):04d}'

    m=re.search(r'(?<!\d)(\d{4})(?!\d)',date)
    if m:
        return m.group(1)
    raise ValueError(f"No usable timeline date for event {row.get('event_id')}")

def _urls(text:str)->list[str]:
    out=[]
    seen=set()
    for raw in re.findall(r'https?://[^\s<>]+',text or ''):
        url=raw.rstrip('.,;)]}')
        if url not in seen:
            seen.add(url);out.append(url)
    return out

def export(master:pathlib.Path,output:pathlib.Path)->dict:
    before=hashlib.sha256(master.read_bytes()).hexdigest()
    with closing(sqlite3.connect(master.resolve().as_uri()+'?mode=ro',uri=True)) as c:
        c.row_factory=sqlite3.Row
        if c.execute('PRAGMA quick_check').fetchone()[0]!='ok':
            raise ValueError('Invalid master database')
        names={r['name'] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'event_data' not in names:
            raise ValueError('Lean event_data table is missing')

        events=[]
        for raw in c.execute('SELECT * FROM event_data ORDER BY event_id'):
            r=dict(raw)
            event={
                'id':r['event_id'],
                'date':r.get('date') or '',
                'date_precision':r.get('date_precision') or '',
                'timeline_date':timeline_date(r),
                'date_label':timeline_date(r).replace('/','–') if r.get('date_precision')=='decade' else '',
                'day_comparison_eligible':r.get('day_comparison_eligible'),
                'region':r.get('continent') or '',
                'country':r.get('country') or '',
                'locality':r.get('region') or '',
                'category':r.get('category') or '',
                'title':r.get('title') or '',
                'description':r.get('description') or '',
                'importance':int(r.get('importance') or 0),
                'subject':r.get('subject') or '',
                'original_date':r.get('original_date') or '',
                'latitude':r.get('latitude'),
                'longitude':r.get('longitude'),
                'location_precision':r.get('location_precision') or '',
                'place':r.get('place') or '',
                'resolved_place':r.get('place') or '',
                'map_status':r.get('coordinate_status') or ('reference_coordinate_checked' if r.get('latitude') is not None and r.get('longitude') is not None else 'unresolved'),
                'location_resolution_method':r.get('location_resolution_method') or '',
                'sources':_urls(r.get('description') or ''),
            }
            # Do not publish empty compatibility fields.
            event={k:v for k,v in event.items() if v not in (None,'',[]) or k in ('id','date','timeline_date','region','country','category','title','description','importance')}
            events.append(event)

    if len({e['id'] for e in events})!=len(events):
        raise ValueError('Duplicate event IDs')
    if hashlib.sha256(master.read_bytes()).hexdigest()!=before:
        raise RuntimeError('Master changed during export')

    meta={
        'schema':'stw-events-export-2',
        'data_version':'2026-10-04-coordinate-audit',
        'events_count':len(events),
        'source_master_sha256':before,
        'coordinates_available':sum(e.get('latitude') is not None and e.get('longitude') is not None for e in events),
        'sources_available':sum(bool(e.get('sources')) for e in events),
        'unclassified_events':sum(e.get('region') not in REGIONS for e in events),
        'viewer_contract':'Lean runtime export: duplicate/raw/audit fields omitted; date is source display text and timeline_date is the chronological index.'
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    payload=json.dumps({'meta':meta,'events':events},ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    output.write_bytes(gzip.compress(payload,compresslevel=9,mtime=0))
    output.with_name('export-meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return {**meta,'compressed_bytes':output.stat().st_size,'uncompressed_bytes':len(payload),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('master',type=pathlib.Path)
    p.add_argument('output',type=pathlib.Path)
    a=p.parse_args()
    print(json.dumps(export(a.master,a.output),ensure_ascii=False,indent=2))
