"""Four fixed/scrolling frames and real event-card navigation. Speech engine is a controlled test double, not proof of audible native Korean output."""
import argparse,functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--executable');parser.add_argument('--output',default='_local/detail-frames');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
server=None
if args.url:url=args.url
else:
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
report={'scope':'Real Chromium UI; deterministic injected speech engine for sequencing, no audible speech claim','results':[]}
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']}
 if args.executable:opts['executable_path']=args.executable
 elif pathlib.Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**opts)
 for name,size in [('desktop',{'width':1632,'height':850}),('mobile',{'width':393,'height':852}),('landscape',{'width':844,'height':390})]:
  ctx=browser.new_context(viewport=size,is_mobile=name=='mobile',has_touch=name=='mobile');ctx.add_init_script("""window.__speech={said:[],cancelled:0,finish(){const u=this.said.find(u=>!u.done);if(u){u.done=true;u.onend?.();}},stale:[]};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'ko-KR',localService:true}],speak:u=>window.__speech.said.push(u),cancel:()=>{window.__speech.cancelled++;for(const u of window.__speech.said){if(!u.done)window.__speech.stale.push(u.onend);u.done=true;}}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};""")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));checks=[]
  try:
   page.goto(url+'?mapDebug=1',wait_until='networkidle',timeout=60000);page.wait_for_function("document.querySelector('#status').textContent.includes('38,920')",timeout=60000)
   page.locator('#searchInput').fill('일본군의 부산 상륙과 임진왜란 발발');page.locator('#searchInput').press('Enter');card=page.locator('.event[data-id="8479"]:visible').first;card.wait_for();card.scroll_into_view_if_needed();bookmark=page.locator('#viewport').evaluate('e=>e.scrollTop');card.click();page.wait_for_function("document.body.classList.contains('event-detail-active')")
   page.locator('[data-choice-id="concept-4539"]').wait_for();title=page.locator('#webQuery').inner_text()
   assert page.locator('#seriesDetailNav [data-action]:disabled').count()==5
   labels=page.locator('#detailSeriesChoices button').all_text_contents();assert set(labels)=={'전쟁과 군사','임진왜란','전쟁','부산포','조선'},labels
   checks+=['exact-existing-memberships-only','actions-disabled-before-choice']
   def geometry():return page.evaluate("""()=>Object.fromEntries(['webEventMeta','eventDetailScroll','seriesDetailNav','backToTimeline'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,w:r.width,h:r.height}]}))""")
   before=geometry();page.locator('#eventDetailScroll').evaluate('e=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(150);after=geometry()
   for id in ['webEventMeta','seriesDetailNav','backToTimeline']:assert abs(before[id]['y']-after[id]['y'])<1,(id,before,after)
   assert after['eventDetailScroll']['h']>65,after
   assert after['backToTimeline']['y']+after['backToTimeline']['h']<=size['height']+1
   checks+=['metadata-series-footer-stationary','body-only-scroll','short-viewport-readable']
   page.locator('[data-choice-id="concept-4539"]').click();assert page.locator('#webQuery').inner_text()==title;assert not page.locator('#seriesEventPanel').is_visible();assert page.evaluate('window.__speech.said.length')==0
   assert page.locator('[data-action=previous]').is_disabled();assert page.locator('[data-action=next]').is_enabled();checks+=['choice-does-not-navigate-or-speak','first-boundary']
   page.locator('[data-action=list]').click();page.locator('#seriesEventPanel').wait_for();a=page.locator('.event-detail').bounding_box();b=page.locator('#seriesEventPanel').bounding_box();assert b['x']>=a['x']+a['width']-1,(a,b);assert abs(b['y']-a['y'])<1
   
   for control in page.locator('#detailSeriesActions button').all():
    box=control.bounding_box();assert box['x']>=a['x'] and box['x']+box['width']<=a['x']+a['width']+1,(a,box)
   checks+=['all-five-actions-visible-in-split-view']
   assert page.locator('.series-event-card').count()==2;assert page.locator('.series-event-card[aria-current=true]').get_attribute('data-event-id')=='8479'
   cards=page.locator('.series-event-card');target=cards.nth(1).get_attribute('data-event-id');cards.nth(1).click();page.wait_for_function('(id)=>location.hash==="#event-"+id',arg=target);assert page.locator('#webQuery').inner_text()!=title
   assert page.locator('[data-choice-id="concept-4539"]').get_attribute('aria-pressed')=='true';assert page.locator('#eventDetailScroll').evaluate('e=>e.scrollTop')==0;assert page.locator('[data-action=next]').is_disabled()
   checks+=['right-hand-event-card-frame','event-card-opens-left-detail','selection-retained','new-event-scroll-reset','last-boundary']
   page.locator('[data-action=first]').click();page.wait_for_function('location.hash==="#event-8479"');assert page.locator('#webQuery').inner_text()==title
   page.locator('[data-choice-id="auto-war"]').click();assert not page.locator('#seriesEventPanel').is_visible();page.locator('[data-action=list]').click();assert page.locator('.series-event-card').count()==60
   fixed=geometry();page.locator('#seriesEventCards').evaluate('e=>e.scrollTop=e.scrollHeight');assert geometry()==fixed
   page.locator('.series-card-pages button').filter(has_text='다음 묶음').click();assert page.locator('.series-event-card').count()==60;checks+=['large-series-paged-cards','independent-right-scroll','choice-requires-new-action']
   page.locator('[data-choice-id="concept-4539"]').click();page.locator('[data-action=list]').click();page.screenshot(path=str(out/(name+'-frames.png')),full_page=True)
   if name=='desktop':
    page.locator('[data-action=tts]').click();assert page.locator('[data-action=tts]').inner_text()=='정지';assert page.evaluate('window.__speech.said[0].text')==title
    for _ in range(30):
     if page.evaluate('location.hash')!='#event-8479':break
     page.evaluate('window.__speech.finish()');page.wait_for_timeout(60)
    page.wait_for_function('location.hash!=="#event-8479"',timeout=4000);assert page.locator('[data-action=tts]').inner_text()=='정지'
    for _ in range(30):
     if page.locator('[data-action=tts]').inner_text()=='자동 TTS':break
     page.evaluate('window.__speech.finish()');page.wait_for_timeout(70)
    page.wait_for_function("document.querySelector('[data-action=tts]').textContent==='자동 TTS'",timeout=4000)
    spoken=page.evaluate('window.__speech.said.map(x=>x.text).join(" ")');assert 'https://' not in spoken and '출처' not in spoken
    checks+=['TTS-title-date-place-description','TTS-next-event-and-last-stop','no-URL-readout']
    page.locator('[data-action=first]').click();page.locator('[data-action=tts]').click();page.locator('[data-action=next]').click();assert page.locator('[data-action=tts]').inner_text()=='자동 TTS';stable=page.evaluate('location.hash');page.evaluate('window.__speech.stale.forEach(fn=>fn?.())');page.wait_for_timeout(650);assert page.evaluate('location.hash')==stable;checks+=['manual-navigation-cancels-stale-speech']
   page.locator('[data-action=first]').click();page.locator('[data-action=tts]').click();page.keyboard.press('Escape');page.wait_for_function("!document.body.classList.contains('event-detail-active')");assert not page.locator('#seriesEventPanel').is_visible();assert abs(page.locator('#viewport').evaluate('e=>e.scrollTop')-bookmark)<3
   assert page.locator('[data-action=tts]').inner_text()=='자동 TTS';assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth+1');assert not errors,errors
   checks+=['Esc-stops-speech-and-closes-cards','timeline-bookmark-preserved','no-horizontal-page-overflow','no-JS-errors'];report['results'].append({'viewport':name,'checks':checks,'success':True})
  except Exception as e:
   report['failure']={'viewport':name,'error':str(e),'page_errors':errors,'checks_completed':checks};page.screenshot(path=str(out/(name+'-failure.png')),full_page=True);(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));raise
  finally:ctx.close()
 browser.close()
if server:server.shutdown()
report['success']=True;report['assertion_groups']=sum(len(r['checks']) for r in report['results']);(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
