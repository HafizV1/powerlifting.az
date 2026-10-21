import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareRelease,prepareRollback} from '../src/release.mjs';import {KINDS} from '../src/validation.mjs';
const root=new URL('../../',import.meta.url);const pages=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.html')).map(n=>[n,fs.readFileSync(new URL(n,root),'utf8')]));const previous=Object.fromEntries(KINDS.map(k=>[k,JSON.parse(fs.readFileSync(new URL('content/v2/'+k+'.json',root)))]));
// The release backup keeps these regression tests valid after the article is removed.
const backup=new URL('content/v2/releases/08c4cd5f-595c-47cc-ac4d-f8c75539e377/backup/',root);
for(const name of ['index.html','xeberler.html'])if(fs.existsSync(new URL(name,backup)))pages[name]=fs.readFileSync(new URL(name,backup),'utf8');
// Use the original backed-up article after production removal as well.
const item={...previous.news.find(n=>n.id==='news-epf-2026'),status:'published'};
const opts={sourceRevision:'a'.repeat(40),contentRevision:'b'.repeat(40)};
test('unpublishing or deleting news removes only its public card and matching homepage teaser with rollback',async()=>{
 for(const remove of [false,true]){
  const before=structuredClone(previous);before.news=[item];
  const c=structuredClone(before);c.news=remove?[]:[{...item,status:'draft'}];
  const r=await prepareRelease({...opts,pages,previous:before,collections:c});
  assert.deepEqual(Object.keys(r.output).sort(),['index.html','xeberler.html']);
  const card=pages['index.html'].match(/<article class="panel homepage-news">[\s\S]*?<\/article>/)[0];
  assert.equal(r.output['index.html'],pages['index.html'].replace(card,''));
  assert.ok(!r.output['xeberler.html'].includes('<article class="news-card">'));
  assert.ok(r.output['index.html'].includes('data-cf-beacon'));
  const rollback=await prepareRollback({current:r.output,backup:pages,manifest:r.manifest});assert.equal(rollback.restore['index.html'],pages['index.html']);assert.equal(rollback.restore['xeberler.html'],pages['xeberler.html']);
 }
});
test('unrelated or still-published news never removes the homepage teaser',async()=>{
 const before=structuredClone(previous);before.news=[item];
 const c=structuredClone(before);c.news[0].summary='Scoped test';
 const r=await prepareRelease({...opts,pages,previous:before,collections:c});assert.ok(!r.output['index.html']);
 const foreign=structuredClone(before);foreign.news=[{...item,title:'Different article'}];
 const draft=structuredClone(foreign);draft.news[0].status='draft';
 // Avoid news-card reconciliation against an absent synthetic article.
 const differentPages={...pages,'xeberler.html':pages['xeberler.html'].replaceAll(item.title,'Different article')};
 const other=await prepareRelease({...opts,pages:differentPages,previous:foreign,collections:draft});assert.ok(!other.output['index.html']);
});
