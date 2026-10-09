// Creates a review artifact against a pinned live SHA. Never pushes or deploys.
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readBaseline,digest} from '../src/import/baseline.mjs';
import {prepareRelease} from '../src/release.mjs';
import {KINDS} from '../src/validation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const [liveSHA,codeSHA,contentSHA]=process.argv.slice(2);
if([liveSHA,codeSHA,contentSHA].some(x=>!/^([a-f0-9]{40})$/.test(x||'')))throw Error('Supply pinned live, V2 code and reviewed content Git SHAs.');
const git=(args,encoding='utf8')=>execFileSync('git',args,{cwd:root,encoding,maxBuffer:30*1024*1024});
const api=endpoint=>JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:20*1024*1024}));
if(api('repos/HafizV1/powerlifting.az/git/ref/heads/main').object.sha!==liveSHA)throw Error('Live main changed; prepare a fresh candidate.');
if(api('repos/HafizV1/powerlifting-v1-preview/git/ref/heads/v2/content-staging').object.sha!==contentSHA)throw Error('Staging content changed; inspect before preparing a candidate.');
const contentTree=api('repos/HafizV1/powerlifting-v1-preview/git/trees/'+contentSHA+'?recursive=1');if(contentTree.truncated)throw Error('Content tree truncated.');
const show=(sha,name)=>git(['show',sha+':'+name],null);
const entries=git(['ls-tree','-rz',liveSHA]).split('\0').filter(Boolean).map(line=>{const [metadata,name]=line.split('\t'),[mode,type,sha]=metadata.split(' ');return {mode,type,sha,path:name};});
const publicFiles=entries.filter(e=>e.type==='blob'&&(e.path.startsWith('assets/')||/^[^/]+\.(html|pdf|png|jpg|jpeg|webp|ico|txt|xml)$/i.test(e.path)));
if(publicFiles.some(e=>e.mode==='120000'||e.path.includes('..')||e.path.startsWith('/')))throw Error('Unsafe source path.');
const pages={};for(const e of publicFiles.filter(e=>e.path.endsWith('.html')))pages[e.path]=show(liveSHA,e.path).toString('utf8');
const baseline=readBaseline(pages);if(baseline.athletes.length!==208)throw Error('Live baseline must contain the approved 208 athletes.');
const previous={};for(const k of KINDS)previous[k]=JSON.parse(show(codeSHA,'content/v2/'+k+'.json').toString('utf8'));
for(const k of KINDS){const name='content/v2/'+k+'.json',expected=git(['rev-parse',codeSHA+':'+name]).trim();if(contentTree.tree.find(e=>e.path===name&&e.type==='blob')?.sha!==expected)throw Error('Managed content differs from the approved seed: '+k+'. Inspect its approval before including it.');}
// Do not import unreviewed staging changes.
const release=await prepareRelease({pages,previous,collections:structuredClone(previous),sourceRevision:liveSHA,contentRevision:contentSHA});
if(release.manifest.files.length)throw Error('Seed content must not rewrite approved V1 pages.');
const changes=git(['diff','--name-status',liveSHA,codeSHA]).trim().split('\n').filter(Boolean).map(line=>{const [status,name]=line.split('\t');if(!/^(admin\/|content\/v2\/)/.test(name))throw Error('Unexpected public-site change: '+name);return {status,path:name};});
const directory=await mkdtemp('/tmp/powerlifting-production-candidate-'),site=directory+'/site';await mkdir(site);
const files=[];for(const e of publicFiles){const bytes=show(liveSHA,e.path),dest=path.join(site,e.path);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes);files.push({path:e.path,gitBlob:e.sha,sha256:await digest(bytes)});}
const manifest={version:1,sourceRepository:'HafizV1/powerlifting.az',liveSHA,codeSHA,contentSHA,productionPublishingEnabled:false,productionWorkerConfigured:false,stagingWorkerChanged:false,stagingRepository:'HafizV1/powerlifting-v1-preview',stagingAdmin:'https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev',publicPageChanges:[],athleteCount:baseline.athletes.length,historicalResultCount:baseline.results.length,publicFiles:files,integrationChanges:changes,releaseManifest:release.manifest,rollback:{sourceCommit:liveSHA,publicPageBackupsRequired:[],existingSafeguards:'admin/src/release.mjs prepareRollback verifies manifest/current/backup hashes; no publishing endpoint',futureIntegrationRollback:'Prepare a reviewed revert of the integration merge; no merge or rollback execution is authorized.'}};
manifest.bundleHash=await digest(JSON.stringify(manifest));await writeFile(site+'/integration-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile(directory+'/publication-approved.json',JSON.stringify({approved:false,sourceRevision:liveSHA,bundleHash:manifest.bundleHash},null,2)+'\n');
console.log(JSON.stringify({directory,site,liveSHA,codeSHA,bundleHash:manifest.bundleHash,publicFiles:files.length,publicPageChanges:0,athletes:baseline.athletes.length,results:baseline.results.length,publishing:false}));
