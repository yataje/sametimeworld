"""Exercise the actual Windows EXE with isolated temporary folders and byte comparisons."""
import hashlib,io,json,os,pathlib,struct,subprocess,tempfile,unittest,zipfile,ctypes
ROOT=pathlib.Path(__file__).resolve().parent
STUB=ROOT/'build'/'SameTimeWorld_LocalSave.stub.exe'
def package(path, files=None, extra=None):
 files=files or {'sametimeworld.db':b'new-db','index.html':b'new-page','nested/new.txt':'새 파일'.encode()}
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('_stw_manifest.json',json.dumps({'version':'0.7.0','files':[{'path':k,'sha256':hashlib.sha256(v).hexdigest(),'size':len(v)} for k,v in files.items()]}))
  for k,v in files.items():z.writestr(k,v)
  for k,v in (extra or {}).items():z.writestr(k,v)
 b=out.getvalue();path.write_bytes(STUB.read_bytes()+b+struct.pack('<q',len(b))+hashlib.sha256(b).digest()+b'STWPKG01');return path
@unittest.skipUnless(os.name=='nt','Windows executable tests')
class InstallerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='stw-tests-');self.root=pathlib.Path(self.tmp.name);self.target=self.root/'sametimeworld';self.target.mkdir();(self.target/'sametimeworld.db').write_bytes(b'old-db');(self.target/'user.txt').write_bytes(b'keep me');(self.target/'nested').mkdir();(self.target/'nested/old.txt').write_bytes(b'keep nested');self.exe=package(self.root/'save.exe')
 def tearDown(self):
  subprocess.run(['attrib','-R','-H',str(self.root/'*'),'/S','/D'],capture_output=True);self.tmp.cleanup()
 def runexe(self,*args):
  r=subprocess.run([str(self.exe),*map(str,args)],capture_output=True,timeout=60)
  if r.returncode:print('EXE_DIAGNOSTIC',ascii(r.stderr.decode('utf-8',errors='replace')))
  return r.returncode
 def reject_hostile_payload(self,*args):
  # A launch refusal by Windows security is a rejection of the hostile fixture,
  # not evidence that the installer's own branch executed. Benign runs still fail.
  try:return self.runexe(*args)
  except OSError as error:
   if error.winerror!=225:raise
   print('OS_SECURITY_REJECTION: hostile fixture blocked before installer execution')
   return 225
 def backup(self):return [p for p in (self.root/'SameTimeWorld_Backups').glob('sametimeworld-*') if p.is_dir()]
 def test_payload_verifies(self):self.assertEqual(self.runexe('/verify'),0)
 def test_first_install_new_target(self):
  target=self.root/'new-project';self.assertEqual(self.runexe('/install',target),0);self.assertEqual((target/'sametimeworld.db').read_bytes(),b'new-db')
 def test_backup_destination_blocked_aborts_without_overwrite(self):
  (self.root/'SameTimeWorld_Backups').write_text('blocked');self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'old-db')
 def test_hidden_git_and_empty_directories_preserved(self):
  (self.target/'.git').mkdir();(self.target/'.git/config').write_bytes(b'local-config');(self.target/'empty').mkdir();self.assertEqual(self.runexe('/install',self.target),0);b=self.backup()[0];self.assertEqual((b/'.git/config').read_bytes(),b'local-config');self.assertTrue((b/'empty').is_dir());self.assertEqual((self.target/'.git/config').read_bytes(),b'local-config')
 def test_full_backup_and_unmanaged_files_preserved(self):
  self.assertEqual(self.runexe('/install',self.target),0);b=self.backup();self.assertEqual(len(b),1);self.assertEqual((b[0]/'sametimeworld.db').read_bytes(),b'old-db');self.assertEqual((b[0]/'nested/old.txt').read_bytes(),b'keep nested');self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'new-db');self.assertEqual((self.target/'user.txt').read_bytes(),b'keep me');self.assertEqual((self.target/'nested/old.txt').read_bytes(),b'keep nested');self.assertTrue((self.target/'nested/new.txt').exists())
 def test_repeated_install_keeps_two_distinct_backups(self):
  self.assertEqual(self.runexe('/install',self.target),0);self.assertEqual(self.runexe('/install',self.target),0);self.assertEqual(len(self.backup()),2)
 def test_corrupt_payload_never_touches_original(self):
  b=bytearray(self.exe.read_bytes());b[-70]^=1;self.exe.write_bytes(b);self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'old-db');self.assertEqual(self.backup(),[])
 def test_path_traversal_never_writes_outside(self):
  package(self.exe,extra={'../outside.txt':b'bad'});self.assertNotEqual(self.reject_hostile_payload('/install',self.target),0);self.assertFalse((self.root/'outside.txt').exists());self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'old-db')
 def test_active_database_journal_aborts(self):
  (self.target/'sametimeworld.db-wal').write_bytes(b'active');self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'old-db')
 def test_locked_original_aborts(self):
  from ctypes import wintypes
  kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.CreateFileW.restype=ctypes.c_void_p;kernel.CreateFileW.argtypes=[wintypes.LPCWSTR,wintypes.DWORD,wintypes.DWORD,ctypes.c_void_p,wintypes.DWORD,wintypes.DWORD,ctypes.c_void_p];kernel.CloseHandle.argtypes=[ctypes.c_void_p]
  h=kernel.CreateFileW(str(self.target/'sametimeworld.db'),0x80000000,0,None,3,0,None)
  self.assertNotEqual(h,ctypes.c_void_p(-1).value)
  try:self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual(self.backup(),[])
  finally:kernel.CloseHandle(ctypes.c_void_p(h))
 def test_junction_aborts_without_following(self):
  external=self.root/'external';external.mkdir();(external/'secret.txt').write_text('do not touch');subprocess.run(['cmd','/c','mklink','/J',str(self.target/'linked'),str(external)],check=True,capture_output=True)
  try:self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual((external/'secret.txt').read_text(),'do not touch');self.assertEqual(self.backup(),[])
  finally:os.rmdir(self.target/'linked')
 def test_readonly_hidden_original_is_fully_backed_up(self):
  f=self.target/'user.txt';subprocess.run(['attrib','+H','+R',str(f)],check=True);self.assertEqual(self.runexe('/install',self.target),0);self.assertEqual((self.backup()[0]/'user.txt').read_bytes(),b'keep me')
 def test_disk_root_and_unrelated_folder_rejected(self):
  self.assertNotEqual(self.runexe('/install',pathlib.Path(self.target.anchor)),0);other=self.root/'unrelated';other.mkdir();(other/'private.txt').write_text('keep');self.assertNotEqual(self.runexe('/install',other),0);self.assertEqual((other/'private.txt').read_text(),'keep')
 def test_manifest_hash_mismatch_aborts(self):
  package(self.exe,{'sametimeworld.db':b'new'})
  data=self.exe.read_bytes();n=struct.unpack('<q',data[-48:-40])[0];b=io.BytesIO(data[-48-n:-48]);out=io.BytesIO()
  with zipfile.ZipFile(b) as old,zipfile.ZipFile(out,'w') as z:
   for name in old.namelist():z.writestr(name,b'incorrect' if name=='sametimeworld.db' else old.read(name))
  v=out.getvalue();self.exe.write_bytes(STUB.read_bytes()+v+struct.pack('<q',len(v))+hashlib.sha256(v).digest()+b'STWPKG01');self.assertNotEqual(self.runexe('/install',self.target),0);self.assertEqual((self.target/'sametimeworld.db').read_bytes(),b'old-db')
if __name__=='__main__':unittest.main(verbosity=2)
