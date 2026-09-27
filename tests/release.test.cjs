const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const text=f=>fs.readFileSync(path.join(root,f),'utf8');

test('header controls follow search, magnifier, display settings, mute order',()=>{
 const h=text('index.html');
 const header=h.slice(h.indexOf('<header class="top">'),h.indexOf('</header>')+9);
 const order=['id="searchInput"','id="searchGo"','id="displaySettingsOpen"','id="soundToggle"'].map(x=>header.indexOf(x));
 assert.ok(order.every(x=>x>=0),'one or more header controls are missing');
 assert.ok(order[0]<order[1]&&order[1]<order[2]&&order[2]<order[3],'header control order is wrong');
 assert.ok(header.indexOf('id="soundToggle"')<header.indexOf('class="hint"'),'mute must remain before wheel help');
});

test('page, source and package identify the same release',()=>{
 const v=JSON.parse(text('package.json')).version;
 assert.ok(text('src/main.js').includes(`const PAGE_VERSION='v${v}';`));
 assert.ok(text('index.html').includes(`— v${v} ·`));
});

test('production build is independent of platform-specific native dependencies',()=>{
 const build=path.join(root,'scripts/build.mjs');
 assert.ok(fs.existsSync(build),'portable build entry is absent');
 cp.execFileSync(process.execPath,[build],{cwd:root,stdio:'pipe'});
 const manifest=JSON.parse(text('dist/release.json'));
 assert.equal(manifest.page_version,JSON.parse(text('package.json')).version);
 for(const item of manifest.files){
  const b=fs.readFileSync(path.join(root,'dist',item.path));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),item.sha256);
 }
 const html=text('dist/index.html');
 assert.doesNotMatch(html,/src="\/src\//);
 for(const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,'dist',m[1])),m[1]);
});
