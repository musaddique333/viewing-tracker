import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Browser utility is plain JavaScript, tested directly.
import {londonTimestamp,dateKey,timeKey} from '../src/time.js';
test('UK summer and winter viewing times',()=>{
 assert.equal(londonTimestamp('2026-10-08','14:00'),Date.UTC(2026,9,8,13));
 assert.equal(londonTimestamp('2026-11-08','14:00'),Date.UTC(2026,10,8,14));
 assert.equal(dateKey(Date.UTC(2026,6,1,23,30)),'2026-07-02');
 assert.equal(timeKey(Date.UTC(2026,6,1,23,30)),'00:30');
});
test('rejects nonexistent spring DST times; autumn chooses first occurrence',()=>{
 assert.throws(()=>londonTimestamp('2026-03-29','01:30'));
 assert.equal(londonTimestamp('2026-10-25','01:30'),Date.UTC(2026,9,25,0,30));
});
