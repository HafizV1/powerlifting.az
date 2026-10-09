import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../docs/browser-deploy/worker.mjs';
const origin='https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev';
async function appEnv(){
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 return {GITHUB_APP_ID:'123',GITHUB_APP_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----',GITHUB_CLIENT_ID:'123',GITHUB_CLIENT_SECRET:'mock-server-only-client-secret-1234567890',FETCH:async url=>{
  assert.equal(url,'https://api.github.com/app');return Response.json({id:123,slug:'powerlifting-v2-staging-admin',client_id:'Iv1.mock-canonical-client'});
 }};
}
test('browser deploy bundle serves existing assets and denies unauthenticated/local access',async()=>{
 for(const path of ['/','/admin.js','/admin.css']){
  const r=await worker.fetch(new Request(origin+path),{});assert.equal(r.status,200);assert.ok((await r.text()).length>100);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
 }
 const r=await worker.fetch(new Request(origin+'/api/content'),{});assert.equal(r.status,401);
 const login=await worker.fetch(new Request(origin+'/api/auth/local',{method:'POST',headers:{Origin:origin}}),{});assert.equal(login.status,404);
 const session=await worker.fetch(new Request(origin+'/api/session'),{});assert.deepEqual(await session.json(),{user:null,local:false});
});
test('browser deploy derives server session key and produces secure OAuth state cookie',async()=>{
 const env=await appEnv();
 const r=await worker.fetch(new Request(origin+'/api/auth/github'),env);assert.equal(r.status,302);assert.ok(r.headers.get('Set-Cookie').includes('HttpOnly; Secure; SameSite=Lax'));
 assert.equal(new URL(r.headers.get('Location')).searchParams.get('redirect_uri'),origin+'/api/auth/callback');
 assert.ok(!r.headers.get('Set-Cookie').includes(env.GITHUB_CLIENT_SECRET));
 assert.equal(new URL(r.headers.get('Location')).searchParams.get('client_id'),'Iv1.mock-canonical-client');
});
test('staging corrects mistaken Client ID, binds canonical ID through OAuth exchange and exposes no credentials',async()=>{
 const env=await appEnv(),fetchIdentity=env.FETCH;
 env.FETCH=async(url,options)=>{
  if(url==='https://api.github.com/app')return fetchIdentity(url);
  if(url==='https://github.com/login/oauth/access_token'){
   const body=JSON.parse(options.body);assert.equal(body.client_id,'Iv1.mock-canonical-client');assert.equal(body.redirect_uri,origin+'/api/auth/callback');return Response.json({access_token:'mock-private-token'});
  }
  if(url==='https://api.github.com/user')return Response.json({id:335450583,login:'HafizV1'});
  throw new Error('Unexpected URL');
 };
 const check=await worker.fetch(new Request(origin+'/api/auth/check'),env),data=await check.json();assert.equal(data.appVerified,true);assert.equal(data.configuredClientMatches,false);assert.ok(!JSON.stringify(data).includes(env.GITHUB_CLIENT_SECRET));
 const login=await worker.fetch(new Request(origin+'/api/auth/github'),env),state=new URL(login.headers.get('Location')).searchParams.get('state'),cookie=login.headers.get('Set-Cookie').split(';')[0];
 const callback=await worker.fetch(new Request(origin+'/api/auth/callback?state='+state+'&code=mock-code',{headers:{Cookie:cookie}}),env);
 assert.equal(callback.status,302);assert.ok(callback.headers.get('Set-Cookie').includes('SameSite=Strict'));assert.ok(!callback.headers.get('Set-Cookie').includes('mock-private-token'));
 const sessionCookie=callback.headers.get('Set-Cookie').split(';')[0];const session=await worker.fetch(new Request(origin+'/api/session',{headers:{Cookie:sessionCookie}}),env);assert.equal((await session.json()).user.login,'HafizV1');
});
test('wrong App key/ID or different App refuses OAuth redirect instead of sending user to GitHub',async()=>{
 const env=await appEnv();env.FETCH=async()=>new Response('',{status:401});
 let r=await worker.fetch(new Request(origin+'/api/auth/github'),env);assert.equal(r.status,503);assert.equal(r.headers.get('Location'),null);
 env.FETCH=async()=>Response.json({id:123,slug:'unexpected-app',client_id:'Iv1.some-client'});
 r=await worker.fetch(new Request(origin+'/api/auth/github'),env);assert.equal(r.status,503);
});
