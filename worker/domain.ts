export const SIX_HOURS = 6 * 60 * 60 * 1000;
export type Progress = { intent: 'undecided' | 'yes' | 'no'; attendance: 'pending' | 'attended' | 'missed'; email: boolean; application: boolean; documents: boolean; references: boolean; offer: boolean; agreement: boolean; deposit: boolean; keys: boolean; outcome: 'ongoing' | 'secured' | 'unsuccessful' | 'withdrawn' };
export function validateProgress(value: unknown): Progress {
 const defaults: Progress = {intent:'undecided',attendance:'pending',email:false,application:false,documents:false,references:false,offer:false,agreement:false,deposit:false,keys:false,outcome:'ongoing'};
 if(value === undefined) return defaults;
 if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Check progress.');
 const v = {...defaults,...value} as Progress;
 if(!['undecided','yes','no'].includes(v.intent) || !['pending','attended','missed'].includes(v.attendance) || !['ongoing','secured','unsuccessful','withdrawn'].includes(v.outcome)) throw new Error('Check progress.');
 for(const key of ['email','application','documents','references','offer','agreement','deposit','keys'] as const) if(typeof v[key] !== 'boolean') throw new Error('Check progress.');
 return Object.fromEntries(Object.keys(defaults).map(key=>[key,v[key as keyof Progress]])) as Progress;
}
export type PropertyDetails = { rent: number | null; office_minutes: number | null; airport_minutes: number | null; office_direct: boolean; airport_direct: boolean };
export function validatePropertyDetails(value: unknown): PropertyDetails {
 const defaults: PropertyDetails = {rent:null,office_minutes:null,airport_minutes:null,office_direct:false,airport_direct:false};
 if(value === undefined) return defaults;
 if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Check property details.');
 const v = {...defaults,...value} as PropertyDetails;
 for(const key of ['rent','office_minutes','airport_minutes'] as const) {
  const n=v[key];
  if(n!==null && (typeof n!=='number' || !Number.isFinite(n) || n<0 || n>(key==='rent'?100000:1440) || (key==='rent'?Math.abs(n*100-Math.round(n*100))>0.000001:!Number.isInteger(n)))) throw new Error(key==='rent'?'Rent must be a valid monthly amount.':'Travel time must be 0–1440 whole minutes.');
 }
 for(const key of ['office_direct','airport_direct'] as const) if(typeof v[key]!=='boolean') throw new Error('Check direct route options.');
 return {rent:v.rent,office_minutes:v.office_minutes,airport_minutes:v.airport_minutes,office_direct:v.office_direct,airport_direct:v.airport_direct};
}
export type Viewing = {
 id: string; title: string; address: string; starts_at: number; duration: number;
 agent: string; contact: string; links: string[]; notes: string; progress: Progress; property_details: PropertyDetails;
 status: 'scheduled' | 'viewed' | 'cancelled'; revision: number; created_at: number; updated_at: number;
};
export function validateViewing(input: Record<string, unknown>) {
 const str = (key: string, max: number, required = false) => {
  const v = input[key] ?? '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Check ${key}.`);
  return v.trim();
 };
 const title = str('title', 120, true), address = str('address', 500, true);
 const starts_at = Number(input.starts_at), duration = Number(input.duration ?? 30);
 if (!Number.isSafeInteger(starts_at) || starts_at < 1577836800000 || starts_at > 4102444800000) throw new Error('Choose a valid viewing date and time.');
 if (!Number.isInteger(duration) || duration < 5 || duration > 480) throw new Error('Duration must be 5–480 minutes.');
 const status = input.status ?? 'scheduled';
 if (!['scheduled','viewed','cancelled'].includes(String(status))) throw new Error('Invalid status.');
 const links = input.links ?? [];
 if (!Array.isArray(links) || links.length > 10) throw new Error('Add up to 10 links.');
 for (const link of links) {
  if (typeof link !== 'string' || link.length > 2048) throw new Error('Invalid property link.');
  try { if (!['http:','https:'].includes(new URL(link).protocol)) throw new Error(); } catch { throw new Error('Links must start with https:// or http://.'); }
 }
 return {property_details:validatePropertyDetails(input.property_details),progress:validateProgress(input.progress),title,address,starts_at,duration,status: status as Viewing['status'],links,agent:str('agent',200),contact:str('contact',200),notes:str('notes',5000)};
}
export function isDue(v: Pick<Viewing,'starts_at'|'status'>, now: number) {
 return v.status === 'scheduled' && v.starts_at > now && v.starts_at - SIX_HOURS <= now;
}
export function allowedPushEndpoint(endpoint: string) {
 try {
  const u = new URL(endpoint);
  return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
   (u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.notify.windows.com'));
 } catch { return false; }
}
