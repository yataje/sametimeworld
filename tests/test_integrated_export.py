import importlib.util,pathlib,unittest
P=pathlib.Path(__file__).parents[1]/'scripts/export-integrated.py'
class ExportTests(unittest.TestCase):
 def setUp(self):
  self.assertTrue(P.exists(),'reproducible integrated exporter must exist')
  s=importlib.util.spec_from_file_location('export_integrated',P);self.m=importlib.util.module_from_spec(s);s.loader.exec_module(self.m)
 def test_hijri_uses_explicit_western_years(self):
  r={'date':'히즈라 1220년(출처 서력 1805–1806년 대응)','year_start':1805,'year_end':1806,'date_precision':'year_range','timeline_anchor':'1220'}
  self.assertEqual(self.m.timeline_date(r),'1805/1806');self.assertTrue(r['date'].startswith('히즈라'))
 def test_decade_not_single_year(self):
  self.assertEqual(self.m.timeline_date({'date':'1850','year_start':1850,'year_end':1859,'date_precision':'decade'}),'1850/1859')
 def test_precise_range_preserved(self):
  r={'date':'1586-10-14/1586-10-15','date_precision':'day_range','year_start':1586,'year_end':1586,'display_start_label':'1586-10-14','display_end_label':'1586-10-15'}
  self.assertEqual(self.m.timeline_date(r),r['date'])
 def test_normalized_day_is_only_used_when_eligible(self):
  r={'date':'1600-01-01','date_precision':'day','year_start':1600,'year_end':1600,'display_start_label':'1600-01-01','normalized_gregorian_date':'1600-01-11','day_comparison_eligible':0}
  self.assertEqual(self.m.timeline_date(r),'1600-01-01');r['day_comparison_eligible']=1;self.assertEqual(self.m.timeline_date(r),'1600-01-11')
 def test_upper_bound_does_not_invent_start(self):
  r={'date':'1712년까지','date_precision':'circa','year_end':1712,'timeline_anchor':'1712'}
  self.assertEqual(self.m.timeline_date(r),'1712');self.assertIsNone(r.get('year_start'))
if __name__=='__main__':unittest.main()
