// Build entry only: existing V2 backend/UI, with assets embedded for the
// Cloudflare dashboard editor. No credentials or alternate CMS are included.
import worker from '../src/worker.mjs';
import {BROWSER_ASSETS,BROWSER_BUILD} from './browser-worker-assets.generated.mjs';
import {securityHeaders} from '../src/security.mjs';
const ORIGIN='https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev';
export default {async fetch(request,bindings){
 if(new URL(request.url).pathname==='/api/health')return Response.json({service:'powerlifting-v2-staging',build:BROWSER_BUILD},{headers:securityHeaders()});
 const env={...bindings,PUBLIC_ORIGIN:ORIGIN,ADMIN_USER_IDS:'335450583',STAGING_ONLY:'true',GITHUB_REPOSITORY:'HafizV1/powerlifting-v1-preview',BASE_BRANCH:'v2/staging-base',DATA_BRANCH:'v2/content-staging',ENABLE_V1_EXPORT:'false'};
 // Separate session signing key derived with HKDF from the server-only OAuth
 // client secret. Optional dedicated SESSION_SECRET overrides this fallback.
 // Nothing is generated/stored in the browser; this stable key spans isolates.
 if(!env.SESSION_SECRET&&env.GITHUB_CLIENT_SECRET){
  const bytes=new TextEncoder(),material=await crypto.subtle.importKey('raw',bytes.encode(env.GITHUB_CLIENT_SECRET),'HKDF',false,['deriveBits']);
  const key=await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:bytes.encode(ORIGIN),info:bytes.encode('powerlifting-v2-staging/session-signing/v1')},material,384);
  env.SESSION_SECRET=Array.from(new Uint8Array(key),x=>x.toString(16).padStart(2,'0')).join('');
 }
 env.ASSETS={async fetch(req){
  const path=new URL(req.url).pathname,asset=BROWSER_ASSETS[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});
  return new Response(req.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type}});
 }};
 const result=await worker.fetch(request,env);
 const response=new Response(result.body,result);response.headers.set('X-Admin-Build',BROWSER_BUILD);return response;
}};
