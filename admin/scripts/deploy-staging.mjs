import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.length&&!(args.length===1&&args[0]==='--dry-run'))throw new Error('Only --dry-run is permitted; the staging target cannot be overridden.');
execFileSync('npx',['--yes','wrangler@4.148.0','deploy','--config','wrangler.browser.toml','--env','staging',...args],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
if(!args.includes('--dry-run'))await import('./verify-staging.mjs');
