import importlib.util,pathlib,unittest,json,shutil,sqlite3,tempfile,hashlib,re
from contextlib import closing

class SeriesExpansionTests(unittest.TestCase):
 def identify(self,**row):
  p=pathlib.Path(__file__).resolve().parents[1]/'scripts/expand-entity-series.py'
  spec=importlib.util.spec_from_file_location('expansion',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  return set(m.identify(row))
 def test_examples_and_parent_units(self):
  ids=self.identify(subject='이지중대',title='훈련',year=1942)
  self.assertTrue({'easy-company','us-101st-airborne','us-506th-infantry'}<=ids)
  self.assertIn('enterprise-cv6',self.identify(subject='엔터프라이즈 CV-6',title='수리'))
 def test_varied_subjects(self):
  self.assertIn('suez-canal',self.identify(title='수에즈 운하 개통'))
  self.assertIn('penicillin',self.identify(title='페니실린 환자 치료 시작'))
  self.assertIn('voc',self.identify(title='회사의 선박 수리',country='VOC 희망봉'))
 def test_substrings_are_not_entities(self):
  self.assertNotIn('voc',self.identify(description='『Vocabulario』 사전 출판'))
  self.assertNotIn('photography',self.identify(description='검사 진술을 검토했다.'))
  self.assertNotIn('saltpetre',self.identify(description='교회의 기초석을 놓았다.'))
  self.assertNotIn('impressionism',self.identify(title='임금인상 파업'))
 def test_person_namesakes_and_sources(self):
  ids=self.identify(title='로버트 루이스 스티븐슨 출생')
  self.assertNotIn('person-13',ids)
  ids=self.identify(description='뉴욕의 러브레이스 총독이 협상했다.',year=1670)
  self.assertNotIn('person-43',ids)
  self.assertNotIn('smithsonian',self.identify(title='재봉틀 특허',description='스미스소니언 자료는 접속 오류로 본문 대조 보류'))
  self.assertNotIn('enterprise-cv6',self.identify(description='출처 파일: 엔터프라이즈 CV-6.txt'))
 def test_tank_is_not_tram(self):
  self.assertNotIn('tanks',self.identify(title='서울 전차 운행 시작',category='교통'))
  self.assertIn('tanks',self.identify(title='영국 전차가 솜 전투에 실전 투입됨',category='전쟁'))
 def test_idempotent_refresh_and_future_event(self):
  root=pathlib.Path(__file__).resolve().parents[1]
  if not (root/'series.db').exists():self.skipTest('Private relation DB is not in public Git checkout')
  spec=importlib.util.spec_from_file_location('expansion_apply',root/'scripts/expand-entity-series.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as directory:
   target=pathlib.Path(directory);out=target/'report';out.mkdir();(target/'src').mkdir();(target/'public/s').mkdir(parents=True);(target/'scripts').mkdir()
   for name in ['sametimeworld.db','series.db','src/series-config.js','scripts/series-entity-rules.json']:shutil.copy2(root/name,target/name)
   cfg=json.loads(re.search(r'export default\s*(\{.*\})',(root/'src/series-config.js').read_text(encoding='utf-8')).group(1));shutil.copy2(root/'public'/cfg['file'],target/'public'/cfg['file'])
   before=hashlib.sha256((target/'sametimeworld.db').read_bytes()).hexdigest()
   series_before=hashlib.sha256((target/'series.db').read_bytes()).hexdigest();journal=target/'sametimeworld.db-journal';journal.write_bytes(b'test active journal')
   with self.assertRaisesRegex(RuntimeError,'journal'):m.apply(target,out,[],{},[])
   self.assertEqual(hashlib.sha256((target/'series.db').read_bytes()).hexdigest(),series_before);journal.unlink()
   events,groups,audit=m.preview(target);first=m.apply(target,out,events,groups,audit)
   with closing(sqlite3.connect(target/'series.db')) as c:ids1=json.loads(c.execute("SELECT value FROM metadata WHERE key='entity_series_registry'").fetchone()[0])
   second=m.apply(target,out,events,groups,audit)
   self.assertEqual(second['new_series'],0);self.assertEqual(second['new_candidate_names'],0);self.assertEqual(second['new_series_links'],0)
   self.assertEqual(hashlib.sha256((target/'sametimeworld.db').read_bytes()).hexdigest(),before)
   row=dict(events[0]);row.update(event_id=999999,year=1948,month=1,day=1,date='1948-01-01',title='수에즈 운하 추가 공사',description='',subject=None)
   with closing(sqlite3.connect(target/'sametimeworld.db')) as c:
    c.execute('INSERT INTO event_data('+','.join(row)+') VALUES('+','.join('?' for _ in row)+')',tuple(row.values()));c.commit()
   groups['suez-canal'].append(row);events.append(row)
   third=m.apply(target,out,events,groups,audit)
   with closing(sqlite3.connect(target/'series.db')) as c:
    ids2=json.loads(c.execute("SELECT value FROM metadata WHERE key='entity_series_registry'").fetchone()[0]);self.assertEqual(ids1,ids2)
    self.assertTrue(c.execute('SELECT 1 FROM series_items WHERE series_id=? AND event_id=999999',(ids2['suez-canal']['series_id'],)).fetchone())
   self.assertEqual(third['new_series_links'],1)

if __name__=='__main__':unittest.main()
