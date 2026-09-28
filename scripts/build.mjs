/**
 * SameTimeWorld portable production build.
 * The application uses browser-native ES modules and has no runtime packages.
 * Validate module syntax, rewrite local links, fingerprint assets, and publish
 * the exact files to dist. No native npm binding or network access is required.
 * Vite is retained as the development server (npm run dev / build:vite).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f));
const text=f=>read(f).toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pkg=JSON.parse(read('package.json'));
const files=new Map();
function putAsset(label,ext,content){
 const b=Buffer.isBuffer(content)?content:Buffer.from(content,'utf8');
 const name=`${label}-${sha(b).slice(0,12)}.${ext}`;
 files.set(`assets/${name}`,b);return name;
}
function checkedModule(label,code){
 const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8',timeout:15000});
 if(r.error||r.status!==0)throw new Error(`${label}: syntax validation failed\n${r.stderr||r.error}`);
}
let main=text('src/main.js'),leaders=text('src/leaders.js');
let subregions=text('src/subregions.js');checkedModule('subregions.js',subregions);
let mapCore=text('src/map-core.js'),worldData=text('src/world-data.js'),eventMap=text('src/event-map.js');
let css=text('src/style.css'),html=text('index.html');
checkedModule('main.js',main);checkedModule('leaders.js',leaders);
checkedModule('map-core.js',mapCore);checkedModule('world-data.js',worldData);checkedModule('event-map.js',eventMap);
if(!html.includes('src="/src/main.js"'))throw new Error('Unknown HTML entry; update build.mjs before publishing.');
if(!main.includes("import './style.css';")||!main.includes("from './leaders.js'"))throw new Error('Unknown module imports; update the production builder.');
if(!css.includes('./assets/world-map.png'))throw new Error('World-map CSS reference is missing.');
// Fail closed when new runtime packages/modules are introduced.
const withoutKnown=main.replace("import './style.css';",'').replace(/import\s+\{[^}]+\}\s+from\s+'\.\/leaders\.js';/,'').replace(/import\s+\{[^}]+\}\s+from\s+'\.\/event-map\.js';/,'');
const mapWithoutKnown=eventMap.replace("import * as C from './map-core.js';",'').replace("import world from './world-data.js';",'');
if([withoutKnown,leaders,mapCore.replace("import {SUBREGIONS,resolveSubregion} from './subregions.js';",''),worldData,mapWithoutKnown,subregions].some(code=>/^\s*import\s/m.test(code)))throw new Error('New module dependency detected; extend build.mjs or use Vite.');
const mapName=putAsset('world-map','png',read('src/assets/world-map.png'));
const leaderName=putAsset('leaders','js',leaders);
const subregionName=putAsset('subregions','js',subregions);
mapCore=mapCore.replace("from './subregions.js'",`from './${subregionName}'`);
const coreName=putAsset('map-core','js',mapCore),worldName=putAsset('world-data','js',worldData);
eventMap=eventMap.replace("from './map-core.js'",`from './${coreName}'`).replace("from './world-data.js'",`from './${worldName}'`);
const eventMapName=putAsset('event-map','js',eventMap);
main=main.replace("import './style.css';",'').replace("from './leaders.js'",`from './${leaderName}'`).replace("from './event-map.js'",`from './${eventMapName}'`);
const mainName=putAsset('main','js',main);
css=css.replaceAll('./assets/world-map.png',`./${mapName}`);
const cssName=putAsset('style','css',css);
html=html.replace('src="/src/main.js"',`src="./assets/${mainName}"`).replace('</head>',`<link rel="stylesheet" href="./assets/${cssName}">\n</head>`);
files.set('index.html',Buffer.from(html,'utf8'));
files.set('.nojekyll',Buffer.alloc(0));
files.set('MAP_DATA_NOTICE.txt',read('MAP_DATA_NOTICE.txt'));
const manifest={page_version:pkg.version,build_method:'portable-esm',files:[...files].map(([name,b])=>({path:name,size:b.length,sha256:sha(b)}))};
files.set('release.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const stage=path.join(root,`.stw-dist-stage-${process.pid}`),old=path.join(root,`.stw-dist-old-${process.pid}`),dist=path.join(root,'dist');
let moved=false;
try{
 fs.mkdirSync(stage,{recursive:false});
 for(const [name,buf] of files){const target=path.join(stage,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buf);}
 if(fs.existsSync(dist)){fs.renameSync(dist,old);moved=true;}
 fs.renameSync(stage,dist);
 if(moved)fs.rmSync(old,{recursive:true});
}catch(e){
 if(moved&&!fs.existsSync(dist)&&fs.existsSync(old))fs.renameSync(old,dist);
 if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true});
 throw e;
}
console.log(`SameTimeWorld v${pkg.version}: ${files.size} production files generated and hashed.`);
console.log(`dist/index.html — ${[...files.values()].reduce((n,b)=>n+b.length,0).toLocaleString('en-US')} bytes total`);
