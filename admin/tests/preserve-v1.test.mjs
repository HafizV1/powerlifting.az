import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {ROOT} from '../scripts/local-server.mjs';
test('all original V1 files match the deployed baseline byte-for-byte',async()=>{
 const baseline=JSON.parse(await readFile(new URL('./v1-files.json',import.meta.url),'utf8'));
 for(const [name,sha] of Object.entries(baseline.files))assert.equal(createHash('sha256').update(await readFile(path.join(ROOT,name))).digest('hex'),sha,name);
 const s=await readFile(path.join(ROOT,'idmancilar.html'),'utf8'),athletes=JSON.parse(s.match(/const ATH=(\[[\s\S]*?\]);const esc/)[1]);assert.equal(athletes.length,208);
 const records=JSON.parse((await readFile(path.join(ROOT,'rekordlar.html'),'utf8')).match(/const RECORDS=(\[[\s\S]*?\]);/)[1]);
 const imported=JSON.parse(await readFile(path.join(ROOT,'content/v2/records.json'),'utf8')).map(({id,...r})=>r);assert.deepEqual(imported,records);
});
