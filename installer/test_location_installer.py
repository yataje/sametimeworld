import gzip,hashlib,importlib.util,io,json,os,pathlib,shutil,sqlite3,subprocess,sys,tempfile,unittest,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
packer=load('packer',ROOT/'installer/pack.py');fixture=load('fixture',ROOT/'tests/test_location_migration.py')
def package(stub,files):
 payload=packer.make_payload(files,'0.8.1');out=io.BytesIO()
 with zipfile.ZipFile(io.BytesIO(payload)) as a,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as b:
  for name in a.namelist():
   value=a.read(name)
   if name=='_stw_manifest.json':m=json.loads(value);m['mode']='location_update';value=json.dumps(m).encode()
   b.writestr(name,value)
 return packer.assemble(stub,out.getvalue())
class LocationInstallerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stub=(ROOT/'installer/build/SameTimeWorld_LocalSave.stub.exe').read_bytes();cls.helper=(ROOT/'installer/build/LocationDBUpdate.exe').read_bytes()
 def setUp(self):
  self.fixture=fixture.MigrationTests();self.fixture.setUp();self.root=self.fixture.root;self.target=self.root/'project';self.target.mkdir();shutil.copy2(self.fixture.db,self.target/'sametimeworld.db');(self.target/'world_leaders.db').write_bytes(b'leader-bytes-do-not-replace');(self.target/'user.txt').write_bytes(b'user data');(self.target/'.git').mkdir();(self.target/'.git/config').write_text('test repository');(self.target/'empty').mkdir()
  patch=gzip.compress(json.dumps(self.fixture.patch,ensure_ascii=False).encode());files={'index.html':b'new-site','data/location/location-update.json.gz':patch,'tools/LocationDBUpdate.exe':self.helper}
  self.exe=self.root/'update.exe';self.exe.write_bytes(package(self.stub,files))
 def tearDown(self):self.fixture.tearDown()
 def runexe(self,*args):
  r=subprocess.run([str(self.exe),*map(str,args)],capture_output=True,timeout=180)
  if r.returncode:print('Expected or actual failure:',r.stderr.decode(errors='replace')[:1200])
  return r.returncode
 def inventory(self):return {str(p.relative_to(self.target)):hashlib.sha256(p.read_bytes()).hexdigest() for p in self.target.rglob('*') if p.is_file()}
 def test_actual_exe_migrates_and_preserves_full_backup(self):
  before=self.inventory();self.assertEqual(self.runexe('/verify'),0);self.assertEqual(self.runexe('/install',self.target),0)
  c=sqlite3.connect(self.target/'sametimeworld.db');self.assertEqual(c.execute('select latitude,longitude from web_events').fetchone(),(35.15,129.05));self.assertEqual(c.execute('select latitude from event_data').fetchone(),(None,));c.close()
  self.assertEqual((self.target/'user.txt').read_bytes(),b'user data');self.assertEqual((self.target/'world_leaders.db').read_bytes(),b'leader-bytes-do-not-replace');self.assertTrue((self.target/'.git/config').exists());self.assertTrue((self.target/'empty').is_dir())
  backups=[p for p in (self.root/'SameTimeWorld_Backups').iterdir() if p.is_dir()];self.assertEqual(len(backups),1);saved=backups[0]
  for name,digest in before.items():self.assertEqual(hashlib.sha256((saved/name).read_bytes()).hexdigest(),digest)
 def test_changed_master_aborts_without_touching_existing_files(self):
  c=sqlite3.connect(self.target/'sametimeworld.db');c.execute("update event_data set description='local edit'");c.commit();c.close();before=self.inventory()
  self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual(before,self.inventory());self.assertFalse((self.target/'index.html').exists())
 def test_requires_existing_master_not_fake_replacement(self):
  (self.target/'sametimeworld.db').unlink();(self.target/'.stw-install.json').write_text('{}');before=self.inventory();self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual(before,self.inventory())
 def test_reapplying_migration_is_idempotent_and_keeps_both_backups(self):
  self.assertEqual(self.runexe('/install',self.target),0);self.assertEqual(self.runexe('/install',self.target),0);c=sqlite3.connect(self.target/'sametimeworld.db');self.assertEqual(c.execute('select count(*) from event_location_v2').fetchone()[0],1);c.close();self.assertEqual(len([p for p in (self.root/'SameTimeWorld_Backups').iterdir() if p.is_dir()]),2)
if __name__=='__main__':unittest.main(verbosity=2)
