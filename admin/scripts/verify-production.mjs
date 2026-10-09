// Read-only checks; run by authorized Cloudflare Builds, never log secrets/cookies.
import assert from 'node:assert/strict';
import worker from '../docs/production-deploy/worker.mjs';
const origin='https://powerlifting-admin-v2-production.powerlifting-aze-482.workers.dev';
const expected=await (await worker.fetch(new Request(origin+'/api/health'),{})).json();
const get=path=>fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
async function checks(){
const health=await get('/api/health');assert.equal(health.status,200);const actual=await health.json();assert.equal(actual.service,expected.service);assert.equal(actual.build,expected.build);
for(const path of ['/','/admin.js','/admin.css','/imports.html','/imports.js','/pdf.mjs','/pdf.worker.mjs']){const response=await get(path);assert.equal(response.status,200);assert.equal(response.headers.get('X-Admin-Build'),expected.build);}
for(const path of ['/api/content','/api/import/baseline','/api/release/review'])assert.equal((await get(path)).status,401);
for(const path of ['/e2e.html','/e2e.js'])assert.equal((await get(path)).status,404);
if(!actual.configured){return false;}
else{const response=await get('/api/auth/check');assert.equal(response.status,200);const checked=await response.json();assert.equal(checked.appVerified,true);assert.equal(checked.installationVerified,true);assert.equal(checked.callback,origin+'/api/auth/callback');const login=await get('/api/auth/github');assert.equal(login.status,302);const url=new URL(login.headers.get('Location'));assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/login/oauth/authorize');assert.equal(url.searchParams.get('redirect_uri'),checked.callback);assert.ok(url.searchParams.get('client_id'));assert.match(login.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);return true;}

}
let result;for(let attempt=0;attempt<3;attempt++){try{result=await checks();break;}catch{if(attempt<2)await new Promise(r=>setTimeout(r,5000));}}
if(result===undefined)throw Error('Production smoke checks failed; inspect configuration securely. No response values logged.');
console.log(result?'PRODUCTION_SMOKE_OK: assets, scoped App installation, OAuth redirect and access boundaries verified. No content written. Real user OAuth still needs browser authorization.':'PRODUCTION_AUTHORIZATION_PENDING: deployed fail-closed; configure the three production App secrets. No content written.');
