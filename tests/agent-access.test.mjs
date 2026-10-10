import test from 'node:test';
import assert from 'node:assert/strict';
import {permittedAgentTools,scopeAgentContext,canReadAgentRun} from '../lib/os/agent-access.ts';
import {executeAgentTool} from '../lib/os/agent-tools.ts';
const context={clients:[{id:'secret-client',name:'Hidden customer',phone:'+996-private',value:120,status:'Первичный контакт',channel:'WhatsApp',owner:'Private owner',note:'Private note'}],tasks:[{id:'secret-task',name:'Private task'}],inventory:{products:[{id:'secret-sku',name:'Private product',stocks:{main:4},minimum:5,price:100,cost:70}],warehouses:[{id:'private-warehouse'}],documents:[{id:'private-document'}],sales:[{id:'private-sale',total:800,refunds:50}],shifts:[{id:'private-shift'}]}};
const all={run:true,export:true,clients:true,analytics:true,inventory:true,tasks:true};
const analyticsOnly={...all,clients:false,inventory:false,tasks:false};
test('AI access does not grant hidden client, inventory or task tools',()=>{
 assert.deepEqual(permittedAgentTools(analyticsOnly),['get_analytics','web_search']);
 assert.deepEqual(permittedAgentTools({...all,run:false}),[]);
 const scoped=scopeAgentContext(context,['get_clients','get_inventory','get_tasks'],analyticsOnly);
 assert.deepEqual(scoped,{clients:[],tasks:[],inventory:{products:[],warehouses:[],documents:[],sales:[],shifts:[]}});
});
test('analytics permission exposes aggregates without raw customers, products, sales or shifts',()=>{
 const scoped=scopeAgentContext(context,['get_clients','get_inventory','get_tasks','get_analytics'],analyticsOnly);
 assert.deepEqual(executeAgentTool('get_analytics',{},scoped),{leads:1,won:0,lost:0,potential:120,sources:{WhatsApp:1},sales:1,revenue:750,refunds:50});
 assert.deepEqual(executeAgentTool('get_clients',{},scoped),[]);
 assert.deepEqual(executeAgentTool('get_inventory',{},scoped),[]);
 assert.doesNotMatch(JSON.stringify(scoped),/secret-|Private|Hidden|private/);
});
test('unselected tools never attach their context even for an owner',()=>{
 const clients=scopeAgentContext(context,['get_clients'],all);
 assert.equal(clients.clients[0].name,'Hidden customer');
 assert.deepEqual(clients.tasks,[]);assert.deepEqual(clients.inventory.sales,[]);assert.deepEqual(clients.inventory.products,[]);assert.equal(clients.analytics,undefined);
 const denied=scopeAgentContext(context,permittedAgentTools(all),{...all,run:false});
 assert.deepEqual(denied.clients,[]);assert.equal(denied.analytics,undefined);
});
test('run history is isolated by account and rechecks access after a role change',()=>{
 const run={actorId:'analyst',tools:['get_analytics'],journal:[{tool:'get_analytics'}]};
 assert.equal(canReadAgentRun(run,'analyst',analyticsOnly),true);
 assert.equal(canReadAgentRun(run,'other',all),false);
 assert.equal(canReadAgentRun({...run,tools:['get_clients']},'analyst',analyticsOnly),false);
 assert.equal(canReadAgentRun({...run,journal:[{tool:'get_inventory'}]},'analyst',analyticsOnly),false);
 assert.equal(canReadAgentRun(run,'analyst',{...analyticsOnly,run:false}),false);
 assert.equal(canReadAgentRun({journal:[{tool:'get_clients'}]},'analyst',all),false);
 assert.equal(canReadAgentRun({journal:[{tool:'get_clients'}]},'owner-user',all),true);
 assert.equal(canReadAgentRun({...run,journal:[{tool:'unknown'}]},'analyst',all),false);
});
test('inventory read without finance never sends cost to the model or journal, including derived product fields',()=>{
 const full={...context,inventory:{...context.inventory,products:context.inventory.products.map(product=>({...product,markup:42}))}};
 const limited=scopeAgentContext(full,['get_inventory'],all),output=executeAgentTool('get_inventory',{},limited);
 assert.equal(Object.hasOwn(limited.inventory.products[0],'cost'),false);assert.equal(Object.hasOwn(limited.inventory.products[0],'markup'),false);
 assert.equal(Object.hasOwn(output[0],'cost'),false);assert.equal(output[0].price,100);assert.equal(output[0].quantity,4);
 const finance=scopeAgentContext(full,['get_inventory'],{...all,finance:true});assert.equal(executeAgentTool('get_inventory',{},finance)[0].cost,70);
 assert.equal(full.inventory.products[0].cost,70);
});
test('finance revocation hides cost-bearing and legacy inventory reports but preserves explicitly sanitized reports',()=>{
 const run={actorId:'analyst',tools:['get_inventory'],journal:[{tool:'get_inventory'}]};
 assert.equal(canReadAgentRun(run,'analyst',all),false);
 assert.equal(canReadAgentRun({...run,finance:true},'analyst',all),false);
 assert.equal(canReadAgentRun({...run,finance:false},'analyst',all),true);
 assert.equal(canReadAgentRun(run,'analyst',{...all,finance:true}),true);
});
