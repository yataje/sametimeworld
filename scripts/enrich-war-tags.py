#!/usr/bin/env python3
"""Evidence-based additive war tags. Preview first; preserve existing IDs and links."""
from __future__ import annotations
import argparse,base64,gzip,hashlib,json,pathlib,re,sqlite3
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'scripts/war-tag-rules.json').read_text(encoding='utf-8'));RULES=CONFIG['rules']
def norm(s):return re.sub(r'[\s·ㆍ・\-–—,，]','',str(s or '')).lower()
ALIASES={r['name']:[norm(a) for a in r['aliases']] for r in RULES}
BATTLES={
 '미국 남북전쟁':'불런|불 런|도넬슨|샤일로|앤티텀|프레더릭스버그|챈슬러스빌|게티즈버그|빅스버그|치카모가|채터누가|애틀랜타|피터스버그|애퍼매톡스|북버지니아군|남부군|북군|셔먼|노예해방.*선언',
 '크림전쟁':'시노프|시노페|알마|발라클라바|잉커먼|세바스토폴|크림반도',
 '러일전쟁':'뤼순|여순|제물포|봉천|쓰시마|포츠머스|황해.*해전',
 '보신전쟁':'도바.*후시미|고료카쿠|아이즈.*(전투|공격)|하코다테.*(해전|전투)',
 '프로이센-오스트리아 전쟁':'쾨니히그래츠|사도바|쿠스토차|리사.*해전|베네치아.*병합',
 '프로이센-프랑스 전쟁':'세당|스당|메츠|메스|라인군|파리.*(포위|항복)',
 '제1차 세계대전':'타넨베르크|갈리폴리|솜.*전투|베르됭|마른.*전투|유틀란트|도거뱅크|파스샹달|카포레토|아미앵|콩피에뉴.*휴전|사모아.*점령|파페에테.*포격|포클랜드.*(해전|격파)|무제한.*잠수함|마크 I|아랍.*반란|아카바.*점령|다마스쿠스.*점령|바스라.*점령|쿠트.*(항복|포위)|팔레스타인.*(전역|공세)',
 '독소전쟁':'바르바로사|태풍작전|청색작전|천왕성작전|바그라티온|스탈린그라드|레닌그라드|쿠르스크|하르키우|하리코프|민스크|스몰렌스크|모스크바|베를린.*전투|독일.*소련|소련.*독일',
 '태평양전쟁':'진주만|미드웨이|과달카날|타라와|트루크|헤일스톤|임팔|이오지마|오키나와|레이테|필리핀해|산호해|다윈.*공습|둘리틀|마셜제도|알류샨|웨이크|마커스섬|솔로몬|산타크루즈|뉴브리튼|뉴기니|글로스터곶|펠렐리우|사이판|콰잘레인|마리아나|울리시|엔터프라이즈|제1해병|제1 해병|도쿄.*공습|히로시마|나가사키|Z작전|사마르.*해전|홍콩.*함락|필리핀.*침공|마닐라.*함락|소련.*일본.*선전포고|툴라기.*점령|일본.*(항복|무장해제)|해병대 제1사단|가미카제|고쿠민',
 '북아프리카 전역':'엘 ?알라메인|토브루크|가잘라|롬멜|아프리카군단|북아프리카|횃불작전|이집트.*침공|튀니지.*(항복|상륙|전투)',
 '나폴레옹 전쟁':'아우스터리츠|예나|아우어슈테트|프리틀란트|아스페른|바그람|보로디노|라이프치히|워털루|트라팔가|틸지트|대륙봉쇄|나폴레옹.*(침공|원정|퇴위)|프랑스.*러시아.*원정',
 '프랑스 혁명전쟁':'발미|제마프|툴롱.*(포위|함락)|플뢰뤼스|리볼리|아르콜레|카스틸리오네|마렝고|호엔린덴|혁명전쟁',
 '30년 전쟁':'백산.*전투|브라이텐펠트|브라이텐펠트|뤼첸|노르틀링겐|얀카우|로크루아|베스트팔렌|발렌슈타인|구스타브.*아돌프.*(상륙|전사)|프라하.*창문.*투척',
 '임진왜란':'부산진|동래성|옥포.*해전|당포.*해전|한산.*해전|명량.*해전|노량.*해전|행주.*(대첩|전투)|진주.*(성|전투)|벽제관|조선.*일본군|일본군.*조선|이순신.*(해전|전사)|왜군.*(침입|철수)',
 '정유재란':'칠천량|명량|노량|남원.*(함락|전투)|울산.*(포위|전투)',
 '병자호란':'남한산성.*(항복|포위)|삼전도.*항복|청군.*(침공|침입)|홍타이지.*조선',
 '정묘호란':'후금.*(침공|침입)|아민.*조선',
 '영란전쟁':'로스토프트|4일.*해전|메드웨이|솔베이|스헤베닝언|포츠머스.*강화|브레다.*조약',
 '잉글랜드 내전':'에지힐|마스턴.*무어|네이즈비|우스터.*전투|찰스 ?1세.*처형|크롬웰.*(전투|군대)',
 '리보니아 전쟁':'나르바.*(점령|공격)|도르파트.*(점령|함락)|폴로츠크.*(점령|함락)|프스코프.*포위|얌자폴스키|플류사.*휴전',
 '7년 전쟁':'로스바흐|로이텐|쿤너스도르프|민덴.*전투|퀘벡.*전투|플라시.*전투|베를린.*점령|후베르투스부르크',
 '프렌치 인디언 전쟁':'포트.*듀케인|듀케인.*요새|브래독.*패배|에이브러햄.*평원|퀘벡.*전투',
 '이탈리아 전쟁':'메스.*포위|테루안.*함락|에댕.*함락|생캉탱.*전투|그라블린|카토.*캉브레지|시에나.*(항복|포위)|마르차노|코르시카.*침공',
 '오스만-합스부르크 전쟁':'에게르.*포위|시게트바르.*(포위|함락)|테메슈바르.*함락|빈.*(포위|공방)|케레스테스|메조케레슈테시|모노슈터|센트고트하르트',
 '대튀르크 전쟁':'빈.*포위|카를로비츠|젠타.*전투|베오그라드.*(탈환|함락)',
 '칸디아 전쟁':'칸디아.*(포위|항복)|크레타.*(침공|상륙)|다르다넬스.*해전',
 '아라우코 전쟁':'투카펠|마리우에뉴|라우타로|쿠라우아|쿨랄라바|비오비오.*(전투|협약)',
 '제2차 슐레스비히 전쟁':'뒤펠|디뵐|프로이센.*오스트리아.*덴마크|덴마크.*휴전',
 '제1차 슐레스비히 전쟁':'이스테드.*전투|슐레스비히홀슈타인군',
 '뉴질랜드 전쟁':'테 코히아|와이카토.*침공|테 나이오|타라나키.*전쟁',
 '에콰도르-페루 전쟁':'페루군.*에콰도르|에콰도르.*페루.*(전쟁|침공)',
}
PATTERNS={k:re.compile(v) for k,v in BATTLES.items()}
MILITARY=re.compile('승리|패배|교전|격돌|전투|해전|작전|전역|전쟁|전선|포위|공성|침공|침입|공격|포격|공습|폭격|격침|격파|함락|항복|점령|진격|철수|전사|반격|상륙|참전|선전포고|휴전|강화|병합|군사|해병|훈련|편성|부대|수리|창설|수송|무기|군대|노예해방|의병|동맹|조약|대첩|전시|징용|징병|국민징용|무장해제')
NON_WAR=re.compile('출생|태어|시집.*출판|소설.*출판|시청.*개청|노벨.*수상')
WW2_ACTORS=re.compile('독일[육해공 ]*군|일본[육해공 ]*군|소련군|연합군|연합국|추축|나치|구데리안|롬멜|히틀러|이지중대|엔터프라이즈|광복군|제1 ?해병|해병대 제1사단|일본 함대')
WW2_DIRECT=re.compile('아우슈비츠|홀로코스트|바르샤바.*게토|카틴.*학살|뉘른베르크.*재판|카이로.*회담|테헤란.*회담|얄타.*회담|포츠담.*회담|무기 ?대여|대서양 ?헌장|삼국 ?동맹|맨해튼.*계획|국민징용|학도.*(병|동원)|전시.*(동원|생활)|징병|징용')
WW1_ACTORS=re.compile('독일|오스트리아|오스만|프랑스|영국|불가리아|세르비아|러시아|이탈리아|연합국|동맹국')
PARENTS={r['name']:r.get('parents',[]) for r in RULES}

def classify(row):
 year=row.get('year')
 if year is None:return {}
 year=int(year);title=str(row.get('title') or '');description='\n'.join(s for s in str(row.get('description') or '').splitlines() if not re.match(r'\s*(출처|원문 날짜|검증 상태|등록 상태|날짜 검증)',s))
 text=title+' '+description+' '+str(row.get('subject') or '');compact=norm(text);result={}
 if NON_WAR.search(title):return result
 for context in CONFIG.get('contexts',[]):
  ct=str(row.get('country') or '') if context.get('country_only') else text+' '+str(row.get('country') or '') if context.get('country_allowed') else text
  if context['start']<=year<=context['end'] and MILITARY.search(title) and all(re.search(g,ct) for g in context['groups']):result[context['name']]='opponents_and_operation_context'
 for rule in RULES:
  if rule['start']<=year<=rule['end']:
   for alias in ALIASES[rule['name']]:
    if alias in compact:
     if rule['name']=='태평양전쟁' and re.search('칠레|페루|볼리비아',str(row.get('country'))):continue
     result[rule['name']]='explicit_war:'+alias;break
   if rule['name'] in PATTERNS and MILITARY.search(text) and PATTERNS[rule['name']].search(title if rule['name']=='독소전쟁' else text):result[rule['name']]='battle_or_campaign_context'
 if 1939<=year<=1945 and re.search('타란토|무기.*대여|영국.*프랑스.*독일.*선전포고|이탈리아.*영프.*선전포고|프랑스.*독일.*휴전|소련.*일본.*선전포고|브주라|장블루|노스케이프|바르샤바.*함락|폴란드.*침공|독일.*(덴마크|노르웨이)|이탈리아.*그리스',title):result['제2차 세계대전']='specific_campaign_context'
 if 1937<=year<=1945 and re.search('핑싱관|베이징.*텐진.*전투|루거우차오|난징.*(학살|함락)|타이얼좡',title):result['중일전쟁']='specific_China_campaign'
 if 1950<=year<=1953 and re.search('낙동강|인천.*상륙|장진호|흥남.*철수|서울.*수복',title):result['한국전쟁']='specific_Korean_campaign'
 # French "religious war" and Chinese "civil war" require the actors, not just a phrase.
 if 1562<=year<=1598 and '종교전쟁' in compact and re.search('프랑스|위그노',text+' '+str(row.get('country'))):result['프랑스 종교전쟁']='country_and_war_context'
 if 1927<=year<=1950 and re.search('국민당|공산당|국민군|홍군|마오쩌둥|장제스',text) and MILITARY.search(title) and re.search('중국|만주|국민당|공산당',text+' '+str(row.get('country'))):result['국공내전']='opposing_armies_context'
 if 1937<=year<=1945 and re.search('일본군|일제',text) and re.search('중국|난징|상하이|충칭|이치고',text+' '+str(row.get('country'))) and MILITARY.search(title):result['중일전쟁']='opposing_armies_context'
 if 1939<=year<=1945 and ((WW2_ACTORS.search(text) and MILITARY.search(title)) or WW2_DIRECT.search(title)):result['제2차 세계대전']='war_operation_or_mobilisation_context'
 if 1914<=year<=1918 and WW1_ACTORS.search(title) and re.search('선전포고|항복|독가스.*공격',title):result['제1차 세계대전']='belligerent_action_context'
 if 1936<=year<=1939 and re.search('프랑코|국민군|스페인',text+' '+str(row.get('country'))) and re.search('카탈로니아.*점령|내전|바르셀로나.*점령|게르니카',text):result['스페인 내전']='spanish_civil_war_context'
 if 1945<=year<=1948 and re.search('뉘른베르크.*(재판|판결)|도쿄.*(전범|재판)|전범.*재판',title):result['제2차 세계대전']='explicit_war_crimes_aftermath'
 if 1861<=year<=1865 and re.search('링컨.*암살|미국.*노예제.*폐지|남부.*연방.*탈퇴|남부연합',title):result['미국 남북전쟁']='civil_war_policy_or_aftermath'
 # Pacific and eastern theatres are nested; not all contemporaneous wars were WWII.
 for name in list(result):
  for parent in PARENTS.get(name,[]):result.setdefault(parent,'parent_of:'+name)
 if 1939<=year<=1945 and '중일전쟁' in result:result.setdefault('제2차 세계대전','China_theatre_during_world_war')
 return result

def preview(master):
 with sqlite3.connect(master) as c:
  c.row_factory=sqlite3.Row;rows=[dict(r) for r in c.execute('select * from event_data order by event_id')]
 return rows,[{'event_id':r['event_id'],'date':r['date'],'title':r['title'],'tags':classify(r)} for r in rows if classify(r)]

def main():
 p=argparse.ArgumentParser();p.add_argument('--master',type=pathlib.Path,default=ROOT/'sametimeworld.db');p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
 rows,links=preview(a.master);a.output.write_text(json.dumps({'events_scanned':len(rows),'tagged_events':len(links),'links':links},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'events_scanned':len(rows),'tagged_events':len(links),'tag_links':sum(len(r['tags']) for r in links)}))
if __name__=='__main__':main()
