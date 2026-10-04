const test=require('node:test'),assert=require('node:assert/strict');
test('list drag scrolls without selecting a card but a short click remains clickable',async()=>{
 const {enableListDrag}=await import('../src/list-drag.js');const handlers={},classes=new Set();let captured=false;
 const el={scrollTop:100,addEventListener:(k,f)=>handlers[k]=f,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},setPointerCapture:()=>captured=true,hasPointerCapture:()=>captured,releasePointerCapture:()=>captured=false};enableListDrag(el);
 const ev=(y)=>({button:0,pointerType:'mouse',pointerId:1,clientY:y,target:{closest:()=>null},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
 handlers.pointerdown(ev(200));handlers.pointermove(ev(197));assert.equal(el.scrollTop,100);handlers.pointerup(ev(197));const click=ev(197);handlers.click(click);assert.ok(!click.prevented);
 handlers.pointerdown(ev(200));handlers.pointermove(ev(150));assert.equal(el.scrollTop,150);assert.ok(classes.has('is-dragging'));handlers.pointerup(ev(150));const dragClick=ev(150);handlers.click(dragClick);assert.ok(dragClick.prevented&&dragClick.stopped);assert.equal(captured,false);assert.ok(!classes.has('is-dragging'));
});
