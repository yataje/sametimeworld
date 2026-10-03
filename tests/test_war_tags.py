import importlib.util,pathlib,unittest
class WarTagsTests(unittest.TestCase):
 def tags(self,year,title,description='',country='',category='역사'):
  p=pathlib.Path(__file__).resolve().parents[1]/'scripts/enrich-war-tags.py'
  self.assertTrue(p.exists(),'War classification is missing')
  spec=importlib.util.spec_from_file_location('war_tags',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  return set(m.classify({'event_id':1,'year':year,'title':title,'description':description,'country':country,'category':category}))
 def test_el_alamein_has_world_war_and_north_africa(self):
  self.assertEqual(self.tags(1942,'제1차 엘 알라메인 전투, 추축군 진격 저지',country='이집트'),{'제2차 세계대전','북아프리카 전역'})
 def test_eastern_front_has_parent_and_theatre(self):
  self.assertEqual(self.tags(1941,'추축국 바르바로사 작전 발동 소련 침공'),{'제2차 세계대전','독소전쟁'})
 def test_pacific_front_has_parent(self):
  self.assertEqual(self.tags(1942,'미드웨이 해전',country='미국'),{'제2차 세계대전','태평양전쟁'})
 def test_civil_war_battle_without_war_name(self):
  self.assertIn('미국 남북전쟁',self.tags(1863,'게티즈버그 전투 시작',country='미국'))
 def test_imjin_subwar_keeps_parent(self):
  self.assertEqual(self.tags(1597,'정유재란 발발',country='조선'),{'임진왜란','정유재란'})
 def test_unrelated_birth_is_not_tagged(self):
  self.assertEqual(self.tags(1942,'배우 출생','훗날 제2차 세계대전 이후 유명해졌다.',category='인물'),set())
 def test_unrelated_civilian_city_is_not_a_battle(self):
  self.assertEqual(self.tags(1942,'레닌그라드에서 시집 출판',country='소련'),set())
 def test_latin_american_pacific_war_is_distinguished(self):
  tags=self.tags(1879,'태평양전쟁 발발',country='칠레·페루·볼리비아')
  self.assertEqual(tags,{'남미 태평양전쟁'})
 def test_other_war_during_world_war_is_not_forced(self):
  self.assertEqual(self.tags(1941,'페루군 에콰도르 침공',country='페루·에콰도르'),{'에콰도르-페루 전쟁'})
 def test_prewar_civilian_shipbuilding_not_forced(self):
  self.assertEqual(self.tags(1860,'남북전쟁 전까지 조선업 호황과 대외무역 연결',country='미국'),set())
 def test_same_name_later_city_not_historical_battle(self):
  self.assertEqual(self.tags(1900,'솔페리노 시청 개청',country='이탈리아'),set())
 def test_wwi_theatre(self):
  self.assertEqual(self.tags(1915,'갈리폴리 전투 시작',country='오스만 제국'),{'제1차 세계대전'})
 def test_soviet_invasion_of_iran_is_not_eastern_front(self):
  self.assertNotIn('독소전쟁',self.tags(1941,'이란제국 영국과 소련이 침공',country='이란'))
 def test_soviet_declaration_on_japan_is_not_eastern_front(self):
  self.assertNotIn('독소전쟁',self.tags(1945,'소련, 일본에 선전포고',country='소련'))
 def test_malacca_siege_is_not_habsburg_war(self):
  self.assertNotIn('오스만-합스부르크 전쟁',self.tags(1551,'조호르·자와 연합세력의 말라카 포위 시작','과거 오스만·기사단의 싸움과는 다른 사건',country='조호르·자와·포르투갈'))
if __name__=='__main__':unittest.main()
