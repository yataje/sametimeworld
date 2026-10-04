/** A short click still opens a card; a vertical drag only scrolls the list. */
export function enableListDrag(element){
 let active=null,suppress=false;
 element.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.pointerType==='touch'||event.target.closest('.series-card-pages'))return;
  suppress=false;active={id:event.pointerId,y:event.clientY,top:element.scrollTop,drag:false};
 });
 element.addEventListener('pointermove',event=>{
  if(!active||event.pointerId!==active.id)return;
  const delta=event.clientY-active.y;
  if(!active.drag&&Math.abs(delta)<6)return;
  if(!active.drag){active.drag=true;element.setPointerCapture(event.pointerId);element.classList.add('is-dragging');}
  event.preventDefault();element.scrollTop=active.top-delta;
 });
 const finish=event=>{if(!active||event.pointerId!==active.id)return;suppress=active.drag;active=null;element.classList.remove('is-dragging');if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);};
 element.addEventListener('pointerup',finish);element.addEventListener('pointercancel',finish);
 element.addEventListener('lostpointercapture',finish);
 element.addEventListener('click',event=>{if(!suppress)return;suppress=false;event.preventDefault();event.stopImmediatePropagation();},true);
}
