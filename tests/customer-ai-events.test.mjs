import test from 'node:test';
import assert from 'node:assert/strict';
import {customerAIEvents} from '../lib/os/customer-ai-events.ts';
const draft={id:'reply1',customerId:'deal1',agentId:'agent1',context:{agentName:'Sales Agent',prompt:'HIDDEN PROMPT'},text:'Здравствуйте!',status:'approved',updatedAt:'2026-10-10T10:00:00Z'};
test('customer AI events link stable customer and related deal ids without exposing prompts',()=>{
 const feedback={id:'feedback1',customerId:'customer1',agentId:'agent1',createdAt:'2026-10-10T11:00:00Z',liked:'Тон',disliked:'Цена'};
 const rows=customerAIEvents('customer1',['deal1'],{deal1:draft,other:{...draft,id:'other',customerId:'PRIVATE',text:'SECRET'}},[feedback],true);
 assert.equal(rows.length,2);assert.equal(rows[0].type,'Обратная связь по ответу');assert.equal(rows[1].type,'Ответ подтверждён');
 assert.equal(JSON.stringify(rows).includes('SECRET'),false);assert.equal(JSON.stringify(rows).includes('HIDDEN PROMPT'),false);
});
test('dialog permission revocation hides all customer AI events',()=>{
 assert.deepEqual(customerAIEvents('customer1',['deal1'],{deal1:draft},[],false),[]);
});
