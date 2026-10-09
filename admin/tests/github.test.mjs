import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {GitHubStore} from '../src/github.mjs';
import {KINDS} from '../src/validation.mjs';
import {ROOT} from '../scripts/local-server.mjs';

async function mock(){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
 const env={GITHUB_APP_ID:'123',GITHUB_INSTALLATION_ID:'456',GITHUB_APP_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+pkcs8+'\n-----END PRIVATE KEY-----',GITHUB_REPOSITORY:'HafizV1/powerlifting.az',BASE_BRANCH:'feature/v2-admin-panel',DATA_BRANCH:'v2/content-drafts'};
 const blobs=new Map(),trees=new Map(),commits=new Map(),refs=new Map([['feature/v2-admin-panel','seed'],['main','production']]);
 const entries=[];for(const kind of KINDS){const sha='blob-'+kind;blobs.set(sha,await readFile(path.join(ROOT,'content/v2',kind+'.json'),'utf8'));entries.push({path:`content/v2/${kind}.json`,mode:'100644',type:'blob',sha});}
 for(const name of ['xeberler.html','yarislar.html','rekordlar.html','neticeler.html','rekord-qaydalari.html','cempionat-2026-haqqinda.html','kubok-2025-haqqinda.html','kubok-2026-haqqinda.html']){const sha='source-'+name;blobs.set(sha,await readFile(path.join(ROOT,name),'utf8'));entries.push({path:name,mode:'100644',type:'blob',sha});}
 trees.set('seed-tree',entries);commits.set('seed',{tree:{sha:'seed-tree'}});const writes=[],prs=[];let number=0;
 env.FETCH=async(url,options)=>{
  const input=options.body?JSON.parse(options.body):null,method=options.method||'GET';
  if(url==='https://api.github.com/app/installations/456/access_tokens'){
   const jwt=options.headers.Authorization.slice(7),[header,body,signature]=jwt.split('.');
   assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'RS256');assert.equal(JSON.parse(Buffer.from(body,'base64url')).iss,'123');
   assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(signature,'base64url'),Buffer.from(header+'.'+body)),true);
   assert.deepEqual(input,{repositories:['powerlifting.az'],permissions:{contents:'write',pull_requests:'write'}});
   return Response.json({token:'installation-token-server-only',expires_at:new Date(Date.now()+3600000).toISOString()});
  }
  assert.equal(options.headers.Authorization,'Bearer installation-token-server-only');
  const prefix='https://api.github.com/repos/HafizV1/powerlifting.az';assert.ok(url.startsWith(prefix));const route=decodeURIComponent(url.slice(prefix.length).replace(/^\//,''));
  if(method!=='GET')writes.push({route,method,input});
  if(!route)return Response.json({default_branch:'main'});
  if(route.startsWith('git/ref/heads/')){const sha=refs.get(route.slice(14));return sha?Response.json({object:{sha}}):new Response('',{status:404});}
  if(method==='GET'&&route.startsWith('git/commits/'))return Response.json(commits.get(route.slice(12)));
  if(method==='GET'&&route.startsWith('git/trees/'))return Response.json({tree:trees.get(route.slice(10).split('?')[0]),truncated:false});
  if(method==='GET'&&route.startsWith('git/blobs/'))return Response.json({content:Buffer.from(blobs.get(route.slice(10))).toString('base64'),encoding:'base64'});
  if(route==='git/refs'&&method==='POST'){const branch=input.ref.slice(11);if(refs.has(branch))return new Response('',{status:422});refs.set(branch,input.sha);return Response.json({ref:input.ref});}
  if(route==='git/blobs'&&method==='POST'){const sha='created-blob-'+ ++number;blobs.set(sha,Buffer.from(input.content,'base64').toString());return Response.json({sha});}
  if(route==='git/trees'&&method==='POST'){
   const sha='tree-'+ ++number,next=structuredClone(trees.get(input.base_tree));
   for(const entry of input.tree){const i=next.findIndex(x=>x.path===entry.path);if(i>=0)next.splice(i,1);if(entry.sha!==null){const blobSha=entry.sha||'text-'+ ++number;if(entry.content!==undefined)blobs.set(blobSha,entry.content);next.push({...entry,sha:blobSha});}}
   trees.set(sha,next);return Response.json({sha});
  }
  if(route==='git/commits'&&method==='POST'){const sha='commit-'+ ++number;commits.set(sha,{tree:{sha:input.tree},parents:input.parents});return Response.json({sha});}
  if(route.startsWith('git/refs/heads/')&&method==='PATCH'){
   const branch=route.slice(15);assert.equal(input.force,false);
   if(commits.get(input.sha).parents[0]!==refs.get(branch))return new Response('',{status:422});refs.set(branch,input.sha);return Response.json({object:{sha:input.sha}});
  }
  if(route.startsWith('pulls?'))return Response.json(prs);
  if(route==='pulls'&&method==='POST'){const pr={html_url:'https://github.com/HafizV1/powerlifting.az/pull/999',...input};prs.push(pr);return Response.json(pr);}
  throw new Error('Unexpected mock API route: '+method+' '+route);
 };
 return {env,refs,writes,prs,store:new GitHubStore(env)};
}
test('GitHub App signs scoped token; saves one atomic non-production commit and draft PR',async()=>{
 const h=await mock(),state=await h.store.load();assert.equal(state.collections.records.length,80);assert.equal(state.exists,false);
 state.collections.news[0].title='Sınaq — yalnız mock GitHub';
 const sha=await h.store.save(state,'news',[],[],{login:'authorized-admin'});assert.equal(h.refs.get('v2/content-drafts'),sha);assert.equal(h.refs.get('main'),'production');
 const treeWrite=h.writes.find(x=>x.route==='git/trees');assert.deepEqual(treeWrite.input.tree.map(x=>x.path),['content/v2/news.json']);
 const url=await h.store.review();assert.equal(url,'https://github.com/HafizV1/powerlifting.az/pull/999');assert.equal(h.prs[0].draft,true);assert.equal(h.prs[0].base,'feature/v2-admin-panel');assert.equal(h.prs[0].head,'v2/content-drafts');
 await h.store.review();assert.equal(h.prs.length,1);
});
test('GitHub optimistic concurrency refuses stale commits without force or main writes',async()=>{
 const h=await mock(),a=await h.store.load(),b=await h.store.load();a.collections.news[0].summary='First';await h.store.save(a,'news',[],[],{login:'first'});
 await assert.rejects(()=>h.store.save(b,'news',[],[],{login:'second'}),e=>e.status===409);
 assert.equal(h.refs.get('main'),'production');assert.ok(!h.writes.some(x=>x.input?.force===true));
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
