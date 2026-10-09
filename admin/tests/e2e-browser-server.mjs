// Test-only loopback HTTPS server and controlled GitHub mock; never deployed.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {mock} from './mock-github.mjs';
import worker from '../src/worker.mjs';
import {sign,cookie} from '../src/security.mjs';
const origin='https://127.0.0.1:8792',secret='loopback-test-only-session-key-at-least-32-bytes';
const h=await mock(false,true),env={...h.env,PUBLIC_ORIGIN:origin,SESSION_SECRET:secret,ADMIN_USER_IDS:'335450583',ASSETS:{async fetch(req){
 const name=new URL(req.url).pathname.slice(1)||'index.html';
 if(!['index.html','admin.js','admin.css','e2e.html','e2e.js','e2e-fixtures.js'].includes(name))return new Response('',{status:404});
 return new Response(await readFile(new URL('../public/'+name,import.meta.url)),{headers:{'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':'text/css'}});
}}};
const server=https.createServer({key:await readFile(process.env.TEST_TLS_KEY),cert:await readFile(process.env.TEST_TLS_CERT)},async(req,res)=>{
 try{
  if(req.url==='/__test-auth'){
   const token=await sign({id:'335450583',login:'Controlled local test identity',csrf:'local-browser-test-csrf',exp:Date.now()+600000},secret);
   res.writeHead(302,{'Set-Cookie':cookie('__Host-pl-admin',token),Location:'/e2e.html'});res.end();return;
  }
  if(req.url==='/__test-result'){
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({prs:h.prs.map(p=>({state:p.state,body:p.body,head:p.head,base:p.base})),refs:[...h.refs.keys()],ordinary:h.refs.get('v2/content-staging'),main:h.refs.get('main')}));return;
  }
  const chunks=[];for await(const part of req)chunks.push(part);
  const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Controlled test server failed.');}
});
server.listen(8792,'127.0.0.1');
