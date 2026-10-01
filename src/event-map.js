import * as C from './map-core.js';
import world from './world-data.js';
import {resolvePoint} from './point-resolver.js';

// Point-only historical event map. Modern borders are background reference only.
export function createEventMap({canvas,note,motion,label,onFailure=()=>{}}={}){
 const fallback={showEvent(){},showWorld(){},destroy(){},snapshot(){return {available:false};}};
 let frame=0,resizeFrame=0,disposed=false,state;
 const fail=error=>{disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(resizeFrame);document.body.classList.remove('event-map-ready');if(note)note.textContent='동적 지도를 표시하지 못했습니다. 사건 내용은 계속 이용할 수 있습니다.';onFailure(error);};
 try{
  const ctx=canvas?.getContext('2d',{alpha:false});if(!ctx||typeof Path2D==='undefined'){fail(new Error('Canvas 2D unavailable'));return fallback;}
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  state={view:'timeline',eventId:null,point:null,camera:null,animation:null,width:0,height:0,dpr:1,opacity:.6,metrics:[]};
  function makePaths(geometry){
   const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
   return polygons.map(rings=>{const path=new Path2D();let firstCenter=0;rings.forEach((ring,ri)=>{const pts=[];let prev=null;for(const [lon,lat] of ring){let x=lon;if(prev!==null){while(x-prev>180)x-=360;while(x-prev< -180)x+=360;}pts.push([x,-lat]);prev=x;}const center=pts.reduce((s,p)=>s+p[0],0)/pts.length;if(ri===0)firstCenter=center;const offset=360*Math.round((firstCenter-center)/360);pts.forEach(([x,y],i)=>{if(!i)path.moveTo(x+offset,y);else path.lineTo(x+offset,y);});path.closePath();});return path;});
  }
  const features=world.features.map(f=>({...f.properties,paths:makePaths(f.geometry)}));
  function worldCamera(){
   const view=document.querySelector?.('#viewport'),rect=view?.getBoundingClientRect(),rail=state.width>720?64:0,width=rect?.width>0?view.clientWidth:state.width,left=rect?.width>0?rect.left:0;
   const c=C.fitCamera(C.WORLD_BOUNDS,Math.max(1,width-rail*2),state.height,{padding:20,focusY:state.height*.53});c.x-=(left+width/2-state.width/2)/c.scale;return c;
  }
  function pointCamera(p){
   if(!p)return worldCamera();
   const span=p.precision==='city'||p.precision==='historical_city'||p.precision==='db'?7:p.precision==='admin1'?18:p.precision==='named_region'?24:p.precision==='country'?44:90;
   const b=[p.lon-span,-p.lat-span*.62,p.lon+span,-p.lat+span*.62],mobile=state.width<=720,c=C.fitCamera(b,state.width*(mobile?.96:.68),state.height*.75,{padding:18});
   const cx=state.width*(mobile?.50:.72),cy=state.height*(mobile?.46:.52);c.x=p.lon-(cx-state.width/2)/c.scale;c.y=-p.lat-(cy-state.height/2)/c.scale;return C.nearestCamera(worldCamera(),c);
  }
  function draw(){
   if(disposed||!state.camera)return;
   const {width:w,height:h,camera:c}=state,s=c.scale;ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.fillStyle='#05080d';ctx.fillRect(0,0,w,h);
   ctx.save();ctx.translate(w/2,h/2);ctx.scale(s,s);ctx.translate(-c.x,-c.y);
   const left=c.x-w/2/s,right=c.x+w/2/s,top=c.y-h/2/s,bottom=c.y+h/2/s;
   ctx.lineWidth=.65/s;ctx.strokeStyle=`rgba(176,196,218,${state.opacity*.15})`;ctx.beginPath();const step=s>25?5:s>10?10:30;
   for(let x=Math.floor(left/step)*step;x<=right;x+=step){ctx.moveTo(x,Math.max(top,-90));ctx.lineTo(x,Math.min(bottom,90));}
   for(let y=Math.floor(Math.max(top,-90)/step)*step;y<=Math.min(bottom,90);y+=step){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
   ctx.globalAlpha=state.opacity;ctx.fillStyle='#e7ebf0';ctx.strokeStyle='#162231';ctx.lineWidth=.7/s;const wrapMin=Math.floor((left-180)/360),wrapMax=Math.ceil((right+180)/360);
   for(const f of features)for(let wrap=wrapMin;wrap<=wrapMax;wrap++){ctx.save();ctx.translate(wrap*360,0);for(const p of f.paths){ctx.fill(p,'evenodd');ctx.stroke(p);}ctx.restore();}
   if(state.view==='detail'&&state.point){
    let x=state.point.lon;x+=360*Math.round((c.x-x)/360);const y=-state.point.lat;
    ctx.globalAlpha=1;ctx.fillStyle='#ff3838';ctx.strokeStyle='#fff';ctx.lineWidth=1.4/s;ctx.beginPath();ctx.arc(x,y,Math.max(3.2/s,.22),0,Math.PI*2);ctx.fill();ctx.stroke();
   }
   ctx.restore();
   if(state.view==='detail'&&state.point){
    let x=state.point.lon;x+=360*Math.round((c.x-x)/360);const px=(x-c.x)*s+w/2,py=(-state.point.lat-c.y)*s+h/2;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='bottom';ctx.font="700 13px Arial, 'Malgun Gothic', sans-serif";ctx.lineWidth=3;ctx.strokeStyle='#0b121bdd';ctx.fillStyle='#fff4f4';ctx.strokeText(state.point.name,px,py-9);ctx.fillText(state.point.name,px,py-9);ctx.restore();
   }
  }
  function setMotion(text){if(motion&&motion.textContent!==text)motion.textContent=text;}
  function stop(reason='interrupted'){cancelAnimationFrame(frame);frame=0;const a=state.animation;if(a){state.metrics.push({kind:a.kind,durationMs:a.durationMs,actualMs:performance.now()-a.started,cancelled:true,reason});state.animation=null;}if(state.metrics.length>30)state.metrics.shift();}
  function flyTo(target,duration,kind){
   stop();const from={...state.camera};target=C.nearestCamera(from,target);const startOpacity=state.opacity,targetOpacity=state.view==='detail'?1:.6;
   const a={kind,from,to:target,durationMs:preference.matches?0:duration,started:performance.now(),panDistance:Math.hypot(target.x-from.x,target.y-from.y)};state.animation=a;canvas.dataset.motion=kind;
   function tick(now){if(disposed||state.animation!==a)return;try{const t=a.durationMs?Math.min(1,(now-a.started)/a.durationMs):1;state.camera=C.cameraAt(from,target,t,{kind});state.opacity=startOpacity+(targetOpacity-startOpacity)*C.ease(t);setMotion(kind==='return'?'세계지도로 복귀 중':t<C.APPROACH_TIMING.zoomStart?'장소로 이동 중':t<C.APPROACH_TIMING.panEnd?'이동 · 확대 중':'확대 중');draw();if(t<1){frame=requestAnimationFrame(tick);return;}state.camera=kind==='return'?worldCamera():{...target};state.opacity=targetOpacity;state.metrics.push({kind,durationMs:a.durationMs,actualMs:now-a.started,cancelled:false,panDistance:a.panDistance});if(state.metrics.length>30)state.metrics.shift();state.animation=null;frame=0;canvas.dataset.motion='idle';setMotion(kind==='return'?'세계지도':'위치 표시 완료');draw();}catch(error){fail(error);}}
   if(a.durationMs===0)tick(performance.now());else frame=requestAnimationFrame(tick);
  }
  function updateNote(p){if(label)label.textContent=p.name;const precision={city:'도시',historical_city:'역사 도시',admin1:'주·도·성·현',named_region:'지명 대표점',country:'국가 대표점',region:'권역 대표점',world:'세계',db:'DB 좌표'}[p.precision]||p.precision;if(note)note.textContent=`${p.name} · ${precision} 기준 대표 좌표. 역사 국경선은 사용하지 않습니다.`;canvas.dataset.level='point';canvas.dataset.precision=p.precision||'';canvas.dataset.lon=String(p.lon);canvas.dataset.lat=String(p.lat);}
  function resize(){if(disposed)return;const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);if(w===state.width&&h===state.height&&dpr===state.dpr)return;stop('resize');state.width=w;state.height=h;state.dpr=dpr;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);state.camera=state.view==='detail'&&state.point?pointCamera(state.point):worldCamera();state.opacity=state.view==='detail'?1:.6;canvas.dataset.motion='idle';draw();}
  function onResize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{try{resize();}catch(e){fail(e);}});}
  function onPreference(){if(preference.matches&&state.animation){const a=state.animation;flyTo(a.to,0,a.kind);}}
  function showEvent(event){if(disposed||!event)return;try{state.view='detail';state.eventId=event.id;state.point=resolvePoint(event);updateNote(state.point);flyTo(pointCamera(state.point),2000,'approach');}catch(e){fail(e);}}
  function showWorld(){if(disposed||state.view==='timeline')return;try{state.view='timeline';state.eventId=null;state.point=null;flyTo(worldCamera(),500,'return');}catch(e){fail(e);}}
  resize();document.body.classList.add('event-map-ready');window.addEventListener('resize',onResize,{passive:true});preference.addEventListener?.('change',onPreference);
  return {showEvent,showWorld,snapshot(){return {available:!disposed,...JSON.parse(JSON.stringify(state))};},destroy(){stop('destroy');disposed=true;cancelAnimationFrame(resizeFrame);window.removeEventListener('resize',onResize);preference.removeEventListener?.('change',onPreference);document.body.classList.remove('event-map-ready');}};
 }catch(error){fail(error);return fallback;}
}
