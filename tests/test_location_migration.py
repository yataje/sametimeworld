import copy,hashlib,importlib.util,json,pathlib,sqlite3,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class MigrationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.db=self.root/'base.db';c=sqlite3.connect(self.db)
  c.executescript('''CREATE TABLE event_data(event_id INTEGER PRIMARY KEY,date TEXT,title TEXT,description TEXT,place TEXT,locality TEXT,country TEXT,latitude REAL,longitude REAL,map_status TEXT,location_precision TEXT);INSERT INTO event_data VALUES(1,'1592-05-23','부산 상륙','부산에 상륙했다.','부산포','부산포','조선',NULL,NULL,'unresolved',NULL);CREATE TABLE concepts(concept_id INTEGER PRIMARY KEY,name TEXT);INSERT INTO concepts VALUES(1,'부산포');CREATE VIEW event_details AS SELECT event_id,date,title,description,place,locality,country,latitude,longitude,map_status,location_precision,NULL AS resolved_place,NULL AS coordinate_status,NULL AS location_resolution_method FROM event_data;CREATE VIEW web_events AS SELECT event_id AS id,date,title,description,place,locality,country,latitude,longitude,map_status,location_precision,resolved_place,coordinate_status,location_resolution_method FROM event_details;CREATE VIEW events AS SELECT id, date AS 날짜,title AS 내용,latitude AS 위도,longitude AS 경도,location_precision AS 위치정밀도 FROM web_events;''');c.close()
  ids=[[1,'1592-05-23','부산 상륙','부산에 상륙했다.','부산포','부산포','조선']]
  self.patch={'schema':'stw-location-update-2','version':2,'count':1,'identity_sha256':hashlib.sha256(json.dumps(ids,ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'rows':[{'id':1,'fields':{'latitude':35.15,'longitude':129.05,'resolved_place':'부산','location_precision':'city','map_status':'gazetteer_context_matched','coordinate_status':'gazetteer_context_matched','location_resolution_method':'place_name_country_match','location_policy_version':2,'location_country_code':'KOR','location_place_id':'example:busan','location_source':'test reference','location_evidence':'부산포','location_note':'도시 대표점'}}]}
 def tearDown(self):self.tmp.cleanup()
 def api(self):
  p=ROOT/'scripts/apply-location-update.py';self.assertTrue(p.exists(),'Location-only master migration is not implemented')
  s=importlib.util.spec_from_file_location('location_migration',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
 def digest(self):return hashlib.sha256(self.db.read_bytes()).hexdigest()
 def test_original_preserved_and_all_views_receive_coordinates(self):
  before=self.digest();out=self.root/'new.db';self.api().apply_copy(self.db,out,self.patch);self.assertEqual(before,self.digest());c=sqlite3.connect(out)
  self.assertEqual(c.execute('select latitude,longitude from web_events').fetchone(),(35.15,129.05));self.assertEqual(c.execute('select 위도,경도 from events').fetchone(),(35.15,129.05));self.assertEqual(c.execute('select latitude from event_data').fetchone(),(None,));self.assertEqual(c.execute('select name from concepts').fetchone(),('부산포',));self.assertEqual(c.execute('pragma integrity_check').fetchone()[0],'ok');self.assertEqual(c.execute('pragma foreign_key_check').fetchall(),[]);c.close()
 def test_idempotent_reapplication(self):
  a=self.root/'a.db';b=self.root/'b.db';api=self.api();api.apply_copy(self.db,a,self.patch);api.apply_copy(a,b,self.patch);c=sqlite3.connect(b);self.assertEqual(c.execute('select count(*) from event_location_v2').fetchone()[0],1);self.assertEqual(c.execute('select count(*) from location_places_v2').fetchone()[0],1);c.close()
 def test_changed_historical_text_rejects_before_replacement(self):
  c=sqlite3.connect(self.db);c.execute("update event_data set description='사용자 수정'");c.commit();c.close();before=self.digest()
  with self.assertRaises(ValueError):self.api().apply_copy(self.db,self.root/'out.db',self.patch)
  self.assertEqual(before,self.digest());self.assertFalse((self.root/'out.db').exists())
 def test_invalid_point_and_duplicate_id_are_rejected(self):
  for key,value in [('latitude',100),('latitude',True),('location_precision','continent')]:
   p=copy.deepcopy(self.patch);p['rows'][0]['fields'][key]=value
   with self.assertRaises(ValueError):self.api().apply_copy(self.db,self.root/'bad.db',p)
  p=copy.deepcopy(self.patch);p['rows']*=2
  with self.assertRaises(ValueError):self.api().apply_copy(self.db,self.root/'bad.db',p)
 def test_cannot_write_over_input(self):
  before=self.digest()
  with self.assertRaises(ValueError):self.api().apply_copy(self.db,self.db,self.patch)
  self.assertEqual(before,self.digest())
 def test_null_point_remains_null_without_inventing_country(self):
  p=copy.deepcopy(self.patch);p['rows'][0]['fields'].update(latitude=None,longitude=None,resolved_place=None,location_precision=None,map_status='unresolved',coordinate_status=None)
  out=self.root/'out.db';self.api().apply_copy(self.db,out,p);c=sqlite3.connect(out);self.assertEqual(c.execute('select latitude,map_status from web_events').fetchone(),(None,'unresolved'));c.close()
if __name__=='__main__':unittest.main()
