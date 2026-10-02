const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=()=>fs.readFileSync(path.join(__dirname,'../.github/workflows/recover-db.yml'),'utf8');
test('legacy recovery never runs automatically after an integrated publication',()=>{
 assert.doesNotMatch(workflow(),/^\s*push\s*:/m);
 assert.match(workflow(),/workflow_dispatch/);
});
test('manual public inspection cannot mutate packets or overwrite the relational master',()=>{
 assert.match(workflow(),/contents:\s*read/);
 assert.doesNotMatch(workflow(),/contents:\s*write|recover-and-enrich\.mjs|rebuild-sqlite\.py|git push|writePacket/);
});
