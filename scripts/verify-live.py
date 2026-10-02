#!/usr/bin/env python3
"""Verify the deployed release and all declared public files, without inspecting private data."""
import argparse,concurrent.futures,hashlib,json,pathlib,time,urllib.request,urllib.parse

def check_manifest(actual,expected):
 for key in ['page_version','data_version','data_hash','counts','files']:
  if actual.get(key)!=expected.get(key):raise ValueError('Deployment mismatch: '+key)

def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--expected-release',type=pathlib.Path,required=True);p.add_argument('--output',default='live-verification.json');a=p.parse_args()
 base=a.url.rstrip('/')+'/';expected=json.loads(a.expected_release.read_text());last=None
 def read(name):
  u=urllib.parse.urljoin(base,name)
  if not u.startswith(base):raise ValueError('Unexpected public asset path')
  return urllib.request.urlopen(urllib.request.Request(u,headers={'Cache-Control':'no-cache','User-Agent':'SameTimeWorld-release-verification'}),timeout=30).read()
 for attempt in range(18):
  try:
   actual=json.loads(read('release.json?check='+str(time.time_ns())));check_manifest(actual,expected);break
  except Exception as e:last=e;time.sleep(5)
 else:raise RuntimeError(f'Live release did not match: {last}')
 def verify(f):
  for attempt in range(3):
   try:
    b=read(f['path']);assert len(b)==f['size'] and hashlib.sha256(b).hexdigest()==f['sha256'],f['path'];return f['path']
   except Exception:
    if attempt==2:raise
    time.sleep(2)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:checked=list(pool.map(verify,actual['files']))
 report={'success':True,'url':base,'page_version':actual['page_version'],'data_version':actual['data_version'],'counts':actual['counts'],'data_hash':actual['data_hash'],'verified_public_files':len(checked)}
 pathlib.Path(a.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
