// Server-side maintainer adapter. Uses the existing Codex GitHub connection only.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {GitHubStore} from '../src/github.mjs';
import {validate,cleanId,checkFile,checkSignature} from '../src/validation.mjs';
export function allowedOperation(path,method,body={}) {
 if(method==='GET')return true;
 if(method==='POST'&&['git/blobs','git/trees','git/commits'].includes(path))return true;
 if(method==='POST'&&path==='git/refs')return /^refs\/heads\/(v2\/content-production|v2\/release-production-[a-f0-9-]+)$/.test(body.ref||'');
 if(method==='PATCH'&&path==='git/refs/heads/v2%2Fcontent-production')return body.force===false;
 if(method==='POST'&&path==='pulls')return body.base==='main'&&body.draft===true&&/^v2\/release-production-[a-f0-9-]+$/.test(body.head||'');
 return false;
}
export class ConnectedStore extends GitHubStore {
 constructor(){super({PRODUCTION_REVIEW_ONLY:'true',STAGING_ONLY:'false',GITHUB_REPOSITORY:'HafizV1/powerlifting.az',BASE_BRANCH:'main',DATA_BRANCH:'v2/content-production',ENABLE_V1_EXPORT:'false'});}
 async api(path,method='GET',body,optional=false){
  if(!allowedOperation(path,method,body))throw Error('Automation cannot publish, merge, delete branches or modify main');
  const args=['api','repos/HafizV1/powerlifting.az'+(path?'/'+path:''),'--method',method];
  if(body!==undefined)args.push('--input','-');
  try {const raw=execFileSync('gh',args,{input:body===undefined?undefined:JSON.stringify(body),encoding:'utf8',maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']});return raw?JSON.parse(raw):null;}
  catch(e){if(optional&&String(e.stderr).includes('HTTP 404'))return null;throw Error('GitHub connection request failed: '+method+' '+path);}
 }
}
export async function prepareMutation(store,job){
 const kind=job.kind,id=cleanId(job.id),state=await store.load();
 const old=state.collections[kind]?.find(x=>x.id===id);
 if(job.requireExisting&&!old)throw Error('Existing content item required');
 const item=validate(kind,job.fields||{},old||{id},state.collections),assets=[];
 // Validate/read every upload before writing any Git object or content branch.
 if((job.files||[]).length>100)throw Error('Maximum 100 files per job');
 if(kind!=='albums'&&(job.files||[]).length>1)throw Error('This content kind accepts one upload');
 for(const filename of job.files||[]){
  const bytes=await readFile(filename),file=new File([bytes],basename(filename));
  const info=checkFile(file,kind);checkSignature(bytes,info.ext);
  const assetId=createHash('sha256').update(bytes).digest('hex'),path=`assets/uploads/${kind}/${id}/${assetId}.${info.ext}`;
  if(kind==='albums'&&item.photos.some(p=>p.id===assetId))continue;
  assets.push({path,base64:bytes.toString('base64')});
  if(kind==='albums')item.photos=[...item.photos,{id:assetId,path,alt:'',caption:''}];
  else if(info.image)item.image=path;
  else {delete item.importReview;item.file={path,name:basename(filename),mime:info.mime,size:bytes.length};}
 }
 // Review-ready is a candidate status only; publishing still requires a PR merge.
 if(job.reviewReady){validate(kind,{status:'published'},item,state.collections);item.status='published';}
 const index=state.collections[kind].findIndex(x=>x.id===id);
 if(index<0)state.collections[kind].push(item);else state.collections[kind][index]=item;
 return {state,kind,assets,item};
}
async function main(){
 const filename=process.argv[2];if(!filename)throw Error('Usage: node scripts/codex-content.mjs JOB.json [--apply]');
 if(process.argv.slice(3).some(x=>x!=='--apply'))throw Error('Unsupported option');
 const job=JSON.parse(await readFile(filename,'utf8'));
 job.files=(job.files||[]).map(x=>resolve(resolve(filename,'..'),x));
 const store=new ConnectedStore(),prepared=await prepareMutation(store,job);
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({validated:true,id:prepared.item.id,uploads:prepared.assets.length,photos:prepared.item.photos?.length,publicPublishing:false}));return;}
 await store.save(prepared.state,prepared.kind,prepared.assets,[],{login:'Codex delegated automation'});
 const current=await store.load(),review=await store.releaseReview(current,{login:'Codex delegated automation'});
 console.log(JSON.stringify(review));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
