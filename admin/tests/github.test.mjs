import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitHubStore} from '../src/github.mjs';
import {mock} from './mock-github.mjs';

test('GitHub App signs scoped token; saves one atomic non-production commit and draft PR',async()=>{
 const h=await mock(),state=await h.store.load();assert.equal(state.collections.records.length,80);assert.equal(state.exists,false);
 state.collections.news[0].title='Sınaq — yalnız mock GitHub';
 const sha=await h.store.save(state,'news',[],[],{login:'authorized-admin'});assert.equal(h.refs.get('v2/content-drafts'),sha);assert.equal(h.refs.get('main'),'production');
 const treeWrite=h.writes.find(x=>x.route==='git/trees');assert.deepEqual(treeWrite.input.tree.map(x=>x.path),['content/v2/news.json']);
 const url=await h.store.review();assert.equal(url,'https://github.com/HafizV1/powerlifting.az/pull/999');assert.equal(h.prs[0].draft,true);assert.equal(h.prs[0].base,'feature/v2-admin-panel');assert.equal(h.prs[0].head,'v2/content-drafts');
 await h.store.review();assert.equal(h.prs.length,1);
});
test('collection serialization remains deterministic when GitHub blob responses arrive out of order',async()=>{
 const h=await mock(),fetcher=h.env.FETCH;
 h.env.FETCH=async(url,options)=>{if(url.endsWith('/git/blobs/blob-news'))await new Promise(r=>setTimeout(r,30));if(url.endsWith('/git/blobs/blob-competitions'))await new Promise(r=>setTimeout(r,20));return fetcher(url,options);};
 const state=await h.store.load();assert.deepEqual(Object.keys(state.collections),['news','competitions','protocols','albums','records','recordDocuments']);
});
test('GitHub optimistic concurrency refuses stale commits without force or main writes',async()=>{
 const h=await mock(),a=await h.store.load(),b=await h.store.load();a.collections.news[0].summary='First';await h.store.save(a,'news',[],[],{login:'first'});
 await assert.rejects(()=>h.store.save(b,'news',[],[],{login:'second'}),e=>e.status===409);
 assert.equal(h.refs.get('main'),'production');assert.ok(!h.writes.some(x=>x.input?.force===true));
});
test('GitHub downloaded PKCS1 key signs valid server-side App JWT without manual conversion',async()=>{
 const h=await mock(true),state=await h.store.load();assert.equal(state.collections.records.length,80);assert.equal(h.writes.length,0);
});
test('GitHub content branch guard blocks production or arbitrary branch configuration',async()=>{
 const h=await mock();for(const branch of ['main','master','gh-pages','feature/anything']){h.env.DATA_BRANCH=branch;await assert.rejects(()=>new GitHubStore(h.env).load());}
 assert.equal(h.writes.length,0);
});
test('GitHub write allowlist rejects uploads outside managed directories',async()=>{
 const h=await mock(),state=await h.store.load();await assert.rejects(()=>h.store.save(state,'news',[{path:'index.html',base64:'AA=='}],[],{login:'x'}));assert.equal(h.refs.get('main'),'production');assert.ok(!h.writes.some(x=>x.route==='git/trees'));
});

test('staging policy denies production repository, main review target and enabled rendering before any API call',async()=>{
 const h=await mock();h.env.STAGING_ONLY='true';
 for(const overrides of [
  {GITHUB_REPOSITORY:'HafizV1/powerlifting.az',BASE_BRANCH:'v2/staging-base',ENABLE_V1_EXPORT:'false'},
  {GITHUB_REPOSITORY:'HafizV1/powerlifting-v1-preview',BASE_BRANCH:'main',ENABLE_V1_EXPORT:'false'},
  {GITHUB_REPOSITORY:'HafizV1/powerlifting-v1-preview',BASE_BRANCH:'v2/staging-base',ENABLE_V1_EXPORT:'true'}
 ]){
  Object.assign(h.env,overrides);h.env.FETCH=()=>{throw new Error('Must not call GitHub');};
  await assert.rejects(()=>new GitHubStore(h.env).load(),e=>e.status===503);
 }
 assert.equal(h.writes.length,0);
});

test('opt-in renderer writes reviewed public pages only to draft branch; preserves athlete/homepage paths',async()=>{
 const h=await mock();h.env.ENABLE_V1_EXPORT='true';const state=await h.store.load();state.collections.news[0].title='Sınaq yalnız draft';
 await h.store.save(state,'news',[],[],{login:'allowed'});
 const entries=h.writes.find(x=>x.route==='git/trees').input.tree;assert.deepEqual(entries.map(x=>x.path),['content/v2/news.json','xeberler.html']);assert.ok(entries[1].content.includes('Sınaq yalnız draft'));assert.equal(h.refs.get('main'),'production');
});
