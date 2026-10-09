import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../docs/browser-deploy/worker.mjs';
const origin='https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev';
test('browser deploy bundle serves existing assets and denies unauthenticated/local access',async()=>{
 for(const path of ['/','/admin.js','/admin.css']){
  const r=await worker.fetch(new Request(origin+path),{});assert.equal(r.status,200);assert.ok((await r.text()).length>100);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
 }
 const r=await worker.fetch(new Request(origin+'/api/content'),{});assert.equal(r.status,401);
 const login=await worker.fetch(new Request(origin+'/api/auth/local',{method:'POST',headers:{Origin:origin}}),{});assert.equal(login.status,404);
 const session=await worker.fetch(new Request(origin+'/api/session'),{});assert.deepEqual(await session.json(),{user:null,local:false});
});
test('browser deploy derives server session key and produces secure OAuth state cookie',async()=>{
 const env={GITHUB_CLIENT_ID:'mock-client',GITHUB_CLIENT_SECRET:'mock-server-only-client-secret-1234567890'};
 const r=await worker.fetch(new Request(origin+'/api/auth/github'),env);assert.equal(r.status,302);assert.ok(r.headers.get('Set-Cookie').includes('HttpOnly; Secure; SameSite=Lax'));
 assert.equal(new URL(r.headers.get('Location')).searchParams.get('redirect_uri'),origin+'/api/auth/callback');
 assert.ok(!r.headers.get('Set-Cookie').includes(env.GITHUB_CLIENT_SECRET));
});
