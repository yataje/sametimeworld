/** Dependency-free, fail-closed production build. Only explicit public assets ship. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash,readDescriptor,unseal,readPacket,packetFiles} from './seal.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f));
const text=f=>read(f).toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const pkg=JSON.parse(read('package.json'));
const descriptor=readDescriptor(root);
if(!descriptor||!/^t\/[a-f0-9]{24}\.txt$/.test(descriptor.f))throw new Error('Validated public package is missing. Run the local manager first.');
const packet=readPacket(root,descriptor),data=unseal(packet,descriptor);
const files=new Map(),built=new Map(),visiting=new Set();
function putAsset(label,ext,content){
 const b=Buffer.isBuffer(content)?content:Buffer.from(content,'utf8');
 const name=`${label}-${hash(b).slice(0,12)}.${ext}`;
 files.set('assets/'+name,b);return name;
}
function buildModule(relative){
 if(built.has(relative))return built.get(relative);
 if(visiting.has(relative))throw new Error('Cyclic module dependency: '+relative);
 if(!relative.startsWith('src/')||!relative.endsWith('.js'))throw new Error('Unexpected runtime import: '+relative);
 visiting.add(relative);
 let code=text(relative);
 const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8',timeout:15000});
 if(check.error||check.status!==0)throw new Error(relative+': invalid syntax\n'+check.stderr);
 code=code.replace("import './style.css';",'');
 code=code.replace(/((?:\bfrom\s*|\bimport\s*)['"])(\.[^'"]+)(['"])/g,(all,before,spec,after)=>{
  const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(relative),spec));
  return before+'./'+buildModule(dependency)+after;
 });
 if(/(?:from\s*|import\s*)['"](?!\.)/.test(code))throw new Error('External import in '+relative);
 const name=putAsset(path.basename(relative,'.js'),'js',code);
 visiting.delete(relative);built.set(relative,name);return name;
}
const seriesConfig=(await import('../src/series-config.js')).default;
if(!/^s\/[a-f0-9]{24}\.txt$/.test(seriesConfig.file))throw new Error('Invalid series path');
const catalogue=read('public/'+seriesConfig.file);if(hash(catalogue)!==seriesConfig.sha256)throw new Error('Series catalogue integrity mismatch');
files.set(seriesConfig.file,catalogue);
const mainName=buildModule('src/main.js');
const mapName=putAsset('world-map','png',read('src/assets/world-map.png'));
const cssName=putAsset('style','css',text('src/style.css').replaceAll('./assets/world-map.png','./'+mapName));
let html=text('index.html');
if(!html.includes('src="/src/main.js"'))throw new Error('Unknown application entry');
html=html.replace('src="/src/main.js"',`src="./assets/${mainName}"`).replace('</head>',`<link rel="stylesheet" href="./assets/${cssName}">\n</head>`);
files.set('index.html',Buffer.from(html));for(const name of packetFiles(descriptor))files.set(name,read('public/'+name));
files.set('.nojekyll',Buffer.alloc(0));files.set('MAP_DATA_NOTICE.txt',read('MAP_DATA_NOTICE.txt'));
for(const [name,bytes] of files){
 if(/\.(?:d[b]|sqlite3?|sql|zip|bak|map)$/i.test(name)||name.includes('_local'))throw new Error('Private artifact in output');
 if(bytes.subarray(0,15).toString()==='SQLite format 3')throw new Error('Raw source data in output');
 if(/\.(html|js|css|txt)$/.test(name)&&/firebasedatabase\.app|firebaseio\.com|[\w()-]+\.d[b]\b|db-filename|<<<<<<< HEAD/.test(bytes.toString('utf8')))throw new Error('Legacy source information in '+name);
}
const manifest={series_version:seriesConfig.version,series_count:seriesConfig.series_count,series_sha256:seriesConfig.sha256,page_version:pkg.version,data_version:data.meta.events_db_version,data_hash:descriptor.d,counts:descriptor.n,build_method:'portable-esm+sealed',files:[...files].map(([name,b])=>({path:name,size:b.length,sha256:hash(b)}))};
files.set('release.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const stage=path.join(root,`.stw-dist-stage-${process.pid}`),old=path.join(root,`.stw-dist-old-${process.pid}`),dist=path.join(root,'dist');
let moved=false;
try{
 fs.mkdirSync(stage,{recursive:false});
 for(const [name,b] of files){const target=path.join(stage,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);}
 if(fs.existsSync(dist)){fs.renameSync(dist,old);moved=true;}
 fs.renameSync(stage,dist);if(moved)fs.rmSync(old,{recursive:true});
}catch(error){
 if(moved&&!fs.existsSync(dist)&&fs.existsSync(old))fs.renameSync(old,dist);
 if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true});throw error;
}
console.log(`SameTimeWorld v${pkg.version}: ${files.size} public files; ${descriptor.n.join(' / ')} records; ${[...files.values()].reduce((n,b)=>n+b.length,0)} bytes.`);