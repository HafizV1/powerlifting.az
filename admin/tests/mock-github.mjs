import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {GitHubStore} from '../src/github.mjs';
import {KINDS} from '../src/validation.mjs';
import {ROOT} from '../scripts/local-server.mjs';
import {createPrivateKey} from 'node:crypto';

export async function mock(pkcs1=false,staging=false){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
 const env={GITHUB_APP_ID:'123',GITHUB_INSTALLATION_ID:'456',GITHUB_APP_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+pkcs8+'\n-----END PRIVATE KEY-----',GITHUB_REPOSITORY:'HafizV1/powerlifting.az',BASE_BRANCH:'feature/v2-admin-panel',DATA_BRANCH:'v2/content-drafts'};
 if(pkcs1)env.GITHUB_APP_PRIVATE_KEY=createPrivateKey(env.GITHUB_APP_PRIVATE_KEY).export({format:'pem',type:'pkcs1'});
 if(staging)Object.assign(env,{STAGING_ONLY:'true',GITHUB_REPOSITORY:'HafizV1/powerlifting-v1-preview',BASE_BRANCH:'v2/staging-base',DATA_BRANCH:'v2/content-staging',ENABLE_V1_EXPORT:'false'});
 const blobs=new Map(),trees=new Map(),commits=new Map(),refs=new Map([['feature/v2-admin-panel','seed'],['main','production']]);
 if(staging){refs.set('v2/staging-base','seed');refs.set('v2/content-staging','seed');}
 const entries=[];for(const kind of KINDS){const sha='blob-'+kind;blobs.set(sha,await readFile(path.join(ROOT,'content/v2',kind+'.json'),'utf8'));entries.push({path:`content/v2/${kind}.json`,mode:'100644',type:'blob',sha});}
 for(const name of ['index.html','idmancilar.html','xeberler.html','yarislar.html','rekordlar.html','neticeler.html','rekord-qaydalari.html','cempionat-2026-haqqinda.html','kubok-2025-haqqinda.html','kubok-2026-haqqinda.html']){const sha='source-'+name;blobs.set(sha,await readFile(path.join(ROOT,name),'utf8'));entries.push({path:name,mode:'100644',type:'blob',sha});}
 // Published content can reference real managed uploads. Seed their blobs too,
 // otherwise releaseReview correctly rejects an incomplete mock repository.
 const managed=new Set([...blobs.values()].flatMap(value=>String(value).match(/assets\/uploads\/(?:news|competitions|protocols|albums|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(?:webp|png|jpg|pdf|xlsx|xls|csv|docx)/g)||[]));
 for(const asset of managed){const sha='source-asset-'+entries.length;blobs.set(sha,await readFile(path.join(ROOT,asset)));entries.push({path:asset,mode:'100644',type:'blob',sha});}
 trees.set('seed-tree',entries);commits.set('seed',{tree:{sha:'seed-tree'}});const writes=[],prs=[];let number=0;
 env.FETCH=async(url,options)=>{
  const input=options.body?JSON.parse(options.body):null,method=options.method||'GET';
  if(url==='https://api.github.com/app/installations/456/access_tokens'){
   const jwt=options.headers.Authorization.slice(7),[header,body,signature]=jwt.split('.');
   assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'RS256');assert.equal(JSON.parse(Buffer.from(body,'base64url')).iss,'123');
   assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(signature,'base64url'),Buffer.from(header+'.'+body)),true);
   assert.deepEqual(input,{repositories:[env.GITHUB_REPOSITORY.split('/')[1]],permissions:{contents:'write',pull_requests:'write'}});
   return Response.json({token:'installation-token-server-only',expires_at:new Date(Date.now()+3600000).toISOString()});
  }
  assert.equal(options.headers.Authorization,'Bearer installation-token-server-only');
  const prefix='https://api.github.com/repos/'+env.GITHUB_REPOSITORY;assert.ok(url.startsWith(prefix));const route=decodeURIComponent(url.slice(prefix.length).replace(/^\//,''));
  if(method!=='GET')writes.push({route,method,input});
  if(!route)return Response.json({default_branch:'main'});
  if(route.startsWith('git/ref/heads/')){const sha=refs.get(route.slice(14));return sha?Response.json({object:{sha}}):new Response('',{status:404});}
  if(method==='GET'&&route.startsWith('git/commits/'))return Response.json(commits.get(route.slice(12)));
  if(method==='GET'&&route.startsWith('git/trees/'))return Response.json({tree:trees.get(route.slice(10).split('?')[0]),truncated:false});
  if(method==='GET'&&route.startsWith('git/blobs/'))return Response.json({content:Buffer.from(blobs.get(route.slice(10))).toString('base64'),encoding:'base64'});
  if(route==='git/refs'&&method==='POST'){const branch=input.ref.slice(11);if(refs.has(branch))return new Response('',{status:422});refs.set(branch,input.sha);return Response.json({ref:input.ref});}
  if(route==='git/blobs'&&method==='POST'){const sha='created-blob-'+ ++number;blobs.set(sha,Buffer.from(input.content,'base64'));return Response.json({sha});}
  if(route==='git/trees'&&method==='POST'){
   const sha='tree-'+ ++number,next=structuredClone(trees.get(input.base_tree));
   for(const entry of input.tree){const i=next.findIndex(x=>x.path===entry.path);if(i>=0)next.splice(i,1);if(entry.sha!==null){const blobSha=entry.sha||'text-'+ ++number;if(entry.content!==undefined)blobs.set(blobSha,entry.content);next.push({...entry,sha:blobSha});}}
   trees.set(sha,next);return Response.json({sha});
  }
  if(route==='git/commits'&&method==='POST'){const sha='commit-'+ ++number;commits.set(sha,{tree:{sha:input.tree},parents:input.parents});return Response.json({sha});}
  if(route.startsWith('git/refs/heads/')&&method==='PATCH'){
   const branch=route.slice(15);assert.equal(input.force,false);
   if(commits.get(input.sha).parents[0]!==refs.get(branch))return new Response('',{status:422});refs.set(branch,input.sha);return Response.json({object:{sha:input.sha}});
  }
  if(route.startsWith('compare/')){const branch=route.split('...')[1],before=trees.get('seed-tree'),after=trees.get(commits.get(refs.get(branch)).tree.sha);return Response.json({files:after.filter(x=>before.find(y=>y.path===x.path)?.sha!==x.sha).map(x=>({filename:x.path}))});}
  if(route.startsWith('git/refs/heads/')&&method==='DELETE'){refs.delete(route.slice(15));return new Response(null,{status:204});}
  const wire=pr=>({...pr,head:{ref:pr.head,repo:{full_name:env.GITHUB_REPOSITORY}},base:{ref:pr.base,repo:{full_name:env.GITHUB_REPOSITORY}}});
  if(route.startsWith('pulls?')){const q=new URL(url).searchParams;return Response.json(prs.filter(pr=>pr.state===q.get('state')&&env.GITHUB_REPOSITORY.split('/')[0]+':'+pr.head===q.get('head')&&pr.base===q.get('base')).map(wire));}
  if(route.startsWith('pulls/')&&method==='PATCH'){const pr=prs.find(p=>p.number===Number(route.slice(6)));Object.assign(pr,input);return Response.json(wire(pr));}
  if(route==='pulls'&&method==='POST'){const pr={html_url:'https://github.com/'+env.GITHUB_REPOSITORY+'/pull/'+(999+prs.length),number:999+prs.length,state:'open',auto_merge:null,...input};prs.push(pr);return Response.json(wire(pr));}
  throw new Error('Unexpected mock API route: '+method+' '+route);
 };
 return {env,refs,writes,prs,blobs,trees,commits,store:new GitHubStore(env)};
}
