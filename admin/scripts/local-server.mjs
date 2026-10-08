import http from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rename,unlink,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import worker from '../src/worker.mjs';
import {Problem,KINDS} from '../src/validation.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export class LocalStore {
 constructor(directory){this.directory=directory;this.lock=Promise.resolve();}
 async init(){
  await mkdir(this.directory,{recursive:true});
  const actual=await realpath(this.directory);if(actual===ROOT||actual.startsWith(ROOT+path.sep))throw new Error('Local test data must stay outside the repository');
  this.directory=actual;
  try{this.state=JSON.parse(await readFile(path.join(this.directory,'state.json'),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;const collections={};for(const kind of KINDS)collections[kind]=JSON.parse(await readFile(path.join(ROOT,'content/v2',kind+'.json'),'utf8'));this.state={collections,revision:'local-'+crypto.randomUUID()};await writeFile(path.join(this.directory,'state.json'),JSON.stringify(this.state));}
  return this;
 }
 async load(){return structuredClone(this.state);}
 async save(state,kind,assets,deletions){
  const perform=async()=>{
   if(state.revision!==this.state.revision)throw new Problem(409,'Məlumat dəyişib. Yeniləyib təkrar yoxlayın.');
   for(const asset of assets){const dest=path.join(this.directory,asset.path);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,Buffer.from(asset.base64,'base64'));}
   const next={collections:state.collections,revision:'local-'+crypto.randomUUID()};
   const temporary=path.join(this.directory,'state.tmp');await writeFile(temporary,JSON.stringify(next));await rename(temporary,path.join(this.directory,'state.json'));this.state=next;
   for(const name of deletions){try{await unlink(path.join(this.directory,name));}catch(e){if(e.code!=='ENOENT')throw e;}}
   return next.revision;
  };
  const result=this.lock.then(perform);this.lock=result.catch(()=>{});return result;
 }
 async review(){return null;}
 async asset(name){
  const base=name.startsWith('assets/uploads/')?this.directory:ROOT;
  const filename=path.resolve(base,name);if(!filename.startsWith(base+path.sep))throw new Problem(400,'Fayl ünvanı etibarsızdır.');
  try{return new Uint8Array(await readFile(filename));}catch{throw new Problem(404,'Fayl tapılmadı.');}
 }
}
export async function start({port=8787,directory}={}){
 const store=await new LocalStore(directory||await mkdtemp(path.join(tmpdir(),'powerlifting-admin-'))).init();
 const origin='http://127.0.0.1:'+port;
 const env={LOCAL_STORE:store,PUBLIC_ORIGIN:origin,SESSION_SECRET:randomBytes(48).toString('base64url'),ASSETS:{async fetch(request){
  const pathname=new URL(request.url).pathname;
  const filename=path.resolve(ROOT,'admin/public','.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  const publicRoot=path.join(ROOT,'admin/public');
  if(!filename.startsWith(publicRoot+path.sep))return new Response('Not found',{status:404});
  try{const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(filename)]||'application/octet-stream';return new Response(await readFile(filename),{headers:{'Content-Type':type}});}catch{return new Response('Not found',{status:404});}
 }}};
 const server=http.createServer(async(req,res)=>{
  try{
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:ReadableStream.from(req),duplex:'half'}:{})});
   const response=await worker.fetch(request,env);res.statusCode=response.status;
   for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
   if(response.headers.getSetCookie().length)res.setHeader('set-cookie',response.headers.getSetCookie());
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local server error');}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return {server,store,origin};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {origin,store}=await start({port:Number(process.env.PORT||8787),directory:process.env.LOCAL_DATA_DIR});
 console.log('Yerli V2 test paneli: '+origin+' — yalnız bu kompüter üçün, GitHub-a yazmır.');
 console.log('Test məlumat qovluğu: '+store.directory);
}
