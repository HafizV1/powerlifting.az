import {extractTables} from './import/extract.mjs';
import {rowsFromTables,draftImport,approvedRows,applyImport} from './import/review.mjs';
import {digest} from './import/baseline.mjs';
import {KINDS,validate,cleanId,Problem,fail,checkFile,checkSignature} from './validation.mjs';
import {GitHubStore,oauthClientId} from './github.mjs';
import {testScope,TEST_ID} from './staging-test.mjs';
import {sign,verify,cookies,cookie,cookieName,local,origin,authorized,random,securityHeaders,b64} from './security.mjs';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8'};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...securityHeaders(),...JSON_HEADERS,...headers}});
const redirect=(location,cookieValue)=>new Response(null,{status:302,headers:{...securityHeaders(),Location:location,...(cookieValue?{'Set-Cookie':cookieValue}:{})}});
function refs(collections){return new Set(JSON.stringify(collections).match(/assets\/uploads\/[a-zA-Z0-9/_.-]+/g)||[]);}
async function body(request){const bytes=await limited(request,100000);try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('JSON məlumatı düzgün deyil.');}}
async function limited(request,max){
 if(Number(request.headers.get('Content-Length'))>max)fail('Sorğu çox böyükdür.',413);
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let total=0,chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();fail('Sorğu çox böyükdür.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function handle(request,env){
 const url=new URL(request.url);
 try{
  const siteOrigin=origin(env,url),isLocal=local(env,url),name=cookieName(env,url);
  const session=await verify(cookies(request)[name],env.SESSION_SECRET);
  if(url.pathname==='/api/session'&&request.method==='GET')return json(authorized(session,env,url)?{user:{id:session.id,login:session.login},csrf:session.csrf,local:isLocal}:{user:null,local:isLocal});
  const unsafe=!['GET','HEAD'].includes(request.method);
  if(unsafe&&request.headers.get('Origin')!==siteOrigin)fail('Sorğu mənbəyi etibarsızdır.',403);
  if(url.pathname==='/api/auth/check'&&request.method==='GET'){
   const id=await oauthClientId(env);if(env.PRODUCTION_REVIEW_ONLY==='true')await new GitHubStore(env).guard();return json({appVerified:env.STAGING_ONLY==='true'||env.PRODUCTION_REVIEW_ONLY==='true',configuredClientMatches:!!env.GITHUB_CLIENT_ID&&String(env.GITHUB_CLIENT_ID).trim()===id,callback:siteOrigin+'/api/auth/callback',authorizeEndpoint:'https://github.com/login/oauth/authorize',clientSecretPresent:!!env.GITHUB_CLIENT_SECRET,...(env.PRODUCTION_REVIEW_ONLY==='true'?{installationVerified:true}:{})});
  }
  if(url.pathname==='/api/auth/local'&&request.method==='POST'){
   if(!isLocal)fail('Yerli test girişi mövcud deyil.',404);
   const value={id:'local',login:'Yerli test administratoru',local:true,csrf:random(),exp:Date.now()+7200000};
   return json({ok:true},200,{'Set-Cookie':cookie(name,await sign(value,env.SESSION_SECRET),{secure:false})});
  }
  if(url.pathname==='/api/auth/github'&&request.method==='GET'){
   if(!env.GITHUB_CLIENT_SECRET)fail('GitHub giriş konfiqurasiyası tamamlanmayıb.',503);
   const clientId=await oauthClientId(env),state=random();const signed=await sign({state,clientId,exp:Date.now()+600000},env.SESSION_SECRET);
   const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',clientId);auth.searchParams.set('redirect_uri',siteOrigin+'/api/auth/callback');auth.searchParams.set('state',state);
   // GitHub App user authorization uses its configured permissions, not broad repo OAuth scopes.
   return redirect(auth.href,cookie('__Host-pl-oauth',signed,{sameSite:'Lax',maxAge:600}));
  }
  if(url.pathname==='/api/auth/callback'&&request.method==='GET'){
   const state=await verify(cookies(request)['__Host-pl-oauth'],env.SESSION_SECRET);
   if(!state||!state.clientId||state.state!==url.searchParams.get('state')||!url.searchParams.get('code'))fail('Giriş sorğusunun müddəti bitib və ya etibarsızdır.',403);
   const fetcher=env.FETCH||fetch;
   const tokenResponse=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:state.clientId,client_secret:String(env.GITHUB_CLIENT_SECRET).trim(),code:url.searchParams.get('code'),redirect_uri:siteOrigin+'/api/auth/callback'}),signal:AbortSignal.timeout(20000)});
   if(!tokenResponse.ok)fail('GitHub girişi uğursuz oldu.',502);
   const token=await tokenResponse.json();if(!token.access_token)fail('GitHub girişi uğursuz oldu.',403);
   const userResponse=await fetcher('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,'User-Agent':'powerlifting-admin-v2',Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
   if(!userResponse.ok)fail('GitHub istifadəçisi yoxlanılmadı.',502);
   const user=await userResponse.json(),value={id:String(user.id),login:user.login,csrf:random(),exp:Date.now()+7200000};
   if(!authorized(value,env,url))fail('Bu istifadəçinin idarəetmə icazəsi yoxdur.',403);
   // Only identity claims enter the signed session. OAuth/GitHub App tokens never enter browser storage.
   const response=redirect('/',cookie(name,await sign(value,env.SESSION_SECRET)));
   response.headers.append('Set-Cookie',cookie('__Host-pl-oauth','',{sameSite:'Lax',maxAge:0}));return response;
  }
  if(!authorized(session,env,url))fail('İdarəetmə üçün daxil olun.',401);
  if(unsafe&&request.headers.get('X-CSRF-Token')!==session.csrf)fail('Təhlükəsizlik yoxlaması uğursuz oldu. Yenidən daxil olun.',403);
  if(url.pathname==='/api/auth/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie(name,'',{secure:!isLocal,maxAge:0})});
  const scope=testScope(request,env),store=env.LOCAL_STORE||new GitHubStore(scope.env);
  if(url.pathname==='/api/e2e/cleanup'&&request.method==='POST'){
   if(!scope.id)fail('Sınaq identifikatoru tələb olunur.',403);
   const data=await body(request);return json(await store.cleanupTest(scope.id,data.results));
  }
  if(url.pathname==='/api/content'&&request.method==='GET'){
   const state=await store.load();return json({collections:state.collections,revision:state.revision,local:isLocal,renderingEnabled:env.ENABLE_V1_EXPORT==='true',stagingTest:scope.id,...(env.PRODUCTION_REVIEW_ONLY==='true'?{reviewMode:'production'}:{})});
  }
  if(url.pathname==='/api/import/baseline'&&request.method==='GET'){
   const b=await store.baseline();return json({sourceRevision:b.revision,athletes:b.athletes.map((a,index)=>({index,name:a.name,gender:a.gender})),resultCount:b.results.length});
  }
  const importRoute=url.pathname.match(/^\/api\/import\/([a-z0-9-]+)\/(extract|approve)$/);
  if(importRoute&&request.method==='POST'){
   const state=await store.load();if(request.headers.get('If-Match')!==state.revision)fail('Məlumat dəyişib. Yeniləyin.',409);
   const item=state.collections.protocols.find(x=>x.id===importRoute[1]);if(!item?.file)fail('Əvvəl protokol faylını yükləyin.',404);
   const competition=state.collections.competitions.find(x=>x.id===item.competitionId);if(!competition)fail('Yarış tapılmadı.');
   const bytes=await store.asset(item.file.path),sourceHash=await digest(bytes),baseline=await store.baseline();
   const input=await body(request);if(!input||typeof input!=='object'||Array.isArray(input))fail('Məlumat obyekti tələb olunur.');const context={competitionId:competition.id,competition:competition.name,year:Number(competition.startDate.slice(0,4)),date:competition.dateText||competition.startDate,sport:item.sport};
   if(importRoute[2]==='extract'){
    let parsed;try{parsed=await extractTables(bytes,item.file.name,item.file.name.toLowerCase().endsWith('.pdf')?async()=>{if(!Array.isArray(input.pdfTables)||input.pdfTables.length>100||input.pdfTables.some(t=>!t||typeof t.name!=='string'||!Array.isArray(t.rows)||t.rows.some(r=>!Array.isArray(r)||r.some(c=>typeof c!=='string'||c.length>1000))))throw Error('PDF mətn cədvəlləri düzgün deyil.');return input.pdfTables;}:undefined);}catch(e){fail(e.message);}
    let found;try{found=rowsFromTables(parsed.tables,input.mapping);}catch(e){fail(e.message);}if(found.unmapped.length)fail('Bütün cədvəlləri uyğunlaşdırın: '+found.unmapped.join(', '));
    let draft;try{draft=draftImport(found.rows,context,baseline.athletes,state.collections.records);}catch(e){fail(e.message);}
    const hash=await digest(JSON.stringify({sourceHash,baseline:baseline.revision,draft}));
    item.importReview={draft,sourceHash,baseline:baseline.revision,hash,pdfClientExtracted:parsed.format==='pdf',approved:null};
   }else{
    const review=item.importReview;if(!review||input.hash!==review.hash||sourceHash!==review.sourceHash||baseline.revision!==review.baseline||JSON.stringify(context)!==JSON.stringify(review.draft.context))fail('Mənbə və ya yarış dəyişib. Yenidən analiz edin.',409);
    let rows;try{rows=approvedRows(review.draft,input.decisions,baseline.athletes);applyImport(baseline,review.draft,rows);}catch(e){fail(e.message);}
    review.approved={rows,actor:{id:session.id,login:session.login},at:new Date().toISOString(),sourceHash,reviewHash:review.hash};
   }
   const revision=await store.save(state,'protocols',[],[],session);return json({review:item.importReview,revision,reviewNeeded:true});
  }
  if(url.pathname==='/api/release/review'&&request.method==='POST'){const state=await store.load();if(request.headers.get('If-Match')!==state.revision)fail('Məlumat dəyişib. Yeniləyin.',409);if(!store.releaseReview)fail('GitHub staging mühiti tələb olunur.',400);return json(await store.releaseReview(state,session));}
  if(url.pathname==='/api/review'&&request.method==='POST')return json({url:await store.review()});
  if(url.pathname==='/api/assets'&&request.method==='GET'){
   const path=url.searchParams.get('path')||'';
   if(!/^(assets\/uploads\/[a-zA-Z0-9/_.-]+|assets\/images\/[a-zA-Z0-9_.-]+)$/.test(path)||path.includes('..'))fail('Fayl ünvanı etibarsızdır.');
   const ext=path.split('.').pop(),types={webp:'image/webp',png:'image/png',jpg:'image/jpeg',pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
   if(!types[ext])fail('Fayl növü dəstəklənmir.');
   return new Response(await store.asset(path),{headers:{...securityHeaders(),'Content-Type':types[ext],...(!types[ext].startsWith('image/')?{'Content-Disposition':'attachment; filename="'+path.split('/').pop()+'"'}:{})}});
  }
  const match=url.pathname.match(/^\/api\/content\/([A-Za-z]+)(?:\/([a-z0-9-]+))?(?:\/photos\/([a-z0-9-]+))?$/);
  const upload=url.pathname==='/api/uploads'&&request.method==='POST';
  if(!match&&!upload)fail('Sorğu tapılmadı.',404);
  if(!unsafe)fail('Sorğu üsulu dəstəklənmir.',405);
  const state=await store.load();
  if(request.headers.get('If-Match')!==state.revision)fail('Məlumat dəyişib. Yeniləyib təkrar yoxlayın.',409);
  const before=refs(state.collections),assets=[];let kind,item;
  if(upload){
   const bytes=await limited(request,15*1024*1024);
   const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('Content-Type')||''},body:bytes}).formData();
   kind=form.get('kind');const id=cleanId(String(form.get('id')||''));
   if(!['news','competitions','protocols','albums','recordDocuments'].includes(kind))fail('Bu bölməyə fayl yüklənmir.');
   item=state.collections[kind].find(x=>x.id===id);if(!item)fail('Əvvəlcə məlumatı saxlayın.',404);
   const files=form.getAll('files');if(!files.length||files.length>(kind==='albums'?20:1))fail('Fayl sayını yoxlayın (albom üçün ən çox 20).');
   for(const file of files){
    const info=checkFile(file,kind),bytes=new Uint8Array(await file.arrayBuffer());checkSignature(bytes,info.ext);
    const assetId=random(),path=`assets/uploads/${kind}/${id}/${assetId}.${info.ext}`;
    // Use chunks to avoid overflowing the JS argument stack on multi-megabyte uploads.
    let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    assets.push({path,base64:btoa(binary)});
    if(kind==='albums')item.photos.push({id:assetId,path,alt:'',caption:''});
    else if(info.image)item.image=path;
    else {delete item.importReview;item.file={path,name:file.name.replace(/[\u0000-\u001f\/\\]/g,'_').slice(0,200),mime:info.mime,size:file.size};}
   }
  }else{
   [,kind]=match;if(!KINDS.includes(kind))fail('Bölmə tapılmadı.',404);
   const id=match[2]?cleanId(match[2]):null,index=state.collections[kind].findIndex(x=>x.id===id);
   if(match[3]){
    if(kind!=='albums'||index<0)fail('Albom tapılmadı.',404);item=state.collections.albums[index];
    const photo=item.photos.find(x=>x.id===match[3]);if(!photo)fail('Şəkil tapılmadı.',404);
    if(request.method==='DELETE')item.photos=item.photos.filter(x=>x.id!==photo.id);
    else if(request.method==='PATCH'){const input=await body(request);if(Object.keys(input).some(x=>!['alt','caption'].includes(x)))fail('Şəkil sahəsi etibarsızdır.');for(const key of ['alt','caption'])if(key in input){if(typeof input[key]!=='string'||input[key].length>1000)fail('Şəkil mətni çox uzundur.');photo[key]=input[key].trim();}}
    else fail('Sorğu üsulu dəstəklənmir.',405);
   }else if(request.method==='POST'&&!id){
    item=validate(kind,await body(request),{},state.collections);item.id=kind.toLowerCase()+'-'+random();
    state.collections[kind].push(item);
   }else if(request.method==='PATCH'&&index>=0){
    const previous=state.collections[kind][index];item=validate(kind,await body(request),previous,state.collections);if(kind==='protocols'&&(item.competitionId!==previous.competitionId||item.sport!==previous.sport))delete item.importReview;state.collections[kind][index]=item;
   }else if(request.method==='DELETE'&&index>=0){
    if(kind==='records')fail('Rekord kateqoriyası silinmir. Rekord məlumatını redaktə edin.',403);
    if(kind==='competitions'&&['protocols','albums'].some(k=>state.collections[k].some(x=>x.competitionId===id)))fail('Əvvəlcə yarışın albom və protokol əlaqələrini dəyişin.',409);
    state.collections[kind].splice(index,1);
   }else fail('Məlumat və ya sorğu üsulu tapılmadı.',404);
  }
  const after=refs(state.collections),deletions=[...before].filter(x=>!after.has(x));
  const revision=await store.save(state,kind,assets,deletions,session);
  return json({item,revision,reviewNeeded:true},request.method==='POST'?201:200);
 }catch(error){
  return json({error:error instanceof Problem?error.message:'Xidmət konfiqurasiyasını və bağlantını yoxlayın.',...(error instanceof Problem?{}:{code:'CONFIGURATION_OR_UPSTREAM_FAILURE'})},error instanceof Problem?error.status:503);
 }
}
export default {async fetch(request,env){
 if(new URL(request.url).pathname.startsWith('/api/'))return handle(request,env);
 const response=await env.ASSETS.fetch(request);
 const secured=new Response(response.body,response);for(const [key,value] of Object.entries(securityHeaders()))secured.headers.set(key,value);
 const url=new URL(request.url);
 if(env.STAGING_ONLY==='true'&&url.pathname==='/index.html'&&TEST_ID.test(url.searchParams.get('stagingTest')||''))secured.headers.set('Content-Security-Policy',securityHeaders()['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'"));
 return secured;
}};
