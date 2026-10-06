import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const run=(args,opts={})=>execFileSync('npx',['wrangler',...args],{stdio:'inherit',...opts});
run(['login']);
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
 const raw=run(['d1','create','viewing-tracker-db'],{encoding:'utf8',stdio:['inherit','pipe','inherit']});
 const id=raw.match(/(?:database_id["']?\s*[:=]\s*["'])([a-f0-9-]{36})/i)?.[1];
 if(!id){console.error('Database created, but automatic ID parsing failed. Copy its ID from Cloudflare D1 into wrangler.jsonc.');process.exit(1);}
 config.d1_databases[0].database_id=id;writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
}
run(['d1','migrations','apply','viewing-tracker-db','--remote']);
console.log('Database ready. Run npm run keys, then npx wrangler secret bulk .dev.vars, then npm run deploy.');
