import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceNotices} from '../lib/os/notifications.ts';
import {initialDeals,initialTasks} from '../lib/os/data.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
test('unanswered events resolve after a reply and return with a new incoming message identity',()=>{
 const client=initialDeals[0];
 const before=workspaceNotices([client],{},[],{...initialInventory,products:[]});
 assert.equal(before.length,1);
 const outgoing={id:'answer',text:'Ответ',direction:'outgoing'};
 assert.equal(workspaceNotices([client],{[client.id]:[outgoing]},[],{...initialInventory,products:[]}).length,0);
 const incoming={id:'question',text:'Вопрос',direction:'incoming',sentAt:'2026-10-06T12:00:00Z'};
 const after=workspaceNotices([client],{[client.id]:[outgoing,incoming]},[],{...initialInventory,products:[]});
 assert.notEqual(before[0].id,after[0].id);
 assert.equal(after[0].clientId,client.id);
 assert.equal(after[0].date,incoming.sentAt);
});
test('stock events use actual totals, disappear after replenishment and exclude trash',()=>{
 const product={...initialInventory.products[0],minimum:10,stocks:{main:2,second:3}};
 const events=workspaceNotices([],{},[],{...initialInventory,products:[product]});
 assert.equal(events.length,1);
 assert.match(events[0].title,/осталось 5/);
 assert.equal(workspaceNotices([],{},[],{...initialInventory,products:[{...product,stocks:{main:10}}]}).length,0);
 assert.equal(workspaceNotices([],{},[],{...initialInventory,products:[{...product,deleted:true}]}).length,0);
});
test('urgent completed tasks do not remain actionable and undated events do not invent timestamps',()=>{
 const task={...initialTasks[0],urgent:true};
 const events=workspaceNotices([],{},[task],{...initialInventory,products:[]});
 assert.equal(events.length,1);
 assert.equal(events[0].date,undefined);
 assert.equal(workspaceNotices([],{},[{...task,status:'Done'}],{...initialInventory,products:[]}).length,0);
});
