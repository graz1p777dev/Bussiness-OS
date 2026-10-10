import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTaskLinks} from '../lib/os/task-links.ts';
const deals=[{id:'d1',customerId:'c1'},{id:'d2',customerId:'c2'},{id:'legacy'}];
test('linked task derives the customer ID from its deal and supports legacy IDs',()=>{
 assert.deepEqual(resolveTaskLinks(deals,'','d1'),{clientId:'c1',dealId:'d1'});
 assert.deepEqual(resolveTaskLinks(deals,'','legacy'),{clientId:'legacy',dealId:'legacy'});
 assert.deepEqual(resolveTaskLinks(deals,'c2',''),{clientId:'c2',dealId:undefined});
});
test('task rejects removed or inconsistent client and deal links',()=>{
 assert.throws(()=>resolveTaskLinks(deals,'c2','d1'),/другому/);
 assert.throws(()=>resolveTaskLinks(deals,'missing',''),/существует/);
 assert.throws(()=>resolveTaskLinks(deals,'','missing'),/существует/);
});
