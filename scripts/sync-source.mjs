/** Refresh existing source capsules after intentional edits; no source rewriting. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const manifest=JSON.parse(fs.readFileSync('source-pack/manifest.json','utf8'));
for(const [name,item] of Object.entries(manifest)){const bytes=fs.readFileSync(name),sha=createHash('sha256').update(bytes).digest('hex'),file='source-pack/'+sha.slice(0,24)+'.txt';fs.writeFileSync(file,gzipSync(bytes,{mtime:0}).toString('base64')+'\n');if(file!==item.file)fs.rmSync(item.file,{force:true});manifest[name]={file,sha256:sha,size:bytes.length};}
fs.writeFileSync('source-pack/manifest.json',JSON.stringify(manifest,null,2)+'\n');
