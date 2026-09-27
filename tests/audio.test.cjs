const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness({state='running',throws=false,saved=null}={}){
 const source=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
 const block=source.slice(source.indexOf("const AUDIO_SETTINGS_KEY="),source.indexOf('function syncTimelineHeaderWidth'));
 const oscillators=[], gains=[], storage=new Map(saved===null?[]:[['stw-audio-enabled-v1',saved]]);
 let time=100,constructed=0;
 const param=()=>({value:0,setValueAtTime(v){this.value=v;return this;},exponentialRampToValueAtTime(v){this.value=v;return this;},linearRampToValueAtTime(v){this.value=v;return this;},cancelScheduledValues(){return this;}});
 class Context{
  constructor(){constructed++;if(throws)throw new Error('device unavailable');this.state=state;this.currentTime=1;this.destination={};}
  resume(){return Promise.resolve().then(()=>{this.state='running';});}
  createGain(){const g={gain:param(),connect(){},disconnect(){}};gains.push(g);return g;}
  createStereoPanner(){return {pan:param(),connect(){},disconnect(){}};}
  createOscillator(){const o={frequency:param(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stops=(this.stops||0)+1;},onended:null};oscillators.push(o);return o;}
 }
 const sandbox={window:{AudioContext:Context},document:{getElementById(){return null;},addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},performance:{now:()=>time},console,Set,Math};
 vm.createContext(sandbox);
 vm.runInContext(block+'\nthis.api={ensureAudioContext,setAudioEnabled,emitDragSound,playZoomCue,silenceNavigationAudio};',sandbox);
 return {api:sandbox.api,oscillators,gains,storage,advance:n=>{time+=n;},constructed:()=>constructed};
}
test('audio context unavailable must never break navigation',()=>{const h=harness({throws:true});assert.doesNotThrow(()=>h.api.playZoomCue('in'));});
test('suspended audio replays only the current zoom cue after resume, never queued drag ticks',async()=>{const h=harness({state:'suspended'});h.api.playZoomCue('in');h.api.emitDragSound(100);assert.equal(h.oscillators.length,0);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.oscillators.length,3);});
test('rapid drag emits at most one bounded tick per input frame',()=>{const h=harness();h.api.emitDragSound(10000);assert.ok(h.oscillators.length<=1);h.advance(1);h.api.emitDragSound(10000);assert.ok(h.oscillators.length<=1);});
test('muting silences already scheduled sound, not only future calls',()=>{const h=harness();h.api.playZoomCue('in');h.api.setAudioEnabled(false);assert.ok(h.gains.some(g=>g.gain.value===0)||h.oscillators.every(o=>o.stops>=2),'No immediate mute for active voices');const n=h.oscillators.length;h.api.emitDragSound(1000);h.api.playZoomCue('out');assert.equal(h.oscillators.length,n);});
test('saved mute avoids creating audio and stays saved',()=>{const h=harness({saved:'0'});h.api.playZoomCue('in');assert.equal(h.constructed(),0);h.api.setAudioEnabled(false);assert.equal(h.storage.get('stw-audio-enabled-v1'),'0');});
test('audio level is restored after returning from a hidden tab',()=>{const h=harness();h.api.playZoomCue('in');assert.ok(h.gains.some(g=>g.gain.value>0));h.api.silenceNavigationAudio();assert.ok(h.gains.some(g=>g.gain.value===0));h.api.playZoomCue('out');assert.ok(h.gains.some(g=>g.gain.value===0.7));});
test('no movement produces no tick',()=>{const h=harness();h.api.emitDragSound(0);assert.equal(h.oscillators.length,0);});

test('multiple suspended zoom inputs collapse to one latest cue',async()=>{
 const h=harness({state:'suspended'});
 h.api.playZoomCue('in');h.api.playZoomCue('out');h.api.emitDragSound(1000);
 assert.equal(h.oscillators.length,0);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.oscillators.length,3);
});
