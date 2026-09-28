/** Decode a public, authenticated compressed package using browser-native APIs. */
export async function decodePacket(input,descriptor){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(!globalThis.crypto?.subtle||!globalThis.DecompressionStream)throw new Error('최신 브라우저에서 HTTPS 주소로 접속해 주세요.');
 if(bytes.length<33||new TextDecoder().decode(bytes.subarray(0,4))!=='STW1')throw new Error('자료 형식이 올바르지 않습니다.');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==descriptor.h)throw new Error('자료 무결성 검사에 실패했습니다. 새로고침해 주세요.');
 const raw=Uint8Array.from(atob(descriptor.k),x=>x.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(4,16),tagLength:128},key,bytes.subarray(16));
 const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
 const value=JSON.parse(await new Response(stream).text());
 if(value?.meta?.schema!==1||!Array.isArray(value.events)||!value.events.length||!Array.isArray(value.leaders)||!value.leaders.length)throw new Error('자료 내용이 비어 있거나 지원하지 않는 형식입니다.');
 if(value.events.length!==descriptor.n[0]||value.leaders.length!==descriptor.n[1])throw new Error('자료 건수가 일치하지 않습니다.');
 return value;
}
