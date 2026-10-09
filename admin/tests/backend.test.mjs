import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {LocalStore} from '../scripts/local-server.mjs';
import {handle} from '../src/worker.mjs';
import {sign,verify} from '../src/security.mjs';
import {validate} from '../src/validation.mjs';
const SECRET='test-session-key-with-at-least-32-bytes';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=','base64');
async function harness(){
 const dir=await mkdtemp(path.join(tmpdir(),'pl-admin-test-')),store=await new LocalStore(dir).init();
 const env={LOCAL_STORE:store,PUBLIC_ORIGIN:'http://127.0.0.1:8787',SESSION_SECRET:SECRET};
 let cookie='',csrf='',revision='';
 async function call(route,method='GET',body,options={}){
  const headers={Cookie:cookie,...(method==='GET'?{}:{Origin:env.PUBLIC_ORIGIN,'X-CSRF-Token':csrf,'If-Match':revision}),...options.headers};
  let payload=body;if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
  const r=await handle(new Request(env.PUBLIC_ORIGIN+route,{method,headers,...(payload?{body:payload}:{})}),env);
  if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];
  const contentType=r.headers.get('Content-Type'),data=contentType?.startsWith('application/json')?await r.json():new Uint8Array(await r.arrayBuffer());
  if(data.csrf)csrf=data.csrf;if(data.revision)revision=data.revision;return {status:r.status,data,headers:r.headers};
 }
 await call('/api/auth/local','POST');await call('/api/session');await call('/api/content');
 return {call,store,dir,env,setRevision:r=>revision=r,close:()=>rm(dir,{recursive:true,force:true})};
}
test('news create/edit/publish/unpublish/delete and concurrent revision conflict',async()=>{
 const h=await harness();try{
  let r=await h.call('/api/content/news','POST',{title:'Test xəbər (sınaq)',body:'Yalnız müvəqqəti sınaq məlumatı.',status:'draft'});assert.equal(r.status,201);const id=r.data.item.id,old=r.data.revision;
  r=await h.call('/api/content/news/'+id,'PATCH',{title:'Redaktə edilmiş sınaq',status:'published'});assert.equal(r.status,200);
  r=await h.call('/api/content/news/'+id,'PATCH',{title:'Stale overwrite'},{headers:{'If-Match':old}});assert.equal(r.status,409);
  r=await h.call('/api/content/news/'+id,'PATCH',{status:'draft'});assert.equal(r.status,200);
  r=await h.call('/api/content/news/'+id,'DELETE');assert.equal(r.status,200);assert.equal((await h.store.load()).collections.news.length,1);
 }finally{await h.close();}
});
test('bulk gallery upload, metadata editing and removal persist optimized file references',async()=>{
 const h=await harness();try{
  let r=await h.call('/api/content/albums','POST',{title:'Sınaq albomu',status:'draft'});const id=r.data.item.id;
  const form=new FormData();form.set('kind','albums');form.set('id',id);for(let i=0;i<2;i++)form.append('files',new File([PNG],'test.png',{type:'image/png'}));
  r=await h.call('/api/uploads','POST',form);assert.equal(r.status,201);assert.equal(r.data.item.photos.length,2);
  const photo=r.data.item.photos[0];assert.match(photo.path,/^assets\/uploads\/albums\//);assert.deepEqual(Buffer.from(await h.store.asset(photo.path)),PNG);
  r=await h.call(`/api/content/albums/${id}/photos/${photo.id}`,'PATCH',{alt:'Test alternativ mətn',caption:'Sınaq izahı'});assert.equal(r.status,200);
  assert.equal(r.data.item.photos[0].caption,'Sınaq izahı');
  r=await h.call(`/api/content/albums/${id}/photos/${photo.id}`,'DELETE');assert.equal(r.data.item.photos.length,1);
  await assert.rejects(()=>readFile(path.join(h.dir,photo.path)));
  const reloaded=await new LocalStore(h.dir).init();assert.equal((await reloaded.load()).collections.albums[0].photos.length,1);
 }finally{await h.close();}
});
test('competition protocols retain sport, validate documents, protect relationships',async()=>{
 const h=await harness();try{
  const state=await h.store.load(),competitionId=state.collections.competitions[0].id;
  let r=await h.call('/api/content/protocols','POST',{title:'Sınaq protokolu',competitionId,sport:'Benç-press',status:'draft'});assert.equal(r.status,201);const id=r.data.item.id;
  r=await h.call('/api/content/protocols/'+id,'PATCH',{status:'published'});assert.equal(r.status,400);
  const form=new FormData();form.set('kind','protocols');form.set('id',id);form.append('files',new File(['%PDF-1.7\nTest only\n%%EOF'],'test.pdf',{type:'application/pdf'}));
  r=await h.call('/api/uploads','POST',form);assert.equal(r.status,201);assert.equal(r.data.item.sport,'Benç-press');
  const response=await h.call('/api/assets?path='+encodeURIComponent(r.data.item.file.path));assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/^attachment/);
  r=await h.call('/api/content/protocols/'+id,'PATCH',{status:'published'});assert.equal(r.status,200);
  r=await h.call('/api/content/competitions/'+competitionId,'DELETE');assert.equal(r.status,409);
  r=await h.call('/api/content/competitions/'+competitionId,'PATCH',{venue:'Sınaq məkanı'});assert.equal(r.status,200);
  r=await h.call('/api/content/protocols/'+id,'DELETE');assert.equal(r.status,200);
 }finally{await h.close();}
});
test('records preserve all categories and reject deletion/duplicates; record documents upload',async()=>{
 const h=await harness();try{
  let state=await h.store.load();const count=state.collections.records.length,record=state.collections.records[0];
  let r=await h.call('/api/content/records/'+record.id,'PATCH',{athlete:'Sınaq adı',record:170,event:'Yalnız sınaq',status:'Müvəqqəti Rekord'});assert.equal(r.status,200);
  r=await h.call('/api/content/records/'+record.id,'DELETE');assert.equal(r.status,403);
  const {id,...duplicate}=record;r=await h.call('/api/content/records','POST',duplicate);assert.equal(r.status,400);
  assert.equal((await h.store.load()).collections.records.length,count);
  r=await h.call('/api/content/recordDocuments','POST',{title:'Sınaq sənədi',status:'draft'});assert.equal(r.status,201);
  const docId=r.data.item.id,form=new FormData();form.set('kind','recordDocuments');form.set('id',docId);form.append('files',new File(['a,b\n1,2\n'],'test.csv',{type:'text/csv'}));
  r=await h.call('/api/uploads','POST',form);assert.equal(r.status,201);assert.equal(r.data.item.file.mime,'text/csv');
 }finally{await h.close();}
});
test('authentication, signed sessions, CSRF and same-origin enforce access boundaries',async()=>{
 const env={PUBLIC_ORIGIN:'https://admin.example',SESSION_SECRET:SECRET,ADMIN_USER_IDS:'42'};
 let r=await handle(new Request('https://admin.example/api/content'),env);assert.equal(r.status,401);
 r=await handle(new Request('https://admin.example/api/auth/local',{method:'POST',headers:{Origin:'https://admin.example'}}),env);assert.equal(r.status,404);
 const token=await sign({id:'42',login:'allowed',csrf:'csrf-test',exp:Date.now()+60000},SECRET),cookie='__Host-pl-admin='+token;
 r=await handle(new Request('https://admin.example/api/review',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.example','X-CSRF-Token':'csrf-test'}}),env);assert.equal(r.status,403);
 r=await handle(new Request('https://admin.example/api/review',{method:'POST',headers:{Cookie:cookie,Origin:'https://admin.example','X-CSRF-Token':'wrong'}}),env);assert.equal(r.status,403);
 r=await handle(new Request('https://admin.example/api/session',{headers:{Cookie:cookie}}),{...env,ADMIN_USER_IDS:'99'});assert.equal((await r.json()).user,null);
 assert.equal(await verify(token+'tampered',SECRET),null);assert.equal(await verify(await sign({exp:0},SECRET),SECRET),null);
 const localToken=await sign({id:'local',local:true,exp:Date.now()+60000},SECRET);
 r=await handle(new Request('https://admin.example/api/session',{headers:{Cookie:'__Host-pl-admin='+localToken}}),env);assert.equal((await r.json()).user,null);
});
test('unsafe uploads and path traversal rejected before storage changes',async()=>{
 const h=await harness();try{
  let r=await h.call('/api/content/albums','POST',{title:'Sınaq',status:'draft'});const id=r.data.item.id;
  for(const [name,type,data] of [['bad.svg','image/svg+xml','<svg onload="alert(1)"></svg>'],['bad.png','image/png','<html>bad</html>'],['bad.html','text/html','<script>']]){
   const form=new FormData();form.set('kind','albums');form.set('id',id);form.append('files',new File([data],name,{type}));r=await h.call('/api/uploads','POST',form);assert.equal(r.status,400);
  }
  r=await h.call('/api/assets?path='+encodeURIComponent('assets/images/../../CNAME'));assert.equal(r.status,400);
  r=await h.call('/api/content/athletes','POST',{name:'Not allowed'});assert.equal(r.status,404);
  r=await h.call('/api/content/news','POST',{title:'X',body:'X',image:'https://evil.example/x.svg'});assert.equal(r.status,400);
  r=await h.call('/api/uploads','POST','x',{headers:{'Content-Length':String(16*1024*1024)}});assert.equal(r.status,413);
  assert.equal((await h.store.load()).collections.albums[0].photos.length,0);
 }finally{await h.close();}
});
test('date/schema validation and every imported record remain compatible',async()=>{
 const h=await harness();try{
  const {collections}=await h.store.load();for(const old of collections.records)assert.deepEqual(validate('records',{},old,collections),old);
  let r=await h.call('/api/content/competitions','POST',{name:'Sınaq',startDate:'2026-02-30',endDate:'2026-03-01',sports:['Pauerliftinq']});assert.equal(r.status,400);
  r=await h.call('/api/content/news','POST',{title:'',body:'x'});assert.equal(r.status,400);
  r=await h.call('/api/content/news','POST',{title:'x',body:''});assert.equal(r.status,400);
 }finally{await h.close();}
});
test('OAuth state and admin allowlist; OAuth tokens stay server-side',async()=>{
 const env={PUBLIC_ORIGIN:'https://admin.example',SESSION_SECRET:SECRET,ADMIN_USER_IDS:'42',GITHUB_CLIENT_ID:'client-id',GITHUB_CLIENT_SECRET:'client-secret',FETCH:async(url,options)=>{
  if(url==='https://github.com/login/oauth/access_token'){assert.equal(JSON.parse(options.body).client_secret,'client-secret');return Response.json({access_token:'server-only-oauth-secret'});}
  if(url==='https://api.github.com/user'){assert.equal(options.headers.Authorization,'Bearer server-only-oauth-secret');return Response.json({id:42,login:'allowed'});}throw new Error('Unexpected URL');
 }};
 let r=await handle(new Request(env.PUBLIC_ORIGIN+'/api/auth/github'),env);assert.equal(r.status,302);
 const state=new URL(r.headers.get('Location')).searchParams.get('state'),cookie=r.headers.get('Set-Cookie').split(';')[0];assert.match(r.headers.get('Set-Cookie'),/Secure; SameSite=Lax/);
 r=await handle(new Request(env.PUBLIC_ORIGIN+'/api/auth/callback?state=wrong&code=x',{headers:{Cookie:cookie}}),env);assert.equal(r.status,403);
 r=await handle(new Request(env.PUBLIC_ORIGIN+'/api/auth/callback?state='+state+'&code=x',{headers:{Cookie:cookie}}),env);assert.equal(r.status,302);
 assert.ok(!r.headers.get('Set-Cookie').includes('server-only-oauth-secret'));assert.ok(!r.headers.get('Set-Cookie').includes('client-secret'));assert.match(r.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const denied=await handle(new Request(env.PUBLIC_ORIGIN+'/api/auth/callback?state='+state+'&code=x',{headers:{Cookie:cookie}}),{...env,ADMIN_USER_IDS:'99'});assert.equal(denied.status,403);
});
test('authenticated protocol import extracts uploaded XLSX, requires row approval and invalidates changed source',async()=>{
 const {spreadsheet}=await import('./fixtures/protocols.mjs'),h=await harness();try{
  let r=await h.call('/api/content/competitions','POST',{name:'STAGING ONLY — IMPORT TEST',startDate:'2099-01-01',endDate:'2099-01-01',sports:['Pauerliftinq'],status:'draft'});const competitionId=r.data.item.id;
  r=await h.call('/api/content/protocols','POST',{title:'STAGING ONLY protocol',competitionId,sport:'Pauerliftinq',status:'draft'});const id=r.data.item.id;
  const upload=()=>{const f=new FormData();f.set('kind','protocols');f.set('id',id);f.append('files',new File([spreadsheet()],'test.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));return f;};
  assert.equal((await h.call('/api/uploads','POST',upload())).status,201);
  const athleteResponse=await h.call('/api/import/baseline');assert.equal(athleteResponse.data.athletes.length,208);
  r=await h.call('/api/import/'+id+'/extract','POST',{});assert.equal(r.status,200);const review=r.data.review;
  r=await h.call('/api/import/'+id+'/approve','POST',{hash:review.hash,decisions:[]});assert.equal(r.status,400);
  r=await h.call('/api/import/'+id+'/approve','POST',{hash:review.hash,decisions:review.draft.rows.map(row=>({action:'new',note:'Synthetic staging review',acknowledge:true}))});assert.equal(r.status,200);assert.equal(r.data.review.approved.rows.length,1);assert.equal(r.data.review.approved.actor.id,'local');
  await h.call('/api/uploads','POST',upload());const state=await h.store.load();assert.equal(state.collections.protocols.find(p=>p.id===id).importReview,undefined);
  r=await h.call('/api/import/'+id+'/approve','POST',{hash:review.hash,decisions:[]});assert.equal(r.status,409);
  assert.equal((await h.call('/api/release/review','POST')).status,400);
 }finally{await h.close();}
});
