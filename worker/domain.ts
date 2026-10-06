export const SIX_HOURS = 6 * 60 * 60 * 1000;
export type Viewing = {
 id: string; title: string; address: string; starts_at: number; duration: number;
 agent: string; contact: string; links: string[]; notes: string;
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
 return {title,address,starts_at,duration,status: status as Viewing['status'],links,agent:str('agent',200),contact:str('contact',200),notes:str('notes',5000)};
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
