import webpush from 'web-push';
import { allowedPushEndpoint, validateProgress, validatePropertyDetails, SIX_HOURS, validateViewing, type Viewing } from './domain.ts';
interface Env { DB: D1Database; ASSETS: Fetcher; PASSWORD_HASH: string; VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string }
type Row = Omit<Viewing,'links'|'progress'|'property_details'> & {property_details:string; progress:string; links:string; reminder_revision:number};
type Sub = {id:string; subscription:string};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(text: string) { return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))); }
async function passwordOK(password: string, encoded: string) {
 const [salt,expected] = encoded.split(':');
 if (!salt || !expected || expected.length !== 64) return false;
 const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const actual = hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));
 let difference = 0; for(let i=0;i<actual.length;i++) difference |= actual.charCodeAt(i)^expected.charCodeAt(i);
 return difference === 0;
}
async function session(request: Request, env: Env) {
 const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)vt_session=([^;]+)/)?.[1];
 if (!token) return null;
 const tokenHash = await hash(token);
 return await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?').bind(tokenHash,Date.now()).first() ? tokenHash : null;
}
async function body(request: Request) {
 const raw = await request.text(); if(raw.length > 20000) throw new Error('Request too large.');
 return JSON.parse(raw) as Record<string,unknown>;
}
function pushConfigured(env: Env) {return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);}
async function push(env: Env, sub: Sub, payload: unknown, ttl=3600) {
 // Generate encrypted RFC 8291 payload using web-push, then use Workers fetch.
 const details = webpush.generateRequestDetails(JSON.parse(sub.subscription),JSON.stringify(payload),{
  vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}, TTL:ttl,urgency:'high'
 });
 const response = await fetch(details.endpoint,{method:'POST',headers:details.headers as Record<string,string>,body:details.body as unknown as BodyInit,redirect:'error',signal:AbortSignal.timeout(15000)});
 if (response.status === 404 || response.status === 410) {
  await env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(sub.id).run();
  return false;
 }
 if(!response.ok) throw new Error(`Push provider returned ${response.status}`);
 return true;
}
async function api(request: Request,env: Env) {
 const url = new URL(request.url), path=url.pathname, now=Date.now();
 if(request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({error:'Invalid request origin.'},403);
 if(path === '/api/session' && request.method === 'GET') return json({authenticated:!!await session(request,env),configured:!!env.PASSWORD_HASH,pushConfigured:pushConfigured(env)});
 if(path === '/api/login' && request.method === 'POST') {
  if(!env.PASSWORD_HASH) return json({error:'Set the app password on the server first.'},503);
  const ip=await hash(request.headers.get('CF-Connecting-IP') || 'local');
  await env.DB.prepare('INSERT INTO login_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END').bind(ip,now+900000,now,now).run();
  const attempt=await env.DB.prepare('SELECT count FROM login_attempts WHERE key=?').bind(ip).first<{count:number}>();
  if(attempt && attempt.count>10) return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  const input=await body(request);
  if(typeof input.password !== 'string' || input.password.length>1024 || !await passwordOK(input.password,env.PASSWORD_HASH)) return json({error:'Incorrect password.'},401);
  const token=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sessions VALUES(?,?)').bind(await hash(token),now+30*86400000).run();
  return new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`vt_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`}});
 }
 const sessionHash=await session(request,env);
 if(!sessionHash) return json({error:'Please sign in.'},401);
 if(path === '/api/logout' && request.method === 'POST') {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(sessionHash).run();
  return new Response('{}',{headers:{'Set-Cookie':'vt_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0','Cache-Control':'no-store'}});
 }
 if(path === '/api/viewings' && request.method === 'GET') {
  const result=await env.DB.prepare('SELECT * FROM viewings ORDER BY starts_at').all<Row>();
  return json(result.results.map(r=>({...r,links:JSON.parse(r.links),property_details:validatePropertyDetails(JSON.parse(r.property_details)),progress:validateProgress({attendance:r.status==='viewed'?'attended':'pending',...JSON.parse(r.progress)})})));
 }
 if(path === '/api/viewings' && request.method === 'POST') {
  const v=validateViewing(await body(request)),id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO viewings(id,title,address,starts_at,duration,agent,contact,links,notes,status,progress,property_details,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,v.title,v.address,v.starts_at,v.duration,v.agent,v.contact,JSON.stringify(v.links),v.notes,v.status,JSON.stringify(v.progress),JSON.stringify(v.property_details),now,now).run();
  return json({id},201);
 }
 const match=path.match(/^\/api\/viewings\/([a-f0-9-]+)$/);
 if(match && ['PUT','DELETE'].includes(request.method)) {
  const old=await env.DB.prepare('SELECT * FROM viewings WHERE id=?').bind(match[1]).first<Row>();
  if(!old) return json({error:'Viewing not found.'},404);
  if(request.method === 'DELETE') { await env.DB.prepare('DELETE FROM viewings WHERE id=?').bind(match[1]).run(); return json({ok:true}); }
  const input=await body(request),v=validateViewing({...input,progress:input.progress ?? JSON.parse(old.progress),property_details:input.property_details ?? JSON.parse(old.property_details)});
  if(input.revision!==old.revision) return json({error:'This viewing changed on another device. Refresh before editing.'},409);
  const result=await env.DB.prepare('UPDATE viewings SET title=?,address=?,starts_at=?,duration=?,agent=?,contact=?,links=?,notes=?,status=?,progress=?,property_details=?,revision=revision+1,reminder_revision=reminder_revision+?,updated_at=? WHERE id=? AND revision=?').bind(v.title,v.address,v.starts_at,v.duration,v.agent,v.contact,JSON.stringify(v.links),v.notes,v.status,JSON.stringify(v.progress),JSON.stringify(v.property_details),(v.starts_at!==old.starts_at || (v.status==='scheduled' && (old.status!=='scheduled' || (validateProgress(JSON.parse(old.progress)).intent==='no' && v.progress.intent!=='no'))))?1:0,now,old.id,old.revision).run();
  if(!result.meta.changes) return json({error:'This viewing changed. Refresh before editing.'},409);
  return json({ok:true});
 }
 if(path === '/api/push/key' && request.method === 'GET') return pushConfigured(env)?json({key:env.VAPID_PUBLIC_KEY}):json({error:'Push reminders need server setup. See deployment instructions.'},503);
 if(path === '/api/push/subscriptions' && request.method === 'POST') {
  const b=await body(request),keys=b.keys as Record<string,string>|undefined;
  if(typeof b.endpoint!=='string' || b.endpoint.length>2048 || !allowedPushEndpoint(b.endpoint) || !keys || typeof keys.p256dh!=='string' || typeof keys.auth!=='string' || !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return json({error:'Invalid push subscription.'},400);
  const id=await hash(b.endpoint);
  await env.DB.prepare('INSERT INTO subscriptions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription').bind(id,b.endpoint,JSON.stringify({endpoint:b.endpoint,keys}),now).run();
  return json({ok:true});
 }
 if(path === '/api/push/subscriptions' && request.method === 'DELETE') {
  const b=await body(request); if(typeof b.endpoint==='string') await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(b.endpoint).run();
  return json({ok:true});
 }
 if(path === '/api/push/test' && request.method === 'POST') {
  if(!pushConfigured(env)) return json({error:'Push reminders are not configured.'},503);
  const b=await body(request);
  const sub=await env.DB.prepare('SELECT * FROM subscriptions WHERE endpoint=?').bind(String(b.endpoint)).first<Sub>();
  if(!sub) return json({error:'Enable reminders on this device first.'},400);
  try { const delivered=await push(env,sub,{title:'Viewing Tracker is ready',body:'Your six-hour viewing reminders will arrive here.',url:'/',tag:'test'}); return delivered?json({ok:true}):json({error:'Subscription expired. Enable reminders again.'},410); }
  catch { return json({error:'The push provider could not accept the test. Please try again.'},502); }
 }
 return json({error:'Not found.'},404);
}
export async function reminders(env: Env,now=Date.now()) {
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),env.DB.prepare('DELETE FROM login_attempts WHERE expires_at<?').bind(now)]);
 if(!pushConfigured(env)) return;
 const views=await env.DB.prepare("SELECT * FROM viewings WHERE status='scheduled' AND starts_at>? AND starts_at<=? ORDER BY starts_at LIMIT 100").bind(now,now+SIX_HOURS).all<Row>();
 const subs=await env.DB.prepare('SELECT * FROM subscriptions').all<Sub>();
 for(const v of views.results) for(const sub of subs.results) {
  const progress=validateProgress(JSON.parse(v.progress));
  if(progress.intent==='no' || progress.attendance!=='pending' || progress.outcome!=='ongoing') continue;
  // Durable per-device leases prevent concurrent cron runs sending the same reminder.
  await env.DB.prepare('INSERT OR IGNORE INTO deliveries(viewing_id,subscription_id,revision) VALUES(?,?,?)').bind(v.id,sub.id,v.reminder_revision).run();
  const claimed=await env.DB.prepare('UPDATE deliveries SET lease_until=?,attempts=attempts+1 WHERE viewing_id=? AND subscription_id=? AND revision=? AND sent_at IS NULL AND lease_until<=?').bind(now+120000,v.id,sub.id,v.reminder_revision,now).run();
  if(!claimed.meta.changes) continue;
  const current=await env.DB.prepare("SELECT id FROM viewings WHERE id=? AND revision=? AND status='scheduled'").bind(v.id,v.revision).first();
  if(!current) continue;
  const hours=Math.max(1,Math.round((v.starts_at-now)/3600000));
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(v.starts_at);
  try {
   await push(env,sub,{title:`Viewing ${hours===6?'in 6 hours':'coming up'}: ${v.title}`,body:`${time} · ${v.address}`,url:`/?viewing=${v.id}`,maps:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`,tag:`viewing-${v.id}`},Math.max(1,Math.floor((v.starts_at-now)/1000)));
   await env.DB.prepare('UPDATE deliveries SET sent_at=?,last_error=NULL WHERE viewing_id=? AND subscription_id=? AND revision=?').bind(Date.now(),v.id,sub.id,v.reminder_revision).run();
  } catch {
   await env.DB.prepare('UPDATE deliveries SET last_error=? WHERE viewing_id=? AND subscription_id=? AND revision=?').bind('Push delivery failed; retry pending',v.id,sub.id,v.reminder_revision).run();
   console.error('Push delivery failed', {viewingId:v.id});
  }
 }
}
export default {
 async fetch(request: Request,env: Env): Promise<Response> {
  if(!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try { return await api(request,env); } catch(e) {
   if(e instanceof SyntaxError || (e instanceof Error && /Check |valid |Choose |Duration |Links |links|Request too/.test(e.message))) return json({error:e.message},400);
   console.error('API request failed'); return json({error:'Something went wrong. Please try again.'},500);
  }
 },
 scheduled(_event: ScheduledController,env: Env,ctx: ExecutionContext) {ctx.waitUntil(reminders(env));}
} satisfies ExportedHandler<Env>;
