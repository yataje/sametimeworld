import importlib.util,pathlib,unittest

class EntitySeriesTests(unittest.TestCase):
 def members(self,**row):
  path=pathlib.Path(__file__).resolve().parents[1]/'scripts/add-entity-series.py'
  spec=importlib.util.spec_from_file_location('entity_series',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  return set(m.identify(row))
 def test_subject_lifecycle_membership(self):
  self.assertEqual(self.members(subject='엔터프라이즈 CV-6',year=1933,title='항공모함 건조 승인'),{'enterprise-cv6'})
  self.assertEqual(self.members(subject='이지중대',year=1942,title='기본훈련'),{'easy-company'})
  self.assertEqual(self.members(subject='해병대 제1사단',year=1950,title='상륙'),{'us-1st-marine-division'})
 def test_explicit_identity_in_body(self):
  self.assertEqual(self.members(title='해전',description='USS Enterprise (CV-6)가 출격했다.'),{'enterprise-cv6'})
  self.assertEqual(self.members(title='훈련',description='미 제101공수사단 제506연대 이지 중대 훈련'),{'easy-company'})
  self.assertEqual(self.members(title='상륙',description='미 해병대 제1사단이 상륙했다.'),{'us-1st-marine-division'})
 def test_namesakes_are_excluded(self):
  self.assertEqual(self.members(title='엔터프라이즈 CVN-65 취역',year=1961),set())
  self.assertEqual(self.members(title='우주왕복선 엔터프라이즈 시험',year=1977),set())
  self.assertEqual(self.members(title='대한민국 해병대 제1사단 훈련',year=1960),set())
  self.assertEqual(self.members(title='이지 중대 훈련',year=1900),set())
 def test_source_filename_does_not_create_membership(self):
  self.assertEqual(self.members(description='출처 파일: 엔터프라이즈 CV-6.txt'),set())

if __name__=='__main__':unittest.main()
