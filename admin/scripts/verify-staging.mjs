// Read-only smoke checks from Cloudflare Builds. No cookies, OAuth codes,
// GitHub credentials, content writes or full response bodies are logged.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../docs/browser-deploy/worker.mjs';
const origin='https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev';
const expected=await (await worker.fetch(new Request(origin+'/api/health'),{})).json();
const fetchSafe=path=>fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'powerlifting-v2-staging-smoke'}});
async function checks(){
 for(const [path,file] of [['/','index.html'],['/admin.js','admin.js'],['/admin.css','admin.css'],['/e2e.html','e2e.html'],['/e2e.js','e2e.js'],['/e2e-fixtures.js','e2e-fixtures.js'],['/imports.html','imports.html'],['/imports.js','imports.js'],['/pdf.mjs','../node_modules/pdfjs-dist/build/pdf.mjs'],['/pdf.worker.mjs','../node_modules/pdfjs-dist/build/pdf.worker.mjs']]){
  const r=await fetchSafe(path);assert.equal(r.status,200);assert.equal(await r.text(),await readFile(new URL('../public/'+file,import.meta.url),'utf8'));assert.equal(r.headers.get('X-Admin-Build'),expected.build);
 }
 const health=await fetchSafe('/api/health');assert.equal(health.status,200);assert.deepEqual(await health.json(),expected);
 const session=await fetchSafe('/api/session');assert.equal(session.status,200);assert.deepEqual(await session.json(),{user:null,local:false});
 const content=await fetchSafe('/api/content');assert.equal(content.status,401);
 for(const path of ['/api/import/baseline','/api/import/test/extract','/api/release/review'])assert.equal((await fetchSafe(path)).status,401);
 const cleanup=await fetchSafe('/api/e2e/cleanup');assert.equal(cleanup.status,401);
 const check=await fetchSafe('/api/auth/check');assert.equal(check.status,200);const safe=await check.json();assert.equal(safe.appVerified,true);assert.equal(safe.clientSecretPresent,true);assert.equal(safe.callback,origin+'/api/auth/callback');
 const login=await fetchSafe('/api/auth/github');assert.equal(login.status,302);const url=new URL(login.headers.get('Location'));assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/login/oauth/authorize');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/auth/callback');assert.ok(url.searchParams.get('client_id'));assert.ok(url.searchParams.get('state'));assert.match(login.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
}
let passed=false;
for(let attempt=0;attempt<3;attempt++){
 try{await checks();passed=true;break;}catch{
  // Short propagation delay; never print assertion response values/cookies.
  if(attempt<2)await new Promise(r=>setTimeout(r,5000));
 }
}
if(!passed)throw new Error('Staging smoke check failed. Inspect deployment/version and configuration securely; no response values logged.');
console.log('STAGING_SMOKE_OK: matching build/assets, unauthenticated access denied, App verified, secure GitHub redirect. No content written.');
