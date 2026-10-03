import importlib.util, pathlib, unittest
P=pathlib.Path(__file__).resolve().parents[1]/'installer/pack.py'
class PackageTests(unittest.TestCase):
 def api(self):
  self.assertTrue(P.exists(), 'Offline EXE packer is missing')
  spec=importlib.util.spec_from_file_location('localpacker',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_safe_paths_block_traversal_and_private_material(self):
  m=self.api()
  for p in ['../x','/x','x\\y','.git/config','.GIT/config','.env','secrets/key.pem','assets/font.ttf','a:stream','NUL.txt']:
   with self.assertRaises(ValueError,msg=p):m.safe_path(p)
  self.assertEqual(m.safe_path('source-pack/normal.txt'),'source-pack/normal.txt')
 def test_roundtrip_footer_and_file_hashes(self):
  m=self.api();files={'sametimeworld.db':b'db','world_leaders.db':b'leaders','index.html':b'web'}
  blob=m.make_payload(files,'0.7.0');result=m.assemble(b'MZstub',blob)
  self.assertEqual(m.verify_package(result)['files'],3)
  corrupted=bytearray(result);corrupted[-55]^=1
  with self.assertRaises(ValueError):m.verify_package(bytes(corrupted))
 def test_case_insensitive_duplicates_rejected(self):
  m=self.api()
  with self.assertRaises(ValueError):m.make_payload({'A.txt':b'a','a.txt':b'b'},'0.7.0')
if __name__=='__main__':unittest.main()
