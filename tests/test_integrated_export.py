import importlib.util,pathlib,tempfile,sqlite3,unittest,gzip,json
P=pathlib.Path(__file__).parents[1]/'scripts/export-integrated.py'

class ExportTests(unittest.TestCase):
 def setUp(self):
  self.assertTrue(P.exists(),'lean integrated exporter must exist')
  s=importlib.util.spec_from_file_location('export_integrated',P);self.m=importlib.util.module_from_spec(s);s.loader.exec_module(self.m)

 def test_standard_day_stays_exact(self):
  self.assertEqual(self.m.timeline_date({'event_id':1,'date':'1877-01-01','date_precision':'day','year':1877}),'1877-01-01')

 def test_machine_readable_range_uses_end_date(self):
  self.assertEqual(self.m.timeline_date({'event_id':2,'date':'1586-10-14','end_date':'1586-10-15','date_precision':'day_range','year':1586,'year_end':1586}),'1586-10-14/1586-10-15')

 def test_hijri_source_text_uses_explicit_index_years(self):
  r={'event_id':3,'date':'히즈라 1220년(출처 서력 1805–1806년 대응)','year':1805,'year_end':1806,'date_precision':'year_range'}
  self.assertEqual(self.m.timeline_date(r),'1805/1806')

 def test_upper_bound_only_is_preserved(self):
  r={'event_id':4,'date':'1712년까지','year':None,'year_end':1712,'date_precision':'circa'}
  self.assertEqual(self.m.timeline_date(r),'1712')

 def test_export_reads_lean_event_data(self):
  with tempfile.TemporaryDirectory() as td:
   db=pathlib.Path(td)/'master.db';out=pathlib.Path(td)/'events.web.json.gz'
   with sqlite3.connect(db) as c:
    c.execute('''CREATE TABLE event_data(
      event_id INTEGER PRIMARY KEY,date TEXT,date_precision TEXT,year INTEGER,end_date TEXT,year_end INTEGER,
      original_date TEXT,continent TEXT,country TEXT,region TEXT,category TEXT,title TEXT,description TEXT,
      importance INTEGER,subject TEXT,latitude REAL,longitude REAL,location_precision TEXT)''')
    c.execute('''INSERT INTO event_data VALUES(1,'1877-01-01','day',1877,NULL,NULL,'','중동','인도(영국령)','인도 델리','정치','테스트 사건','설명 https://example.com/source',3,'',28.67,77.22,'city')''')
   meta=self.m.export(db,out)
   self.assertEqual(meta['events_count'],1)
   payload=json.loads(gzip.decompress(out.read_bytes()))
   e=payload['events'][0]
   self.assertEqual(e['id'],1);self.assertEqual(e['region'],'중동');self.assertEqual(e['locality'],'인도 델리')
   self.assertEqual(e['sources'],['https://example.com/source'])
   self.assertNotIn('display_start_label',e);self.assertNotIn('normalized_gregorian_date',e)

if __name__=='__main__':unittest.main()
