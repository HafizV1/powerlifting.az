import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderV1} from '../src/render-v1.mjs';
import {KINDS} from '../src/validation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.resolve(process.argv[2]||'/tmp/powerlifting-v2-site-review');
if(output===root||output.startsWith(root+path.sep))throw new Error('Export must be outside the repository; original V1 files are protected');
const dataDir=process.env.V2_DATA_DIR&&path.resolve(process.env.V2_DATA_DIR);
const collections=dataDir?JSON.parse(await readFile(path.join(dataDir,'state.json'),'utf8')).collections:Object.fromEntries(await Promise.all(KINDS.map(async k=>[k,JSON.parse(await readFile(path.join(root,'content/v2',k+'.json'),'utf8'))])));
const base={};const {readdir}=await import('node:fs/promises');
for(const file of await readdir(root))if(file.endsWith('.html'))base[file]=await readFile(path.join(root,file),'utf8');
const rendered=renderV1(base,collections);await mkdir(output,{recursive:true});
for(const [name,html] of Object.entries(base))await writeFile(path.join(output,name),html);
await cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
for(const file of await readdir(root))if(/\.(pdf|jpg|png)$/i.test(file))await cp(path.join(root,file),path.join(output,file));
if(dataDir){try{await cp(path.join(dataDir,'assets/uploads'),path.join(output,'assets/uploads'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
for(const [name,html] of Object.entries(rendered)){
 const dest=path.resolve(output,name);if(!dest.startsWith(output+path.sep))throw new Error('Unsafe output path');await writeFile(dest,html);
}
console.log('Review-only site exported to '+output+'; CNAME omitted. No merge/deployment performed.');
