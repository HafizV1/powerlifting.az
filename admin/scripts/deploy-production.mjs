import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.length&&!(args.length===1&&args[0]==='--dry-run'))throw Error('Only --dry-run is permitted; production target cannot be overridden');
execFileSync('npx',['--yes','wrangler@4.148.0','deploy','--config','wrangler.production.toml',...args],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
// Account secrets are supplied securely after initial creation. Live authenticated
// acceptance is verified separately; a successful upload is not a login claim.

if(!args.includes('--dry-run'))await import('./verify-production.mjs');
