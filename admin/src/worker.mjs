import {KINDS,validate,cleanId,Problem,fail,checkFile,checkSignature} from './validation.mjs';
import {GitHubStore} from './github.mjs';
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
  if(url.pathname==='/api/auth/local'&&request.method==='POST'){
   if(!isLocal)fail('Yerli test girişi mövcud deyil.',404);
   const value={id:'local',login:'Yerli test administratoru',local:true,csrf:random(),exp:Date.now()+7200000};
   return json({ok:true},200,{'Set-Cookie':cookie(name,await sign(value,env.SESSION_SECRET),{secure:false})});
  }
  if(url.pathname==='/api/auth/github'&&request.method==='GET'){
   if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)fail('GitHub giriş konfiqurasiyası tamamlanmayıb.',503);
   const state=random();const signed=await sign({state,exp:Date.now()+600000},env.SESSION_SECRET);
   const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',env.GITHUB_CLIENT_ID);auth.searchParams.set('redirect_uri',siteOrigin+'/api/auth/callback');auth.searchParams.set('state',state);
   // GitHub App user authorization uses its configured permissions, not broad repo OAuth scopes.
   return redirect(auth.href,cookie('__Host-pl-oauth',signed,{sameSite:'Lax',maxAge:600}));
  }
  if(url.pathname==='/api/auth/callback'&&request.method==='GET'){
   const state=await verify(cookies(request)['__Host-pl-oauth'],env.SESSION_SECRET);
   if(!state||state.state!==url.searchParams.get('state')||!url.searchParams.get('code'))fail('Giriş sorğusunun müddəti bitib və ya etibarsızdır.',403);
   const fetcher=env.FETCH||fetch;
   const tokenResponse=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:siteOrigin+'/api/auth/callback'}),signal:AbortSignal.timeout(20000)});
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
  const store=env.LOCAL_STORE||new GitHubStore(env);
  if(url.pathname==='/api/content'&&request.method==='GET'){
   const state=await store.load();return json({collections:state.collections,revision:state.revision,local:isLocal,renderingEnabled:env.ENABLE_V1_EXPORT==='true'});
  }
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
    else item.file={path,name:file.name.replace(/[\u0000-\u001f\/\\]/g,'_').slice(0,200),mime:info.mime,size:file.size};
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
    item=validate(kind,await body(request),state.collections[kind][index],state.collections);state.collections[kind][index]=item;
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
 const secured=new Response(response.body,response);for(const [key,value] of Object.entries(securityHeaders()))secured.headers.set(key,value);return secured;
}};
