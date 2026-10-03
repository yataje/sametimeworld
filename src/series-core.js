/** Pure selection helpers. Membership is evidence of tagging, never a causal claim. */
export function orderedMembers(ids,byId){return [...new Set(ids)].filter(id=>byId.has(id)).sort((a,b)=>String(byId.get(a).timeline_date||byId.get(a).date||'9999').localeCompare(String(byId.get(b).timeline_date||byId.get(b).date||'9999'))||a-b);}
export function combineConcepts(concepts,ids,mode='any'){
 const map=new Map(concepts.map(x=>[x.id,x.events]));if(!ids.length||ids.some(id=>!map.has(id)))return [];
 const lists=ids.map(id=>map.get(id));return [...new Set(lists.flat())].filter(id=>mode!=='all'||lists.every(list=>list.includes(id))).sort((a,b)=>a-b);
}
export function neighbours(ids,current){const index=ids.indexOf(current);return {index,previous:index>0?ids[index-1]:null,next:index<ids.length-1?ids[index+1]:null};}
export function escapeAction(s){return s.repeat?'none':s.dialog?'dialog':s.settings?'settings':s.search?'search':s.detail?'timeline':'none';}
export function validateCatalogue(data){
 if(data?.schema!==1||!Array.isArray(data.series)||!Array.isArray(data.concepts))throw new Error('지원하지 않는 시리즈 자료입니다.');
 const check=(rows,kind)=>{const ids=new Set();for(const row of rows){if(!row||ids.has(row.id)||!Array.isArray(row.events)||row.events.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('잘못된 시리즈 연결입니다.');if(kind==='concept'&&(!Number.isSafeInteger(row.id)||typeof row.name!=='string'))throw new Error('잘못된 개념입니다.');ids.add(row.id);}};
 check(data.series,'series');check(data.concepts,'concept');return data;
}
