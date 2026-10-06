export const ZONE = 'Europe/London';
export function dateKey(ms) {
 const parts = new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(ms);
 const get=t=>parts.find(p=>p.type===t).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function timeKey(ms) {return new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(ms);}
// Enumerate both UK offsets, reject spring-forward gaps; choose first occurrence in autumn.
export function londonTimestamp(date,time) {
 const naive=Date.parse(`${date}T${time}:00Z`);
 const candidates=[naive-3600000,naive].filter(n=>Number.isFinite(n)&&dateKey(n)===date&&timeKey(n)===time);
 if(!candidates.length) throw new Error('That time does not exist in UK time. Choose another time.');
 return candidates[0];
}
export function pretty(ms,options={}) {return new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,...options}).format(ms);}
