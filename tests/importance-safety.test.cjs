const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('importance observer tolerates a detached text node during rapid view changes',()=>{
 const h=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const s=h.split('<script id="importance-color-test-script">')[1].split('</script>')[0];
 let callback;
 const ctx={Node:{TEXT_NODE:3,ELEMENT_NODE:1},NodeFilter:{SHOW_TEXT:4,FILTER_REJECT:2,FILTER_ACCEPT:1},
  MutationObserver:class{constructor(fn){callback=fn;}observe(){}},
  document:{readyState:'loading',documentElement:{},addEventListener(){},createTreeWalker(root){if(!root)throw Error('TreeWalker root is null');return {nextNode:()=>false};}}};
 vm.runInNewContext(s,ctx);
 assert.doesNotThrow(()=>callback([{addedNodes:[{nodeType:3,parentNode:null}]}]));
});
