import test from 'node:test';
import assert from 'node:assert/strict';
import {readableAssistantResult} from '../lib/os/assistant-result-access.ts';
const context=(pages,sales=[{id:'own'}])=>({clients:[],tasks:[],employees:[],inventory:{products:[],shifts:[],sales},can:page=>pages.includes(page)});
test('saved sales recheck both current row scope and customer visibility',()=>{
 const saved=[{id:'own',total:20,customerId:'c1',customerName:'PRIVATE'},{id:'other',total:99,customerName:'OTHER'}];
 const visible=readableAssistantResult('get_sales',saved,context(['pos']));assert.equal(visible.length,1);assert.equal(visible[0].id,'own');assert.equal('customerName' in visible[0],false);assert.equal('customerId' in visible[0],false);
 assert.equal(readableAssistantResult('get_sales',saved,context(['pos','customers']))[0].customerName,'PRIVATE');assert.equal(readableAssistantResult('get_sales',saved,context([])),null);assert.equal(saved[0].customerName,'PRIVATE');
});
test('saved analytics redact revoked sources and broader old sales scope without recomputing snapshot',()=>{
 const saved={leads:2,potential:90,sources:{WhatsApp:2},sales:2,revenue:99,refunds:0};
 assert.deepEqual(readableAssistantResult('get_analytics',saved,context(['analytics','pos']),{saleIds:['own','other']}),{});
 assert.deepEqual(readableAssistantResult('get_analytics',saved,context(['analytics','crm'])),{leads:2,potential:90,sources:{WhatsApp:2}});
 assert.deepEqual(readableAssistantResult('get_analytics',saved,context(['analytics','pos']),{saleIds:['own']}),{sales:2,revenue:99,refunds:0});
 assert.deepEqual(readableAssistantResult('get_analytics',saved,context(['analytics','pos'])),{});
});
test('cached inventory cost is removed after finance permission is lost',()=>{
 const saved=[{id:'sku',name:'Product',cost:75,price:100}];assert.deepEqual(readableAssistantResult('get_inventory',saved,context(['inventory'])),[{id:'sku',name:'Product',price:100}]);assert.equal(saved[0].cost,75);
});


test('calendar history masks revoked sources, missing scoped rows and mismatched links',()=>{
 const event={id:'task:t1',recordId:'t1',source:'task',title:'Task',date:'2026-10-10',time:'10:00',amount:9999,note:'PRIVATE'};
 const saved=[event,{...event,id:'finance:f1',recordId:'f1',source:'finance'},{...event,id:'task:hidden',recordId:'hidden'}];
 const permitted={...context(['calendar','tasks']),calendar:[event]};
 assert.deepEqual(readableAssistantResult('get_calendar',saved,permitted),[{id:event.id,recordId:'t1',source:'task',title:'Task',date:'2026-10-10',time:'10:00'}]);
 assert.deepEqual(readableAssistantResult('get_calendar',saved,{...permitted,can:page=>page==='calendar'}),[]);
 assert.deepEqual(readableAssistantResult('get_calendar',saved,{...permitted,calendar:[]}),[]);
 assert.deepEqual(readableAssistantResult('get_calendar',[{...event,recordId:'forged'}],permitted),[]);
 assert.equal(readableAssistantResult('get_calendar',saved,{...permitted,can:()=>false}),null);
});

test('settings history rechecks page access and strips unapproved fields',()=>{
 const appearance={theme:'Light',collapsed:false,fontSize:15};
 const permitted={...context(['settings']),appearance};
 assert.deepEqual(readableAssistantResult('get_settings',{...appearance,apiKey:'SECRET',instructions:'PRIVATE'},permitted),appearance);
 assert.equal(readableAssistantResult('get_settings',appearance,{...permitted,can:()=>false}),null);
 assert.deepEqual(readableAssistantResult('get_settings',appearance,{...permitted,appearance:undefined}),{});
});
