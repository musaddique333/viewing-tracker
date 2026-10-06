import {test} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {reminders} from '../worker/index.ts';
import {testDatabase} from './support.ts';
test('per-device reminders deduplicate, retry failures, and reschedule',async()=>{
 const DB=testDatabase(),keys=webpush.generateVAPIDKeys(),receiver=webpush.generateVAPIDKeys();
 const env:any={DB,VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:test@example.com'};
 const now=Date.now();await DB.prepare("INSERT INTO viewings(id,title,address,starts_at,created_at,updated_at) VALUES('v','Flat','Address',?,?,?)").bind(now+21600000,now,now).run();
 for(const id of ['a','b'])await DB.prepare('INSERT INTO subscriptions VALUES(?,?,?,?)').bind(id,`https://fcm.googleapis.com/${id}`,JSON.stringify({endpoint:`https://fcm.googleapis.com/${id}`,keys:{p256dh:receiver.publicKey,auth:'AAAAAAAAAAAAAAAAAAAAAA'}}),now).run();
 const original=globalThis.fetch;let calls=0,fail=true;
 globalThis.fetch=(async(input:any)=>{calls++;return new Response(null,{status:String(input).endsWith('/b')&&fail?503:201});}) as any;
 try{
  await reminders(env,now);assert.equal(calls,2);
  await reminders(env,now+60000);assert.equal(calls,2); // Lease blocks immediate retry.
  fail=false;await reminders(env,now+121000);assert.equal(calls,3); // Successful device is not retried.
  await reminders(env,now+180000);assert.equal(calls,3);
  await DB.prepare("UPDATE viewings SET notes='Changed',revision=revision+1 WHERE id='v'").run();
  await reminders(env,now+240000);assert.equal(calls,3);
  await DB.prepare("UPDATE viewings SET starts_at=starts_at+60000,revision=revision+1,reminder_revision=reminder_revision+1 WHERE id='v'").run();
  await reminders(env,now+300000);assert.equal(calls,5);
  await DB.prepare("UPDATE viewings SET status='cancelled',reminder_revision=reminder_revision+1 WHERE id='v'").run();
  await reminders(env,now+400000);assert.equal(calls,5);
 }finally{globalThis.fetch=original;DB.close();}
});
