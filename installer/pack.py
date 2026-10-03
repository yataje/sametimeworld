"""Assemble a tested Windows stub and an immutable project snapshot, entirely offline."""
from __future__ import annotations
import argparse, hashlib, io, json, pathlib, re, struct, zipfile
MAGIC=b'STWPKG01'
def sha(data:bytes)->str:return hashlib.sha256(data).hexdigest()
def safe_path(name:str)->str:
 if not name or name.startswith('/') or '\\' in name or ':' in name:raise ValueError('Unsafe package path: '+name)
 for p in name.split('/'):
  if (p in ('','.','..') or p.casefold()=='.git') or p.rstrip(' .')!=p or re.search(r'[<>:"|?*\x00-\x1f]',p) or re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?',p,re.I):raise ValueError('Unsafe package path: '+name)
  if p.lower()=='.env' or p.lower().startswith('.env.'):raise ValueError('Private environment file: '+name)
 if pathlib.PurePosixPath(name).suffix.lower() in {'.ttf','.otf','.woff','.woff2','.pem','.key','.pfx','.p12'}:raise ValueError('Private key or font file is not distributable: '+name)
 return name

def make_payload(files:dict[str,bytes],version:str)->bytes:
 seen=set();rows=[]
 for name,data in sorted(files.items()):
  safe_path(name)
  if name.casefold() in seen or name=='_stw_manifest.json':raise ValueError('Duplicate/reserved package path')
  seen.add(name.casefold());rows.append({'path':name,'sha256':sha(data),'size':len(data)})
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  z.writestr('_stw_manifest.json',json.dumps({'version':version,'files':rows},ensure_ascii=False,separators=(',',':')))
  for name in sorted(files):z.writestr(name,files[name])
 return out.getvalue()
def assemble(stub:bytes,payload:bytes)->bytes:
 if not stub.startswith(b'MZ'):raise ValueError('The Windows stub is not an executable')
 return stub+payload+struct.pack('<q',len(payload))+hashlib.sha256(payload).digest()+MAGIC

def verify_package(exe:bytes)->dict:
 if not exe.startswith(b'MZ') or len(exe)<48 or exe[-8:]!=MAGIC:raise ValueError('Invalid EXE package')
 n=struct.unpack('<q',exe[-48:-40])[0]
 if n<=0 or n>len(exe)-48:raise ValueError('Invalid payload length')
 payload=exe[-48-n:-48]
 if hashlib.sha256(payload).digest()!=exe[-40:-8]:raise ValueError('Payload hash mismatch')
 with zipfile.ZipFile(io.BytesIO(payload)) as z:
  m=json.loads(z.read('_stw_manifest.json'));names=set();rows=m['files']
  for row in rows:
   p=safe_path(row['path'])
   if p.casefold() in names:raise ValueError('Duplicate entry')
   names.add(p.casefold());data=z.read(p)
   if len(data)!=row['size'] or sha(data)!=row['sha256']:raise ValueError('File hash mismatch: '+p)
  if set(z.namelist())!={'_stw_manifest.json',*(r['path'] for r in rows)} or len(z.namelist())!=len(rows)+1:raise ValueError('Unlisted ZIP entries')
 return {'success':True,'version':m['version'],'files':len(rows),'exe_bytes':len(exe),'exe_sha256':sha(exe),'payload_sha256':sha(payload)}

def main()->None:
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source-zip',type=pathlib.Path,required=True);p.add_argument('--dist',type=pathlib.Path,required=True);p.add_argument('--master',type=pathlib.Path,required=True);p.add_argument('--leaders',type=pathlib.Path,required=True);p.add_argument('--stub',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);args=p.parse_args()
 if args.output.exists():raise SystemExit('Output already exists; choose a new filename')
 files={}
 with zipfile.ZipFile(args.source_zip) as z:
  for info in z.infolist():
   if info.is_dir() or info.filename=='.github/workflows/series-check.yml':continue
   if (info.external_attr>>16)&0xF000==0xA000:raise ValueError('Source contains symbolic link')
   name=safe_path(info.filename)
   if name.casefold() in {x.casefold() for x in files}:raise ValueError('Duplicate source entry')
   files[name]=z.read(info)
 for path in args.dist.rglob('*'):
  if path.is_symlink():raise ValueError('Build contains symbolic link')
  if path.is_file():files['dist/'+path.relative_to(args.dist).as_posix()]=path.read_bytes()
 for name,path in [('sametimeworld.db',args.master),('world_leaders.db',args.leaders)]:
  b=path.read_bytes()
  if b[:16]!=b'SQLite format 3\0':raise ValueError('Not SQLite: '+name)
  if name in files:raise ValueError('Source archive must not already include a master DB')
  files[name]=b
 version=json.loads(files['package.json'])['version'];files['LOCAL_SAVE_README.txt']=files['installer/README_KO.md']
 payload=make_payload(files,version);exe=assemble(args.stub.read_bytes(),payload);report=verify_package(exe)
 report.update(master_sha256=sha(files['sametimeworld.db']),leaders_db_sha256=sha(files['world_leaders.db']),source_zip_sha256=sha(args.source_zip.read_bytes()),scope='Payload verification on build host; Windows stub backup tests run separately.')
 args.output.parent.mkdir(parents=True,exist_ok=True);temp=args.output.with_suffix('.part');temp.write_bytes(exe);temp.replace(args.output)
 args.output.with_suffix('.verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
