/** Existing memberships only. A concept grouping is not an authored causal series. */
import {orderedMembers,combineConcepts,neighbours} from './series-core.js';
export function indexEventChoices(catalogue,byId,custom=[]){
 const index=new Map();
 const add=choice=>{if(!choice.events.length)return;for(const id of choice.events){if(!index.has(id))index.set(id,[]);index.get(id).push(choice);}};
 for(const s of [...custom,...catalogue.series]){
  const ids=s.concept_ids?combineConcepts(catalogue.concepts,s.concept_ids,s.match):s.events;
  add({...s,title:s.title,kind:s.kind||'series',events:orderedMembers(ids,byId)});
 }
 const order={topic:0,person:1,technology:2,place:3,polity:4};
 for(const c of [...catalogue.concepts].sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)||a.name.localeCompare(b.name,'ko'))){
  add({id:'concept-'+c.id,title:c.name,type:c.type,kind:'concept',events:orderedMembers(c.events,byId)});
 }
 return index;
}
export function detailActions(ids,current,selected){
 const n=neighbours(ids,current),enabled=!!selected&&n.index>=0;
 return {first:enabled?ids[0]:null,previous:enabled?n.previous:null,next:enabled?n.next:null,index:enabled?n.index:-1,enabled};
}
export function splitSpeech(value,limit=180){
 const clean=String(value??'').replace(/https?:\/\/\S+/gi,'').replace(/\s+/g,' ').trim(),parts=[];
 let rest=clean;
 while(rest){let n=Math.min(rest.length,limit);if(rest.length>limit){const p=rest.slice(0,limit).search(/[.!?。！？]\s+[^.!?。！？]*$/);const space=rest.lastIndexOf(' ',limit);if(p>limit/3)n=p+1;else if(space>limit/3)n=space;}
  parts.push(rest.slice(0,n).trim());rest=rest.slice(n).trim();}
 return parts.filter(Boolean);
}
export function narrationParts(event,details){
 const date=String(event.date_label||event.date||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>`${+y}년 ${+m}월 ${+d}일`).replace(/^(\d{4})-(\d{2})$/,(_,y,m)=>`${+y}년 ${+m}월`).replace(/^(\d{4})$/,(_,y)=>`${+y}년`);
 const description=String(details.description||'').split('\n').filter(line=>!/^\s*(?:출처|원문 날짜|검증 상태|날짜 검증|원역법)\s*[:：]/.test(line)).join(' ');
 return [event.title,date,details.place||event.locality,description].filter(Boolean).flatMap(x=>splitSpeech(x));
}
