#!/usr/bin/env python3
"""Build a compact reference from the public GeoNames dump. No private event data is sent out.
The downloaded data is a modern gazetteer, not a historical-boundary reconstruction.
"""
import argparse,collections,datetime,hashlib,io,json,pathlib,re,unicodedata,urllib.request,zipfile
BASE='https://download.geonames.org/export/dump/'
def norm(s):return unicodedata.normalize('NFKC',s).lower().strip()
def download(name,root):
 p=root/name
 if not p.exists():
  print('Downloading public gazetteer:',name,flush=True)
  req=urllib.request.Request(BASE+name,headers={'User-Agent':'SameTimeWorld geographic data preparation; https://github.com/yataje/sametimeworld'})
  with urllib.request.urlopen(req,timeout=180) as src,p.with_suffix('.part').open('wb') as dst:
   while True:
    b=src.read(1024*1024)
    if not b:break
    dst.write(b)
  p.with_suffix('.part').replace(p)
 return p

def main():
 a=argparse.ArgumentParser();a.add_argument('events');a.add_argument('--cache',default='_local/geonames');a.add_argument('--output',default='src/location-extra.js');args=a.parse_args()
 root=pathlib.Path(args.cache);root.mkdir(parents=True,exist_ok=True)
 events=json.loads(pathlib.Path(args.events).read_text(encoding='utf8'))['events'];wanted=set()
 for e in events:
  for key in ['place','locality','country','title','description']:
   value=norm(str(e.get(key) or ''));value=re.sub(r'https?://\S+',' ',value)
   for token in re.findall(r'[가-힣]{2,40}',value):
    for i in range(2,len(token)+1):wanted.add(token[:i])
   if key in ['place','locality','country','title']:
    words=re.findall(r'[a-zA-ZÀ-ž][a-zA-ZÀ-ž\-]+',value)
    for i in range(len(words)):
     for n in range(1,5):wanted.add(' '.join(words[i:i+n]))
 for n in ['강화군','서천군','부산','함경남도','가고시마','Kagoshima','Ganghwa-gun','Seocheon-gun']:wanted.add(norm(n))
 info=download('countryInfo.txt',root);mapping={}
 for line in info.read_text(encoding='utf8').splitlines():
  if line.startswith('#'):continue
  x=line.split('\t')
  if len(x)>4:mapping[x[0]]=x[1]
 # A single bulk download is used instead of per-event geocoding requests.
 zpath=download('allCountries.zip',root);records=[];scanned=0
 with zipfile.ZipFile(zpath) as z,z.open('allCountries.txt') as raw:
  for line in io.TextIOWrapper(raw,encoding='utf8'):
   scanned+=1;x=line.rstrip('\n').split('\t')
   if len(x)<19 or not (x[6]=='P' or x[7] in ['ADM1','ADM2','ADM3','ADM4']):continue
   names=list(dict.fromkeys([x[1],x[2]]+x[3].split(',')));matches=[n for n in names if norm(n) in wanted]
   if not matches:continue
   names=list(dict.fromkeys(matches+[x[1]]+[n for n in names if re.search('[가-힣]',n)]))
   precision='admin'+x[7][-1] if x[7].startswith('ADM') else 'city'
   records.append({'id':'geonames:'+x[0],'n':names,'c':mapping.get(x[8],x[8]),'x':float(x[5]),'y':float(x[4]),'precision':precision,'a':x[10],'a2':x[11],'feature':x[7],'source':'https://www.geonames.org/'+x[0]+'/'})
 records.sort(key=lambda r:r['id'])
 meta={'source':BASE+'allCountries.zip','license':'CC BY 4.0','attribution':'GeoNames https://www.geonames.org/','retrieved':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(zpath.read_bytes()).hexdigest(),'scanned':scanned,'records':records}
 pathlib.Path(args.output).write_text('// GeoNames CC BY 4.0. Modern representative places, not verified historical sites.\nexport default '+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
 report={k:v for k,v in meta.items() if k!='records'};report['retained']=len(records);report['precision_counts']=dict(collections.Counter(r['precision'] for r in records));report['bytes']=pathlib.Path(args.output).stat().st_size
 pathlib.Path('docs/location').mkdir(parents=True,exist_ok=True);pathlib.Path('docs/location/gazetteer.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
