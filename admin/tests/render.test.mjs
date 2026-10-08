import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../scripts/local-server.mjs';
import {KINDS} from '../src/validation.mjs';
import {renderV1} from '../src/render-v1.mjs';
async function fixtures(){
 const base={};for(const n of ['xeberler.html','yarislar.html','rekordlar.html','neticeler.html','rekord-qaydalari.html','cempionat-2026-haqqinda.html','kubok-2025-haqqinda.html','kubok-2026-haqqinda.html'])base[n]=await readFile(path.join(ROOT,n),'utf8');
 const collections={};for(const k of KINDS)collections[k]=JSON.parse(await readFile(path.join(ROOT,'content/v2',k+'.json'),'utf8'));return {base,collections};
}
test('review renderer escapes content and script injection; never outputs athlete/homepage files',async()=>{
 const {base,collections}=await fixtures();collections.news[0].title='<script>alert(1)</script>';collections.records[0].athlete='</script><script>alert(2)</script>';
 const output=renderV1(base,collections);assert.ok(output['xeberler.html'].includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!output['rekordlar.html'].includes('</script><script>alert(2)'));assert.ok(output['rekordlar.html'].includes('\\u003c/script>'));
 assert.ok(!Object.hasOwn(output,'index.html'));assert.ok(!Object.hasOwn(output,'idmancilar.html'));assert.ok(!Object.hasOwn(output,'idmanchilar.html'));
 for(const filename of ['xeberler.html','yarislar.html','rekordlar.html','neticeler.html']){
  const styles=s=>s.match(/<style[^>]*>[\s\S]*?<\/style>/g);assert.deepEqual(styles(output[filename]),styles(base[filename]));
  assert.ok(output[filename].includes('assets/css/mobile.css'));
 }
});
test('publish/unpublish controls rendered content; protocol grouping preserves original result database',async()=>{
 const {base,collections}=await fixtures();collections.news[0].status='draft';
 collections.protocols=[{id:'test-only',title:'Sınaq protokolu',competitionId:collections.competitions[0].id,sport:'Benç-press',status:'published',file:{path:'assets/uploads/protocols/test/file.pdf'}}];
 const output=renderV1(base,collections);assert.ok(!output['xeberler.html'].includes(collections.news[0].title));assert.ok(output['neticeler.html'].includes('Benç-press — protokollar'));
 const extract=s=>s.match(/const DATA=\[[\s\S]*?\];/)[0];assert.equal(extract(output['neticeler.html']),extract(base['neticeler.html']));
});
