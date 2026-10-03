"""Browser regression for real selection, history, key priority and persistence."""
import functools,http.server,json,pathlib,threading,sys
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];out=root/'_local/series-checks';out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
report=[]
with sync_playwright() as p:
 opts={'headless':True}
 if pathlib.Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium';opts['args']=['--no-sandbox']
 browser=p.chromium.launch(**opts)
 for name,viewport in [('desktop',{'width':1440,'height':950}),('mobile',{'width':393,'height':852})]:
  context=browser.new_context(viewport=viewport,is_mobile=name=='mobile',has_touch=name=='mobile');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url,wait_until='networkidle');page.wait_for_function("document.querySelector('#status').textContent.includes('38,920')",timeout=90000)
  assert not page.locator('#seriesBar').is_visible();page.locator('#seriesOpen').click();page.locator('.series-choice-main').first.wait_for();assert page.locator('.series-choice-main').count()==10
  page.screenshot(path=str(out/(name+'-series.png')),full_page=True)
  page.locator('.series-choice-main').filter(has_text='산업과 기술').click();page.locator('#seriesBar').wait_for();page.wait_for_timeout(200)
  assert page.locator('#seriesBar').inner_text().find('622')>=0
  visible=page.locator('.event').all();assert len(visible)>0;assert all('series-match' in c.get_attribute('class') for c in visible)
  page.screenshot(path=str(out/(name+'-timeline.png')),full_page=True)
  focused=page.locator('.event:visible').first;focused.scroll_into_view_if_needed();eventid=focused.get_attribute('data-id');before=page.locator('#viewport').evaluate('(e)=>e.scrollTop');focused.click();page.wait_for_function("document.body.classList.contains('event-detail-active')")
  assert page.locator('#seriesDetailNav').is_visible();title=page.locator('#webQuery').inner_text()
  page.locator('#detailDisplaySettings').click();page.keyboard.press('Escape');page.wait_for_timeout(100);assert page.locator('#webPanel').is_visible();assert not page.locator('#displaySettingsOverlay').evaluate("e=>e.classList.contains('open')")
  page.locator('#seriesOpen').click();page.wait_for_function("document.querySelector('#seriesDialog').open");page.keyboard.press('Escape');assert page.locator('#webPanel').is_visible()
  page.locator('#detailSeriesChoices button').filter(has_text='산업과 기술').click();page.locator('#detailSeriesActions [data-action=next]').click();page.wait_for_timeout(100);assert page.locator('#webQuery').inner_text()!=title
  page.keyboard.press('Escape');page.wait_for_function("!document.body.classList.contains('event-detail-active')");assert abs(page.locator('#viewport').evaluate('(e)=>e.scrollTop')-before)<3
  assert page.locator('#seriesBar').is_visible();page.locator('.series-context').click();page.wait_for_timeout(150);assert '세계 함께 보기' in page.locator('.series-context').inner_text()
  page.reload(wait_until='networkidle');page.locator('#seriesBar').wait_for(timeout=90000);assert '산업과 기술' in page.locator('#seriesBar').inner_text()
  page.locator('#seriesOpen').click();page.locator('#seriesSearch').fill('천문학');page.wait_for_timeout(300);assert page.locator('.concept-choice').count()>0;page.locator('.concept-choice input').first.check();page.locator('#seriesName').fill('나의 천문 시리즈');page.locator('#seriesSave').click();assert '나의 천문 시리즈' in page.locator('#seriesBar').inner_text();page.locator('.series-clear').click();page.wait_for_timeout(100);assert not page.locator('#seriesBar').is_visible();assert page.locator('#status').inner_text().startswith('38,920')
  assert page.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth+1');assert not errors,errors
  report.append({'viewport':name,'success':True,'checks':['10-starter-series','real-622-members','matching-cards','detail-sequence','modal-Escape-priority','single-Escape-return','scroll-preserved','world-context','restore-selection','custom-series','clear','no-overflow','no-runtime-errors']});context.close()
 browser.close()
server.shutdown();(out/'report.json').write_text(json.dumps({'success':True,'results':report},ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
