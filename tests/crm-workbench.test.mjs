import test from 'node:test';
import assert from 'node:assert/strict';
import {focusDeals,nextDealAction} from '../lib/os/crm-workbench.ts';
const rows=[{id:'a',owner:'Айым',nextTaskAt:'2026-10-08T10:00:00+06:00'},{id:'b',owner:'',nextTaskAt:'2026-10-12T10:00:00+06:00'},{id:'c',owner:'Медина'}];
const now=Date.parse('2026-10-10T10:00:00+06:00');
test('CRM queues independently select reply, deadline, owner and personal work',()=>{
 const original=structuredClone(rows);
 assert.deepEqual(focusDeals(rows,'reply',['c'],'Айым',now).map(row=>row.id),['c']);
 assert.deepEqual(focusDeals(rows,'overdue',[],'Айым',now).map(row=>row.id),['a']);
 assert.deepEqual(focusDeals(rows,'unassigned',[],'Айым',now).map(row=>row.id),['b']);
 assert.deepEqual(focusDeals(rows,'mine',[],'Айым Тест',now).map(row=>row.id),['a']);
 assert.deepEqual(rows,original);
});
test('next action prioritizes customer response before overdue contact and unassigned owner',()=>{
 assert.equal(nextDealAction(rows[0],true,now).tone,'reply');
 assert.equal(nextDealAction(rows[0],false,now).tone,'overdue');
 assert.equal(nextDealAction(rows[1],false,now).tone,'unassigned');
 assert.equal(nextDealAction(rows[2],false,now).tone,'empty');
});
