"""Browser smoke tests for either a local build or the public deployment."""
from __future__ import annotations
import argparse,functools,http.server,json,pathlib,threading,urllib.parse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--output',default='_local/browser-checks');parser.add_argument('--executable');parser.add_argument('--expected-hash');parser.add_argument('--expected-events',type=int);parser.add_argument('--expected-leaders',type=int);parser.add_argument('--expected-localities',type=int)
args=parser.parse_args();root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
server=None
if args.url:url=args.url
else:
 class Handler(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
  def translate_path(self,request):
   request=urllib.parse.urlsplit(request).path
   if request.startswith('/sametimeworld/'):request=request[len('/sametimeworld'):]
   return super().translate_path(request)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root/'dist')))
 threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/sametimeworld/'
report={'url':url,'checks':[]}
try:
 with sync_playwright() as p:
  options={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader']}
  if args.executable:options['executable_path']=args.executable
  browser=p.chromium.launch(**options);context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[];requests=[]
  page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda req:requests.append(req.url))
  page.goto(url,wait_until='networkidle',timeout=60000);page.wait_for_function("document.querySelectorAll('.event').length>0",timeout=30000)
  inventory=page.evaluate("""async()=>{
   const release=await(await fetch(new URL('release.json',document.baseURI))).json();
   const file=release.files.find(x=>/^assets\\/packets-/.test(x.path));
   const api=await import(new URL(file.path,document.baseURI));const data=await api.loadArchive();
   return {version:release.page_version,dataVersion:data.meta.events_db_version,events:data.events.length,leaders:data.leaders.length,localities:data.events.filter(x=>x.locality).length,hash:data.meta.content_hash};
  }""")
  assert inventory['events']>0 and inventory['leaders']>0,inventory
  for key,expected in [('events',args.expected_events),('leaders',args.expected_leaders),('localities',args.expected_localities),('hash',args.expected_hash)]:
   if expected is not None:assert inventory[key]==expected,inventory
  report['inventory']=inventory;report['checks'].append('all records and localities decoded in real browser')
  assert len([u for u in requests if urllib.parse.urlsplit(u).path.endswith('.bin')])==1,requests
  assert all(urllib.parse.urlsplit(u).netloc==urllib.parse.urlsplit(url).netloc for u in requests),requests
  report['checks'].append('one package request; zero cross-origin requests')
  before=page.locator('#level').inner_text();page.locator('#in').click();page.wait_for_timeout(1000);assert page.locator('#level').inner_text()!=before
  page.locator('#out').click();page.wait_for_timeout(1000);report['checks'].append('zoom controls work')
  page.locator('#searchInput').fill('아편전쟁');page.wait_for_timeout(400);assert page.locator('.search-suggestion').count()>0
  page.locator('#searchInput').fill('');page.locator('#searchInput').blur();page.keyboard.press('Escape');report['checks'].append('search suggestions work')
  page.locator('.event').first.click();page.wait_for_timeout(500);assert 'active' in page.locator('#webPanel').get_attribute('class');assert page.locator('#webEventMeta').inner_text().strip()
  page.locator('#backToTimeline').click();page.wait_for_timeout(300);assert 'active' in page.locator('#experiencePanel').get_attribute('class');report['checks'].append('detail and return-to-timeline work')
  page.screenshot(path=str(out/'desktop.png'),full_page=True);page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(700);assert page.locator('.mobile-region-btn').count()==4
  page.screenshot(path=str(out/'mobile.png'),full_page=True);report['checks'].append('mobile regional navigation renders');assert not errors,errors;report['checks'].append('no uncaught page errors')
  if not args.url:
   broken=context.new_page();broken.route('**/*.bin',lambda route:route.fulfill(status=503,body='Unavailable'));broken.goto(url,wait_until='networkidle');broken.wait_for_function("document.querySelector('#status').textContent.includes('실패')");assert broken.locator('.event').count()==0;report['checks'].append('network failure is explicit with no silent legacy fallback')
  browser.close()
 report['success']=True
finally:
 if server:server.shutdown()
 (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
