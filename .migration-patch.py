from pathlib import Path
import re,json
r=Path('.')
p=r/'src/main.js';s=p.read_text()
assert "const PAGE_VERSION='v0.4.7';" in s
s=s.replace("import './style.css';","import './style.css';\nimport {fetchDataset} from './packets.js';")
s=s.replace("const PAGE_VERSION='v0.4.7';","const PAGE_VERSION='v0.5.0';").replace("const DB_VERSION_FALLBACK='v15';","const DB_VERSION_FALLBACK='v16';")
s=re.sub(r"const FIREBASE_DB_ROOT=[\s\S]*?(?=function normalizeFirebaseRegion)",'',s)
s=s.replace('normalizeFirebaseRegion','normalizeRegion').replace('normalizeFirebaseEvents','normalizeEvents').replace('fetchFirebaseJSON','fetchDataset')
s=s.replace("verification:String(x.verification??'')","verification:String(x.verification??''),locality:String(x.locality??'')")
s=s.replace("['국가',x.country],['카테고리',x.category]","['국가',x.country],['지역',x.locality],['카테고리',x.category]")
s=s.replace('independent of Firebase','independent of packaged records').replace('Firebase 사건 DB를 불러오는 중…','자료를 확인하고 있습니다…').replace('Firebase /events가 비어 있습니다.','사건 자료가 비어 있습니다.').replace('Firebase events load failed:','Packaged events load failed:').replace('Firebase DB 로드 실패','자료 로드 실패')
s=s.replace('meta.db_version',"meta['db_version']")
p.write_text(s)
p=r/'src/leaders.js';p.write_text(p.read_text().replace('FIREBASE_','PACKAGED_').replace('loadFirebaseLeaderGroups','loadPackagedLeaderGroups'))
p=r/'tests/leaders.test.cjs';p.write_text(p.read_text().replace('loadFirebaseLeaderGroups','loadPackagedLeaderGroups').replace('Firebase leader data is fetched separately','Packaged leader data is selected'))
p=r/'index.html';s=p.read_text();s=re.sub(r'<meta name="sametimeworld-db-filename"[^>]+>','',s);s=s.replace('v0.4.7','v0.5.0').replace('DB v15','DB v16');p.write_text(s)
for f in ['package.json','package-lock.json']:
 p=r/f;j=json.loads(p.read_text());j['version']='0.5.0'
 if 'packages' in j and '' in j['packages']:j['packages']['']['version']='0.5.0'
 p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
base='@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nwhere py >nul 2>nul\r\nif not errorlevel 1 (\r\n  py -3 "_local\\tools\\manager.py"{arg}\r\n) else (\r\n  python "_local\\tools\\manager.py"{arg}\r\n)\r\nif errorlevel 1 pause\r\n'
for name,arg in [('Manage.cmd',''),('Build_Web.cmd',' --build'),('Publish_GitHub.cmd',' --publish')]:
 (r/name).write_bytes(base.format(arg=arg).encode('ascii'))
(r/'scripts/publish.ps1').write_text("param([switch]$CheckOnly)\n$ErrorActionPreference='Stop'\nSet-Location (Split-Path $PSScriptRoot -Parent)\n$task=if($CheckOnly){'--build'}else{'--publish'}\nif(Get-Command py -ErrorAction SilentlyContinue){ & py -3 '_local/tools/manager.py' $task }else{ & python '_local/tools/manager.py' $task }\nexit $LASTEXITCODE\n")
