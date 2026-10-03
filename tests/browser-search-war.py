"""Real browser checks for responsive input, Korean composition and war memberships."""
import argparse,functools,http.server,json,pathlib,threading,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url');p.add_argument('--executable',required=True);p.add_argument('--output',required=True);p.add_argument('--baseline-root');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
server=None
if a.url:url=a.url
else:
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 directory=pathlib.Path(a.baseline_root)/'dist' if a.baseline_root else root/'dist'
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(directory)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
report={'url':url,'checks':[],'baseline':bool(a.baseline_root)}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=a.executable)
 page=browser.new_page(viewport={'width':1632,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url,wait_until='networkidle');page.wait_for_function("document.querySelector('#status').textContent.includes('38,920')",timeout=90000);page.wait_for_timeout(3000)
 report['input_dispatch_ms']=page.evaluate("""()=>{const input=document.querySelector('#searchInput'),result=[];for(const q of ['전','전쟁','남','남북','남북전쟁']){input.value=q;const start=performance.now();input.dispatchEvent(new Event('input',{bubbles:true}));result.push({query:q,ms:performance.now()-start});}return result;}""")
 if not a.baseline_root:
  assert max(x['ms'] for x in report['input_dispatch_ms'])<50,report
  page.wait_for_timeout(350);assert page.locator('.search-suggestion').count()>0
  report['checks'].append('rapid input handlers stay under 50ms and last keyword produces suggestions')
  page.evaluate("""()=>{const input=document.querySelector('#searchInput');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='제2ㅊ';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));} """)
  before=page.locator('#viewport').evaluate('(e)=>e.scrollTop')
  page.locator('#searchInput').dispatch_event('keydown',{'key':'Enter','isComposing':True})
  page.wait_for_timeout(250);assert page.locator('#searchResults').is_hidden();assert page.locator('#viewport').evaluate('(e)=>e.scrollTop')==before
  page.evaluate("""()=>{const input=document.querySelector('#searchInput');input.value='2차대전';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}));} """)
  page.wait_for_timeout(350);assert page.locator('.search-suggestion').count()==10
  report['checks'].append('Korean composition does not search or navigate; completion searches the war alias')
  page.locator('#searchInput').fill('미드웨이');page.keyboard.press('Escape');page.wait_for_timeout(300);assert page.locator('#searchResults').is_hidden()
  report['checks'].append('Escape cancels queued suggestions')
  def open_title(title,eid):
   page.locator('#searchInput').fill(title);page.locator('#searchInput').press('Enter');page.locator(f'.event[data-id="{eid}"]').first.click();page.locator('#detailSeriesChoices .detail-series-choice').first.wait_for();page.wait_for_timeout(500)
  open_title('제1차 엘 알라메인 전투, 추축군 진격 저지',2276)
  chips=page.locator('#detailSeriesChoices button').all_text_contents();assert '제2차 세계대전' in chips and '북아프리카 전역' in chips,chips
  title=page.locator('#webQuery').inner_text();page.locator('#detailSeriesChoices button').filter(has_text='제2차 세계대전').click();assert page.locator('#webQuery').inner_text()==title
  page.locator('[data-action=list]').click();page.locator('.series-event-card').first.wait_for();assert page.locator('.series-event-card').count()<=60
  page.screenshot(path=str(out/'el-alamein-tags.png'),full_page=True);page.locator('#seriesEventClose').click();page.locator('#backToTimeline').click()
  report['checks'].append('El Alamein has WWII and North Africa; chip selection preserves current card and opens the member list')
  open_title('추축국 바르바로사 작전 발동 소련 침공',2176)
  chips=page.locator('#detailSeriesChoices button').all_text_contents();assert '제2차 세계대전' in chips and '독소전쟁' in chips,chips
  page.locator('#backToTimeline').click()
  open_title('미드웨이 해전의 항모 교전',2272);chips=page.locator('#detailSeriesChoices button').all_text_contents();assert '태평양전쟁' in chips and '제2차 세계대전' in chips;page.locator('#backToTimeline').click()
  open_title('미국 남북전쟁 발발',87);assert '미국 남북전쟁' in page.locator('#detailSeriesChoices button').all_text_contents()
  page.locator('#backToTimeline').click();open_title('《톰과 제리》 첫 단편 상영',2075);assert '제2차 세계대전' not in page.locator('#detailSeriesChoices button').all_text_contents()
  page.screenshot(path=str(out/'unrelated-card.png'),full_page=True)
  report['checks'].append('Eastern front and Civil War have correct tags; unrelated 1940 animation has no WWII tag')
  page.set_viewport_size({'width':393,'height':852});page.locator('#backToTimeline').click();open_title('제1차 엘 알라메인 전투, 추축군 진격 저지',2276)
  assert '제2차 세계대전' in page.locator('#detailSeriesChoices button').all_text_contents();assert page.evaluate('document.documentElement.scrollWidth')<=393
  page.screenshot(path=str(out/'mobile-tags.png'),full_page=True);report['checks'].append('mobile war chips remain readable without horizontal page overflow')
 assert not errors,errors;report['success']=True;browser.close()
if server:server.shutdown()
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
