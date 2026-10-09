import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mock} from './mock-github.mjs';
import worker,{handle} from '../src/worker.mjs';
import {sign} from '../src/security.mjs';
import {testScope} from '../src/staging-test.mjs';
const id='12345678-1234-4123-8123-123456789abc',origin='https://admin.example',secret='only-test-session-key-more-than-32-bytes';
test('authenticated E2E edits only its disposable branch, creates draft PR, validates diff and cleans up',async()=>{
 const h=await mock(false,true),env={...h.env,PUBLIC_ORIGIN:origin,SESSION_SECRET:secret,ADMIN_USER_IDS:'42'};
 const token=await sign({id:'42',login:'allowed-test',csrf:'csrf',exp:Date.now()+60000},secret);
 let revision;async function call(path,method='GET',body){
  const r=await handle(new Request(origin+path,{method,headers:{Cookie:'__Host-pl-admin='+token,Origin:origin,'X-CSRF-Token':'csrf','X-Staging-Test-Run':id,...(revision?{'If-Match':revision}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  const data=await r.json();if(data.revision)revision=data.revision;return {r,data};
 }
 let result=await call('/api/content');assert.equal(result.data.stagingTest,id);assert.equal(result.data.collections.records.length,80);
 result=await call('/api/content/news','POST',{title:'STAGING TEST',body:'Synthetic test only',status:'draft'});assert.equal(result.r.status,201);
 assert.equal(h.refs.get('v2/content-staging'),'seed');assert.ok(h.refs.has('v2/content-e2e-'+id));
 result=await call('/api/review','POST');assert.match(result.data.url,/powerlifting-v1-preview\/pull\//);assert.equal(h.prs[0].draft,true);assert.equal(h.prs[0].base,'v2/staging-base');
 result=await call('/api/e2e/cleanup','POST',{results:[{name:'news-create',passed:true}]});assert.equal(result.r.status,200);assert.equal(result.data.cleaned,true);assert.equal(result.data.changedFiles,1);
 assert.equal(h.prs[0].state,'closed');assert.match(h.prs[0].body,/Cleanup: COMPLETE/);assert.equal(h.refs.has('v2/content-e2e-'+id),false);assert.equal(h.refs.get('v2/content-staging'),'seed');assert.equal(h.refs.get('main'),'production');
 assert.ok(!h.writes.some(w=>w.route.includes('/merge')));
});
test('E2E scope and cleanup require authorized session/CSRF and fixed preview-only configuration',async()=>{
 const h=await mock(false,true),env={...h.env,PUBLIC_ORIGIN:origin,SESSION_SECRET:secret,ADMIN_USER_IDS:'42'};
 let r=await handle(new Request(origin+'/api/e2e/cleanup',{method:'POST',headers:{Origin:origin,'X-Staging-Test-Run':id},body:'{}'}),env);assert.equal(r.status,401);
 const token=await sign({id:'42',login:'test',csrf:'csrf',exp:Date.now()+60000},secret);
 r=await handle(new Request(origin+'/api/e2e/cleanup',{method:'POST',headers:{Cookie:'__Host-pl-admin='+token,Origin:origin,'X-Staging-Test-Run':id},body:'{}'}),env);assert.equal(r.status,403);
 for(const overrides of [{STAGING_ONLY:'false'},{GITHUB_REPOSITORY:'HafizV1/powerlifting.az'},{ENABLE_V1_EXPORT:'true'},{LOCAL_STORE:{}}])assert.throws(()=>testScope(new Request(origin+'/api/content',{headers:{'X-Staging-Test-Run':id}}),{...env,...overrides}));
 assert.throws(()=>testScope(new Request(origin+'/api/content',{headers:{'X-Staging-Test-Run':'main'}}),env));assert.equal(h.writes.length,0);
});
test('cleanup refuses non-test branches, unapproved file changes and unsanitized report fields',async()=>{
 const h=await mock(false,true);await assert.rejects(()=>h.store.cleanupTest(id,[]));
 const scoped=testScope(new Request(origin+'/api/content',{headers:{'X-Staging-Test-Run':id}}),h.env);
 const {GitHubStore}=await import('../src/github.mjs');const store=new GitHubStore(scoped.env),state=await store.load();state.collections.news[0].summary='STAGING TEST';await store.save(state,'news',[],[],{login:'test'});
 await assert.rejects(()=>store.cleanupTest(id,[{name:'news-create',passed:true,secret:'must never be reported'}]));
 const fetcher=scoped.env.FETCH;scoped.env.FETCH=(url,options)=>url.includes('/compare/')?Promise.resolve(Response.json({files:[{filename:'idmancilar.html'}]})):fetcher(url,options);
 await assert.rejects(()=>store.cleanupTest(id,[]));assert.ok(h.refs.has('v2/content-e2e-'+id));assert.equal(h.prs.length,0);
});
test('only a valid staging test iframe gets same-origin framing; default remains denied',async()=>{
 const env={STAGING_ONLY:'true',ASSETS:{fetch:()=>new Response('test')}};
 let r=await worker.fetch(new Request(origin+'/index.html?stagingTest='+id),env);assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);
 for(const path of ['/','/index.html','/index.html?stagingTest=invalid']){r=await worker.fetch(new Request(origin+path),env);assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);}
});
