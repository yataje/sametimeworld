import * as C from './map-core.js';
import world from './world-data.js';

// A single, non-interactive renderer shared by the timeline and event detail.
// It neither fetches events nor mutates the DB, history or timeline state.
export function createEventMap({canvas,note,motion,label,onFailure=()=>{}}={}){
  const fallback={showEvent(){},showWorld(){},destroy(){},snapshot(){return {available:false};}};
  let frame=0,resizeFrame=0,disposed=false,state;
  const fail=error=>{
    disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(resizeFrame);
    document.body.classList.remove('event-map-ready');
    if(note)note.textContent='동적 지도를 표시하지 못했습니다. 사건 내용은 계속 이용할 수 있습니다.';
    onFailure(error);
  };
  try{
    const ctx=canvas?.getContext('2d',{alpha:false});
    if(!ctx||typeof Path2D==='undefined'){fail(new Error('Canvas 2D unavailable'));return fallback;}
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    state={view:'timeline',eventId:null,camera:null,selection:null,animation:null,width:0,height:0,dpr:1,opacity:.6,metrics:[]};
    const reverseNames={};
    for(const [name,codes] of Object.entries(C.ALIASES))if(codes.length===1&&!reverseNames[codes[0]])reverseNames[codes[0]]=name;
    reverseNames.KOR='대한민국';reverseNames.PRK='북한';
    function featureRegion(p){if(C.MIDDLE.has(p.code))return 'middle';if(/America/.test(p.continent))return 'americas';if(['Europe','Africa'].includes(p.continent))return 'europe';if(['Asia','Oceania'].includes(p.continent))return 'east';return null;}
    function makePaths(geometry){
      const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
      return polygons.map(rings=>{
        const path=new Path2D();let firstRingCenter=0;
        rings.forEach((ring,ringIndex)=>{
          const pts=[];let prev=null;
          for(const [lon,lat] of ring){let x=lon;if(prev!==null){while(x-prev>180)x-=360;while(x-prev< -180)x+=360;}pts.push([x,-lat]);prev=x;}
          const center=pts.reduce((sum,p)=>sum+p[0],0)/pts.length;
          if(ringIndex===0)firstRingCenter=center;
          const offset=360*Math.round((firstRingCenter-center)/360);
          pts.forEach(([x,y],i)=>{if(i===0)path.moveTo(x+offset,y);else path.lineTo(x+offset,y);});path.closePath();
        });
        return path;
      });
    }
    const features=world.features.map(f=>({...f.properties,region:featureRegion(f.properties),paths:makePaths(f.geometry)}));
    const byCode=new Map(features.map(f=>[f.code,f]));
    const subregions=C.SUBREGIONS.map(f=>({...f,paths:makePaths(f.geometry)}));
    const bySubregion=new Map(subregions.map(f=>[f.id,f]));
    function worldCamera(){
      // Use the actual scroll viewport, not the header: the header can be
      // resized again after leader data arrives. Latitude framing is stable
      // when changing dates; north remains up and the date rails stay outside.
      const view=document.querySelector?.('#viewport');
      const rect=view?.getBoundingClientRect();
      const rail=state.width>720?64:0;
      const width=rect?.width>0?view.clientWidth:state.width;
      const left=rect?.width>0?rect.left:0;
      const c=C.fitCamera(C.WORLD_BOUNDS,Math.max(1,width-rail*2),state.height,{padding:20,focusY:state.height*.53});
      c.x-=(left+width/2-state.width/2)/c.scale;
      return c;
    }
    function selectionFor(event){
      const r=C.resolve(event);
      if(r.level==='country'&&!r.codes.every(code=>byCode.has(code))){
        const id=C.regionId(event.region);
        return {level:id?'region':'world',region:id,codes:[],label:id?C.GROUPS[id].label:'세계 전체',basis:'region',historical:false,note:'연결 가능한 경계가 없어 기록된 대륙으로 대체합니다.'};
      }
      return r;
    }
    function boundsFor(r){
      if(r.level==='world')return C.WORLD_BOUNDS;
      if(r.level==='subregion')return bySubregion.get(r.subregionId).bounds;
      if(r.level==='region')return C.GROUPS[r.region].bounds;
      let boxes=r.codes.map(c=>byCode.get(c).focus);
      const anchor=(boxes[0][0]+boxes[0][2])/2;
      boxes=boxes.map(b=>{const shift=360*Math.round((anchor-(b[0]+b[2])/2)/360);return [b[0]+shift,b[1],b[2]+shift,b[3]];});
      return [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
    }
    function cameraFor(r){
      if(r.level==='world')return worldCamera();
      const mobile=state.width<=720,b=C.expandBounds(boundsFor(r),r.level==='region'?1.2:5);
      const cx=state.width*(mobile?.50:.72),cy=state.height*(mobile?.46:.52);
      const c=C.fitCamera(b,state.width*(mobile?.96:.64),state.height*.74,{padding:16}),wc=worldCamera();
      if(c.scale<wc.scale*1.06)return wc;
      c.x=(b[0]+b[2])/2-(cx-state.width/2)/c.scale;
      c.y=(b[1]+b[3])/2-(cy-state.height/2)/c.scale;
      return c;
    }
    function draw(){
      if(disposed||!state.camera)return;
      const {width:w,height:h,camera:c}=state,s=c.scale;
      ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.fillStyle='#05080d';ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(w/2,h/2);ctx.scale(s,s);ctx.translate(-c.x,-c.y);
      if(!state.animation&&(state.view==='timeline'||state.selection?.level==='world')){const shift=360*Math.round((c.x-150)/360);ctx.beginPath();ctx.rect(C.WORLD_BOUNDS[0]+shift,-90,360,180);ctx.clip();}
      const left=c.x-w/2/s,right=c.x+w/2/s,top=c.y-h/2/s,bottom=c.y+h/2/s;
      ctx.lineWidth=.65/s;ctx.strokeStyle=`rgba(176,196,218,${state.opacity*.11})`;ctx.beginPath();
      const step=s>25?5:s>10?10:30;
      for(let x=Math.floor(left/step)*step;x<=right;x+=step){ctx.moveTo(x,Math.max(top,-90));ctx.lineTo(x,Math.min(bottom,90));}
      for(let y=Math.floor(Math.max(top,-90)/step)*step;y<=Math.min(bottom,90);y+=step){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
      const r=state.selection,selected=r?.level==='country'?new Set(r.codes):null;
      const highlighted=f=>r&&(selected?selected.has(f.code):r.level==='region'&&f.region===r.region);
      ctx.globalAlpha=state.opacity;ctx.strokeStyle='#15202f';ctx.lineWidth=.7/s;
      const wrapMin=Math.floor((left-180)/360),wrapMax=Math.ceil((right+180)/360);
      for(const f of features){
        ctx.fillStyle=highlighted(f)?'#f05255':'#f0f2f5';
        for(let wrap=wrapMin;wrap<=wrapMax;wrap++){ctx.save();ctx.translate(wrap*360,0);for(const p of f.paths){ctx.fill(p,'evenodd');ctx.stroke(p);}ctx.restore();}
      }
      if(r?.level==='subregion'){
        // Country fill remains white. Only the selected administrative polygon
        // is red; a bounding rectangle is never used as a false boundary.
        for(const f of subregions){
          if(f.parentCode!==r.codes[0])continue;
          const active=f.id===r.subregionId;ctx.strokeStyle=active?'#fff0f0':'#66717c';ctx.lineWidth=(active?1.1:.55)/s;
          if(active)ctx.fillStyle='#f05255';
          for(let wrap=wrapMin;wrap<=wrapMax;wrap++){ctx.save();ctx.translate(wrap*360,0);for(const p of f.paths){if(active)ctx.fill(p,'evenodd');if(active||s>=8)ctx.stroke(p);}ctx.restore();}
        }
      }
      ctx.restore();
      if(state.view==='detail' &&r&&r.level!=='world'){
        ctx.save();ctx.globalAlpha=.95;ctx.textAlign='center';ctx.textBaseline='middle';
        const local=r.level==='subregion'?bySubregion.get(r.subregionId):null;
        if(local){let x=local.labelPoint[0];x+=360*Math.round((c.x-x)/360);const px=(x-c.x)*s+w/2,py=(local.labelPoint[1]-c.y)*s+h/2;ctx.font="600 13px Arial, 'Malgun Gothic', sans-serif";ctx.lineWidth=3;ctx.strokeStyle='#0b121bd0';ctx.fillStyle='#fff5f5';ctx.strokeText(local.label,px,py);ctx.fillText(local.label,px,py);}
        const labels=features.filter(f=>highlighted(f)||(s>=8&&(f.focus[2]-f.focus[0])*s>55&&(f.focus[3]-f.focus[1])*s>30)),occupied=[];
        for(const f of labels.sort((a,b)=>Number(highlighted(b))-Number(highlighted(a)))){
          if(f.code==='ATA'||(local&&f.code===local.parentCode))continue;
          let x=f.labelPoint[0];x+=360*Math.round((c.x-x)/360);
          const px=(x-c.x)*s+w/2,py=(f.labelPoint[1]-c.y)*s+h/2;
          if(px<25||px>w-25||py<65||py>h-55)continue;
          if(occupied.some(p=>Math.abs(p[0]-px)<65&&Math.abs(p[1]-py)<24))continue;
          occupied.push([px,py]);
          const active=highlighted(f);ctx.font=`${active?'600':'400'} ${active?13:10}px Arial, 'Malgun Gothic', sans-serif`;
          ctx.lineWidth=3;ctx.strokeStyle='#0b121bd0';ctx.fillStyle=active?'#fff5f5':'#dce3ed';
          const text=reverseNames[f.code]||f.name;ctx.strokeText(text,px,py);ctx.fillText(text,px,py);
        }ctx.restore();
      }
    }
    function setMotion(text){if(motion&&motion.textContent!==text)motion.textContent=text;}
    function stop(reason='interrupted'){
      cancelAnimationFrame(frame);frame=0;
      const a=state.animation;
      if(a){state.metrics.push({kind:a.kind,durationMs:a.durationMs,actualMs:performance.now()-a.started,cancelled:true,reason});state.animation=null;}
      if(state.metrics.length>30)state.metrics.shift();
    }
    function flyTo(target,duration,kind){
      stop();
      const from={...state.camera};target=C.nearestCamera(from,target);
      const startOpacity=state.opacity,targetOpacity=state.view==='detail'?1:.6;
      const a={kind,from,to:target,durationMs:preference.matches?0:duration,started:performance.now(),panDistance:Math.hypot(target.x-from.x,target.y-from.y)};
      state.animation=a;canvas.dataset.motion=kind;
      function tick(now){
        if(disposed||state.animation!==a)return;
        try{
          const t=a.durationMs?Math.min(1,(now-a.started)/a.durationMs):1;
          state.camera=C.cameraAt(from,target,t,{kind});state.opacity=startOpacity+(targetOpacity-startOpacity)*C.ease(t);
          setMotion(kind==='return'?'세계지도로 복귀 중':t<C.APPROACH_TIMING.zoomStart?'장소로 이동 중':t<C.APPROACH_TIMING.panEnd?'이동 · 확대 중':'확대 중');
          if(t<1){draw();frame=requestAnimationFrame(tick);return;}
          state.camera=kind==='return'?worldCamera():{...target};state.opacity=targetOpacity;
          if(kind==='return')state.selection=null;
          state.metrics.push({kind,durationMs:a.durationMs,actualMs:now-a.started,cancelled:false,panDistance:a.panDistance});
          if(state.metrics.length>30)state.metrics.shift();state.animation=null;frame=0;
          canvas.dataset.motion='idle';setMotion(kind==='return'?'세계지도':'위치 표시 완료');draw();
        }catch(error){fail(error);}
      }
      if(a.durationMs===0)tick(performance.now());else frame=requestAnimationFrame(tick);
    }
    function updateNote(event,r){
      const names=r.codes.map(c=>reverseNames[c]||byCode.get(c)?.name||c),peninsula=r.codes.includes('KOR')&&r.codes.includes('PRK');
      const name=r.level==='subregion'?r.label:r.level==='world'?'세계 전체':r.level==='region'?C.GROUPS[r.region].label:peninsula?'한반도':names.join(' · ');
      if(label)label.textContent=name;
      let text=r.level==='country'?'국가 기준 · 주변 범위 면적 약 5배. 도시·시설 경계는 미연결입니다.':r.level==='region'?'대륙 대체 표시 · 빨간 영역 전체에서 일어났다는 뜻은 아닙니다.':'특정 위치 미상 또는 전 지구 사건 · 영역 강조 없음.';
      if(r.level==='subregion')text=`${r.label} 기준 · 주변 범위 면적 약 5배. ${r.note} 도시·시설은 해당 주 범위로 표시합니다.`;
      if(r.level!=='world')text+=' 현대 윤곽을 사용한 위치 참고용이며 당시 국경이 아닙니다.';
      if(note)note.textContent=text;
      canvas.dataset.level=r.level;canvas.dataset.codes=r.codes.join(',');canvas.dataset.subregion=r.subregionId||'';canvas.dataset.basis=r.basis;
    }
    function resize(){
      if(disposed)return;
      const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(w===state.width&&h===state.height&&dpr===state.dpr)return;
      stop('resize');state.width=w;state.height=h;state.dpr=dpr;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      state.camera=state.view==='detail'&&state.selection?cameraFor(state.selection):worldCamera();
      if(state.view==='timeline')state.selection=null;
      state.opacity=state.view==='detail'?1:.6;canvas.dataset.motion='idle';setMotion(state.view==='detail'?'위치 표시 완료':'세계지도');draw();
    }
    function onResize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{try{resize();}catch(e){fail(e);}});}
    function onPreference(){if(preference.matches&&state.animation){const a=state.animation;flyTo(a.to,0,a.kind);}}
    function showEvent(event){if(disposed||!event)return;try{state.view='detail';state.eventId=event.id;state.selection=selectionFor(event);updateNote(event,state.selection);flyTo(cameraFor(state.selection),2000,'approach');}catch(e){fail(e);}}
    function showWorld(){if(disposed||state.view==='timeline')return;try{state.view='timeline';state.eventId=null;flyTo(worldCamera(),500,'return');}catch(e){fail(e);}}
    resize();document.body.classList.add('event-map-ready');
    window.addEventListener('resize',onResize,{passive:true});preference.addEventListener?.('change',onPreference);
    return {showEvent,showWorld,snapshot(){return {available:!disposed,...JSON.parse(JSON.stringify(state))};},destroy(){stop('destroy');disposed=true;cancelAnimationFrame(resizeFrame);window.removeEventListener('resize',onResize);preference.removeEventListener?.('change',onPreference);document.body.classList.remove('event-map-ready');}};
  }catch(error){fail(error);return fallback;}
}
