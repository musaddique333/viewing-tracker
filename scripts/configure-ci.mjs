import {readFileSync,writeFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const id=process.env.D1_DATABASE_ID||config.d1_databases[0].database_id;
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||id==='00000000-0000-0000-0000-000000000000')throw new Error('Set D1_DATABASE_ID to your Cloudflare database ID.');
config.d1_databases[0].database_id=id;
writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
