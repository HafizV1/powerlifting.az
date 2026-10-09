import {base64url,unb64} from './security.mjs';
import {KINDS,Problem,fail} from './validation.mjs';
import {renderV1} from './render-v1.mjs';
import {TEST_ID,reportText} from './staging-test.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const caches=new WeakMap();
const requestOf=env=>env.FETCH||fetch;
// GitHub supplies PKCS1 RSA PEM. Wrap its DER in PKCS8 for WebCrypto so an
// account owner can enter the downloaded key directly in Cloudflare secrets.
export function privateKeyBytes(pem){
 const rsa=pem.includes('-----BEGIN RSA PRIVATE KEY-----');
 const raw=unb64(pem.replaceAll('\\n','\n').replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g,''));
 if(!rsa)return raw;
 const der=(tag,bytes)=>{
  let n=bytes.length,a=[];do{a.unshift(n&255);n=Math.floor(n/256);}while(n);
  return new Uint8Array([tag,...(bytes.length<128?[bytes.length]:[128+a.length,...a]),...bytes]);
 };
 const algorithm=[48,13,6,9,42,134,72,134,247,13,1,1,1,5,0];
 return der(48,new Uint8Array([2,1,0,...algorithm,...der(4,raw)]));
}
async function appJWT(env){
 for(const name of ['GITHUB_APP_ID','GITHUB_APP_PRIVATE_KEY'])if(!env[name])fail('GitHub App ID və ya private key konfiqurasiyası yoxdur.',503);
 const header=base64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const now=Math.floor(Date.now()/1000),body=base64url(enc.encode(JSON.stringify({iat:now-60,exp:now+540,iss:String(env.GITHUB_APP_ID).trim()})));
 const key=await crypto.subtle.importKey('pkcs8',privateKeyBytes(env.GITHUB_APP_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const jwt=header+'.'+body+'.'+base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(header+'.'+body))));
 return jwt;
}
export async function oauthClientId(env){
 if(env.STAGING_ONLY!=='true'){
  const id=String(env.GITHUB_CLIENT_ID||'').trim();if(!id)fail('GitHub Client ID yoxdur.',503);return id;
 }
 const jwt=await appJWT(env);
 const response=await requestOf(env)('https://api.github.com/app',{headers:{Authorization:'Bearer '+jwt,Accept:'application/vnd.github+json','User-Agent':'powerlifting-admin-v2','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)fail('GitHub App ID/private key təsdiqlənmədi. Giriş dayandırıldı.',503);
 const app=await response.json();
 if(String(app.id)!==String(env.GITHUB_APP_ID).trim()||app.slug!=='powerlifting-v2-staging-admin'||typeof app.client_id!=='string'||!app.client_id.trim())fail('Gözlənilən staging GitHub App təsdiqlənmədi.',503);
 // GitHub's authenticated response is authoritative; an accidentally entered
 // numeric App ID or installation ID can never become the OAuth client_id.
 return app.client_id.trim();
}
export async function appToken(env){
 const cached=caches.get(env);if(cached&&cached.until>Date.now()+60000)return cached.token;
 for(const name of ['GITHUB_INSTALLATION_ID','GITHUB_REPOSITORY'])if(!env[name])fail('GitHub App konfiqurasiyası tamamlanmayıb.',503);
 const jwt=await appJWT(env);
 const repo=env.GITHUB_REPOSITORY.split('/')[1];
 const response=await requestOf(env)(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,{method:'POST',headers:{Authorization:'Bearer '+jwt,Accept:'application/vnd.github+json','User-Agent':'powerlifting-admin-v2','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({repositories:[repo],permissions:{contents:'write',pull_requests:'write'}}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)fail('GitHub App icazələri və ya açarı düzgün deyil.',503);
 const value=await response.json();if(!value.token)fail('GitHub tokeni alınmadı.',503);
 caches.set(env,{token:value.token,until:Date.parse(value.expires_at)});return value.token;
}
export class GitHubStore{
 constructor(env){this.env=env;this.repo=env.GITHUB_REPOSITORY;this.branch=env.DATA_BRANCH;this.base=env.BASE_BRANCH;}
 async api(path,method='GET',body,optional=false){
  const token=await appToken(this.env);
  const r=await requestOf(this.env)(`https://api.github.com/repos/${this.repo}${path?'/'+path:''}`,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'powerlifting-admin-v2','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  if(optional&&r.status===404)return null;
  if(!r.ok){if([409,422].includes(r.status))throw new Problem(409,'Başqa dəyişiklik saxlanılıb. Səhifəni yeniləyib təkrar yoxlayın.');fail([401,403].includes(r.status)?'GitHub App üçün repozitoriya icazəsi yoxdur.':'GitHub sorğusu uğursuz oldu. Yenidən cəhd edin.',502);}
  return r.status===204?null:r.json();
 }
 async guard(){
  if(this.env.STAGING_ONLY==='true'&&(this.repo!=='HafizV1/powerlifting-v1-preview'||this.base!=='v2/staging-base'||this.env.ENABLE_V1_EXPORT!=='false'))fail('Staging yalnız preview repozitoriyası və söndürülmüş yayım ilə işləyir.',503);
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(this.repo||'')||!/^v2\/content-[a-z0-9-]+$/.test(this.branch||'')||!this.base||this.base===this.branch)fail('Təhlükəsiz məzmun budağı konfiqurasiyası tələb olunur.',503);
  const repo=await this.api('');
  if(this.branch===repo.default_branch||['main','master','gh-pages'].includes(this.branch))fail('İstehsal budağına yazmaq qadağandır.',403);
 }
 async head(branch){return this.api('git/ref/heads/'+encodeURIComponent(branch),'GET',undefined,true);}
 async blob(sha){const blob=await this.api('git/blobs/'+sha);return unb64(blob.content.replace(/\s/g,''));}
 async load(){
  await this.guard();let ref=await this.head(this.branch);const exists=!!ref;
  ref??=await this.head(this.base);if(!ref)fail('Başlanğıc budağı tapılmadı.',503);
  const revision=ref.object.sha,commit=await this.api('git/commits/'+revision),tree=await this.api('git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated)fail('Repozitoriya ağacı çox böyükdür.',503);
  const loaded=await Promise.all(KINDS.map(async kind=>{
   const entry=tree.tree.find(x=>x.path===`content/v2/${kind}.json`&&x.type==='blob');
   if(!entry)fail('V2 məzmun faylları başlanğıc budağında yoxdur.',503);
   const value=JSON.parse(dec.decode(await this.blob(entry.sha)));
   if(!Array.isArray(value))fail('Məzmun faylı zədələnib.',503);
   return [kind,value];
  }));
  const collections=Object.fromEntries(loaded);
  return {collections,revision,tree:commit.tree.sha,exists,entries:tree.tree};
 }
 async save(state,kind,assets,deletions,actor){
  if(!KINDS.includes(kind))fail('Məzmun bölməsi etibarsızdır.');
  await this.guard();const latest=await this.head(this.branch);
  if(latest&&latest.object.sha!==state.revision)throw new Problem(409,'Məlumat dəyişib. Yeniləyib təkrar yoxlayın.');
  if(!latest){
   const base=await this.head(this.base);if(base?.object.sha!==state.revision)throw new Problem(409,'Başlanğıc budağı dəyişib. Məlumatı yeniləyin.');
   await this.api('git/refs','POST',{ref:'refs/heads/'+this.branch,sha:state.revision});
  }
  const path=`content/v2/${kind}.json`;
  const tree=[{path,mode:'100644',type:'blob',content:JSON.stringify(state.collections[kind],null,2)+'\n'}];
  for(const asset of assets){
   if(!/^assets\/uploads\/(news|competitions|albums|protocols|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|pdf|xlsx|xls|csv|docx)$/.test(asset.path))fail('Fayl ünvanı qadağandır.');
   const blob=await this.api('git/blobs','POST',{content:asset.base64,encoding:'base64'});
   tree.push({path:asset.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  for(const path of deletions){if(!/^assets\/uploads\/(news|competitions|albums|protocols|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|pdf|xlsx|xls|csv|docx)$/.test(path))fail('Mənbə faylını silmək qadağandır.');tree.push({path,mode:'100644',type:'blob',sha:null});}
  if(this.env.ENABLE_V1_EXPORT==='true'){
   const base={},names=['xeberler.html','yarislar.html','rekordlar.html','neticeler.html','rekord-qaydalari.html','cempionat-2026-haqqinda.html','kubok-2025-haqqinda.html','kubok-2026-haqqinda.html'];
   await Promise.all(names.map(async name=>{const entry=state.entries.find(x=>x.path===name&&x.type==='blob');if(!entry)fail('V1 ixrac şablonu tapılmadı.',503);base[name]=dec.decode(await this.blob(entry.sha));}));
   const rendered=renderV1(base,state.collections);
   const details=Object.keys(rendered).filter(x=>!['xeberler.html','yarislar.html','rekordlar.html','neticeler.html','rekord-qaydalari.html','qalereya.html'].includes(x));
   const changed={news:['xeberler.html'],competitions:['yarislar.html',...details],protocols:['neticeler.html',...details],albums:['qalereya.html',...details],records:['rekordlar.html'],recordDocuments:['rekord-qaydalari.html']}[kind];
   for(const name of changed){
    if(!rendered[name]||rendered[name]===base[name])continue;
    if(!names.includes(name)&&name!=='qalereya.html'&&!/^yaris-competitions-[a-z0-9-]+\.html$/.test(name))fail('İxrac faylına yazmaq qadağandır.');
    tree.push({path:name,mode:'100644',type:'blob',content:rendered[name]});
   }
  }
  const createdTree=await this.api('git/trees','POST',{base_tree:state.tree,tree});
  const commit=await this.api('git/commits','POST',{message:`V2 ${kind}: ${actor.login} tərəfindən məzmun yenilənməsi`,tree:createdTree.sha,parents:[state.revision]});
  // Non-force fast-forward rejects a concurrent writer; never overwrite their commit.
  await this.api('git/refs/heads/'+encodeURIComponent(this.branch),'PATCH',{sha:commit.sha,force:false});
  return commit.sha;
 }
 async review(){
  await this.guard();const ref=await this.head(this.branch);if(!ref)return null;
  const owner=this.repo.split('/')[0];
  const prs=await this.api('pulls?state=open&head='+encodeURIComponent(owner+':'+this.branch)+'&base='+encodeURIComponent(this.base));
  if(prs.length)return prs[0].html_url;
  const pr=await this.api('pulls','POST',{title:'V2: idarəetmə panelindən məzmun dəyişiklikləri',head:this.branch,base:this.base,draft:true,body:'İdarəetmə paneli tərəfindən hazırlanmış məzmun. Dəyişiklikləri yoxlayın; avtomatik birləşdirmə və yayım yoxdur. V1 faylları və idmançı bazası dəyişdirilmir.'});return pr.html_url;
 }
 async cleanupTest(id,results){
  if(!TEST_ID.test(id)||this.env.STAGING_ONLY!=='true'||this.repo!=='HafizV1/powerlifting-v1-preview'||this.branch!=='v2/content-e2e-'+id||this.base!=='v2/staging-base'||this.env.ENABLE_V1_EXPORT!=='false')fail('Yalnız müvəqqəti sınaq budağı təmizlənə bilər.',403);
  const pending=reportText(id,results,false);await this.guard();
  if(!await this.head(this.branch))return {cleaned:true,url:null};
  const comparison=await this.api('compare/'+encodeURIComponent(this.base)+'...'+encodeURIComponent(this.branch));
  if(!Array.isArray(comparison.files)||comparison.files.some(f=>!/^content\/v2\/(news|competitions|protocols|albums|records|recordDocuments)\.json$/.test(f.filename)&&!/^assets\/uploads\/(news|competitions|albums|protocols|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|pdf|xlsx|xls|csv|docx)$/.test(f.filename)))fail('Sınaqda gözlənilməyən fayl dəyişikliyi var. Avtomatik təmizləmə dayandırıldı.',409);
  const url=await this.review(),owner=this.repo.split('/')[0];
  const prs=await this.api('pulls?state=open&head='+encodeURIComponent(owner+':'+this.branch)+'&base='+encodeURIComponent(this.base));
  for(const pr of prs){
   if(pr.head.ref!==this.branch||pr.base.ref!==this.base||pr.head.repo.full_name!==this.repo||pr.base.repo.full_name!==this.repo||!pr.draft||pr.auto_merge)fail('Sınaq PR yoxlaması uğursuz oldu.',409);
   await this.api('pulls/'+pr.number,'PATCH',{state:'closed',title:'STAGING E2E — '+id,body:pending});
  }
  await this.api('git/refs/heads/'+encodeURIComponent(this.branch),'DELETE');
  for(const pr of prs)await this.api('pulls/'+pr.number,'PATCH',{body:reportText(id,results,true)});
  return {cleaned:true,url,changedFiles:comparison.files.length};
 }
 async asset(path){
  await this.guard();const ref=await this.head(this.branch)||await this.head(this.base);if(!ref)fail('Budaq tapılmadı.',503);
  const commit=await this.api('git/commits/'+ref.object.sha),tree=await this.api('git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated)fail('Repozitoriya ağacı çox böyükdür.',503);
  const entry=tree.tree.find(x=>x.path===path&&x.type==='blob');
  if(!entry)fail('Fayl tapılmadı.',404);return this.blob(entry.sha);
 }
}
