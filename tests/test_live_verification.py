import importlib.util,pathlib,unittest
class ManifestTests(unittest.TestCase):
 def test_manifest_checks_data_and_assets_not_only_http_status(self):
  p=pathlib.Path(__file__).parents[1]/'scripts/verify-live.py';s=importlib.util.spec_from_file_location('verify_live',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  expected={'page_version':'0.6.0','data_version':'v22','data_hash':'abc','counts':[38920,6338],'files':[{'path':'asset','size':1,'sha256':'def'}]}
  m.check_manifest(dict(expected),expected)
  for key in expected:
   changed=dict(expected);changed[key]=None
   with self.assertRaises(ValueError):m.check_manifest(changed,expected)
if __name__=='__main__':unittest.main()
