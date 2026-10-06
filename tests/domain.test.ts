import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateViewing,isDue,allowedPushEndpoint,SIX_HOURS} from '../worker/domain.ts';
const valid = {title:'Musselburgh flat',address:'1 High Street, Musselburgh',starts_at:Date.UTC(2026,9,8,13),duration:30};
test('requires a real address, valid date, allowed status and safe links',()=>{
 assert.equal(validateViewing(valid).title,'Musselburgh flat');
 for(const bad of [{address:''},{starts_at:NaN},{duration:-1},{status:'other'},{links:['javascript:alert(1)']},{links:['https://']},{links:['data:text/html,test']}])assert.throws(()=>validateViewing({...valid,...bad}));
});
test('six-hour boundary and cancelled/past exclusions',()=>{
 const now=Date.UTC(2026,9,8,7);
 assert.equal(isDue({...valid,status:'scheduled'},now),true);
 assert.equal(isDue({...valid,status:'scheduled'},now-1),false);
 assert.equal(isDue({...valid,status:'cancelled'},now),false);
 assert.equal(isDue({...valid,status:'scheduled'},now+SIX_HOURS),false);
});
test('blocks local and attacker-controlled push endpoints',()=>{
 assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/token'),true);
 for(const url of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.attacker.test/x','https://127.0.0.1/x','https://fcm.googleapis.com:8443/x','https://user@fcm.googleapis.com/x'])assert.equal(allowedPushEndpoint(url),false);
});
