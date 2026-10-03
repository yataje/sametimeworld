"""Explicit target series, category placement and real member navigation on desktop/mobile."""
import argparse,functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url');p.add_argument('--executable',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);server=None
if a.url:url=a.url
else:
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=a.executable)
 for width,height in [(1440,950),(393,852)]:
  page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url,wait_until='networkidle');page.wait_for_function("document.querySelector('#status').textContent.includes('38,920')",timeout=90000)
  for name,count,key,category in [('이지중대',46,'easy-company','전쟁·분쟁'),('엔터프라이즈 CV-6',78,'enterprise-cv6','무기·군사장비'),('수에즈 운하',4,'suez-canal','교통·인프라'),('페니실린',3,'penicillin','과학·의학·교육·문화'),('네덜란드 동인도회사(VOC)',3746,'voc','사회·경제·노동')]:
   page.locator('#seriesOpen').click();page.locator('#seriesSearch').fill(name);choice=page.locator('.series-choice-main').filter(has_text=name);choice.wait_for();assert choice.count()==1;assert f'{count:,}건' in choice.inner_text();assert page.locator('.series-category-title').filter(has_text=category).count()==1;choice.click();page.wait_for_timeout(300)
   assert name in page.locator('#seriesBar').inner_text();assert f'{count:,}건' in page.locator('#seriesBar').inner_text()
   card=page.locator('.event:visible').first;card.scroll_into_view_if_needed();card.click();chip=page.locator(f'#detailSeriesChoices button[data-choice-id="entity-{key}"]');chip.wait_for();assert chip.count()==1
   if key=='easy-company':assert page.locator('#detailSeriesChoices button').filter(has_text='이지중대').count()==1
   chip.click();page.locator('[data-action=list]').click();page.locator('.series-event-card').first.wait_for();assert page.locator('.series-event-card').count()<=60
   page.screenshot(path=str(out/f'{width}-{key}.png'),full_page=True)
   page.locator('#seriesEventClose').click();before=page.locator('#webQuery').inner_text();page.locator('[data-action=next]').click();page.wait_for_timeout(200);assert page.locator('#webQuery').inner_text()!=before
   page.locator('#backToTimeline').click();page.locator('.series-clear').click();page.wait_for_timeout(100)
   report.append({'width':width,'series':name,'members':count,'category':category,'detail_and_next_and_list':True})
  assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth')<=width;page.close()
 browser.close()
if server:server.shutdown()
(out/'report.json').write_text(json.dumps({'success':True,'url':url,'results':report},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
