const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');

test('zoom animation remains 800ms but does not lock later interaction',()=>{
  assert.match(main,/const ZOOM_DURATION=800/);
  assert.match(main,/if\(zoomTransition\)stopZoomTransition\(\);/);
  assert.match(main,/function requestedZoomBase\(\)\{return zoom;\}/);
  const pointerdown=main.match(/viewport\.addEventListener\('pointerdown',[^\n]+/u)?.[0]||'';
  assert.ok(pointerdown.includes('if(zoomTransition)stopZoomTransition();'));
  assert.ok(!pointerdown.includes('||zoomTransition'));
});

test('search navigation interrupts zoom instead of waiting for its timeout',()=>{
  const start=main.indexOf('function navigateToEvent(id,');
  const end=main.indexOf('function navigateToDateQuery(',start);
  const block=main.slice(start,end);
  assert.ok(block.includes('if(zoomTransition)stopZoomTransition();'));
  assert.ok(!block.includes('setTimeout'));
});

test('zoom-out anchors the hovered card exactly like zoom-in',()=>{
  assert.match(main,/const anchorDate=focusedEventDate\(anchorEventId\);/);
  assert.doesNotMatch(main,/next>previous\?focusedEventDate\(anchorEventId\):null/);
  assert.match(main,/const anchor=hoveredEventAnchor\(e\);\s*setZoom\(base-direction,anchor\?\.anchorY\?\?anchorY,anchor\?\.id\?\?null,anchor\?\.time\?\?null\);/);
  assert.match(main,/anchorY:er\.top\+er\.height\/2-vr\.top/);
  assert.match(main,/if\(eventAnchored\)reanchorFocusedEvent\(anchorEventId,anchorY\);/);
});