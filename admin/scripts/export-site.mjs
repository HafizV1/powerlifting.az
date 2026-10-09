import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareRelease} from '../src/release.mjs';
import {execFileSync} from 'node:child_process';
import {KINDS} from '../src/validation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.resolve(process.argv[2]||'/tmp/powerlifting-v2-site-review');
if(output===root||output.startsWith(root+path.sep))throw new Error('Export must be outside the repository; original V1 files are protected');
const dataDir=process.env.V2_DATA_DIR&&path.resolve(process.env.V2_DATA_DIR);
const collections=dataDir?JSON.parse(await readFile(path.join(dataDir,'state.json'),'utf8')).collections:Object.fromEntries(await Promise.all(KINDS.map(async k=>[k,JSON.parse(await readFile(path.join(root,'content/v2',k+'.json'),'utf8'))])));
const base={};const {readdir}=await import('node:fs/promises');
for(const file of await readdir(root))if(file.endsWith('.html'))base[file]=await readFile(path.join(root,file),'utf8');
const previous=Object.fromEntries(await Promise.all(KINDS.map(async k=>[k,JSON.parse(await readFile(path.join(root,'content/v2',k+'.json'),'utf8'))])));
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sourceAssets={};if(dataDir)for(const p of collections.protocols.filter(p=>p.importReview?.approved)){if(!/^assets\/uploads\/protocols\/[a-z0-9-]+\/[a-z0-9-]+\.(pdf|xlsx|docx)$/.test(p.file?.path||''))throw Error('Unsafe protocol path');sourceAssets[p.file.path]=new Uint8Array(await readFile(path.join(dataDir,p.file.path)));}
const {output:rendered,manifest}=await prepareRelease({pages:base,previous,collections,sourceRevision:sha,contentRevision:sha,sourceAssets});
// Refuse existing output directories to avoid symlink traversal or overwriting a prior review.
await mkdir(output);await writeFile(path.join(output,'review-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const [name,html] of Object.entries(base))await writeFile(path.join(output,name),html);
await cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
for(const file of await readdir(root))if(/\.(pdf|jpg|png)$/i.test(file))await cp(path.join(root,file),path.join(output,file));
if(dataDir){try{await cp(path.join(dataDir,'assets/uploads'),path.join(output,'assets/uploads'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
for(const [name,html] of Object.entries(rendered)){
 const dest=path.resolve(output,name);if(!dest.startsWith(output+path.sep))throw new Error('Unsafe output path');await writeFile(dest,html);
}
console.log('Review-only site exported to '+output+'; CNAME omitted. No merge/deployment performed.');
