// Maintainer build command, executed in cloud tooling; not required by owner.
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),generated=new URL('./browser-worker-assets.generated.mjs',import.meta.url);
const assets={};
for(const [name,type] of [['index.html','text/html; charset=utf-8'],['admin.js','text/javascript; charset=utf-8'],['admin.css','text/css; charset=utf-8'],['e2e.html','text/html; charset=utf-8'],['e2e.js','text/javascript; charset=utf-8'],['e2e-fixtures.js','text/javascript; charset=utf-8'],['imports.html','text/html; charset=utf-8'],['imports.js','text/javascript; charset=utf-8']])assets['/'+name]={type,body:await readFile(new URL('public/'+name,root),'utf8')};
for(const name of ['pdf.mjs','pdf.worker.mjs'])assets['/'+name]={type:'text/javascript; charset=utf-8',body:await readFile(new URL('node_modules/pdfjs-dist/build/'+name,root),'utf8')};
const hash=createHash('sha256');hash.update(JSON.stringify(assets));
for(const name of ['scripts/build-browser-worker.mjs','scripts/browser-worker-entry.mjs','src/worker.mjs','src/github.mjs','src/security.mjs','src/validation.mjs','src/render-v1.mjs','src/staging-test.mjs','src/import/extract.mjs','src/import/review.mjs','src/import/baseline.mjs','src/release.mjs'])hash.update(await readFile(new URL(name,root)));
const build='sha256:'+hash.digest('hex').slice(0,16);
await mkdir(new URL('docs/browser-deploy/',root),{recursive:true});
try{
 await writeFile(generated,'export const BROWSER_ASSETS='+JSON.stringify(assets)+';\nexport const BROWSER_BUILD='+JSON.stringify(build)+';\n');
 execFileSync('npx',['--yes','esbuild@0.25.12','scripts/browser-worker-entry.mjs','--bundle','--minify-whitespace','--format=esm','--target=es2022','--outfile=docs/browser-deploy/worker.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,npm_config_cache:'/tmp/powerlifting-npm-cache'}});
}finally{await unlink(generated).catch(()=>{});}
