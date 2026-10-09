// Maintainer build command, executed in cloud tooling; not required by owner.
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),generated=new URL('./browser-worker-assets.generated.mjs',import.meta.url);
const assets={};
for(const [name,type] of [['index.html','text/html; charset=utf-8'],['admin.js','text/javascript; charset=utf-8'],['admin.css','text/css; charset=utf-8']])assets['/'+name]={type,body:await readFile(new URL('public/'+name,root),'utf8')};
await mkdir(new URL('docs/browser-deploy/',root),{recursive:true});
try{
 await writeFile(generated,'export const BROWSER_ASSETS='+JSON.stringify(assets)+';\n');
 execFileSync('npx',['--yes','esbuild@0.25.12','scripts/browser-worker-entry.mjs','--bundle','--format=esm','--target=es2022','--outfile=docs/browser-deploy/worker.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,npm_config_cache:'/tmp/powerlifting-npm-cache'}});
}finally{await unlink(generated).catch(()=>{});}
