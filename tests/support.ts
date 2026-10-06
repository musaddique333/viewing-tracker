import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
// Real SQLite adapter for D1 prepared-statement tests; not used in production.
export function testDatabase() {
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;');
 for(const name of readdirSync(new URL('../migrations/',import.meta.url)).sort())db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 return {prepare(sql:string){const statement=db.prepare(sql);let values:any[]=[];const api={bind(...args:any[]){values=args;return api;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){const r=statement.run(...values);return {meta:{changes:Number(r.changes)}};}};return api;},async batch(statements:any[]){return Promise.all(statements.map(s=>s.run()));},close(){db.close();}};
}
