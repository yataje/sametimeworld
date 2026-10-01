import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'source-pack/manifest.json'),'utf8'));
for(const [target,entry] of Object.entries(manifest)){
  const encoded=fs.readFileSync(path.join(root,entry.file),'utf8').trim();
  const data=zlib.gunzipSync(Buffer.from(encoded,'base64'));
  const hash=crypto.createHash('sha256').update(data).digest('hex');
  if(hash!==entry.sha256 || data.length!==entry.size) throw new Error(`source capsule verification failed: ${target}`);
  const dest=path.join(root,target);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,data);
}
console.log(`Restored ${Object.keys(manifest).length} verified source files.`);