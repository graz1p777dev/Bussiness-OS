import test from 'node:test';
import assert from 'node:assert/strict';
import {linkStarterAutomations,automationFingerprint} from '../lib/os/automations.ts';
import {buildAutomationBlueprint} from '../lib/os/business-blueprint.ts';
import {initialDeals,initialTasks} from '../lib/os/data.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
const stages=['Первичный контакт','Оплата'];
const row={id:'BM-50',name:'Моя версия названия',value:9,status:'Пауза',owner:'Медина',channel:'lead.created',note:'Мои условия'};

test('starter automation migration retains edits and custom graphs, and is idempotent',()=>{
 const prepared=buildAutomationBlueprint('Workspace',stages);
 const saved=structuredClone(prepared.snapshots[0]);saved.nodes[1].data.tool='get_analytics';
 const other={...row,id:'custom',name:'Свой сценарий'};
 const before=structuredClone([row,other]);
 const result=linkStarterAutomations([row,other],[saved],'Workspace',stages);
 assert.deepEqual([row,other],before);
 assert.deepEqual(result.records[0],{...row,workflowId:saved.id});
 assert.deepEqual(result.records[1],other);
 assert.equal(result.library.length,1);
 assert.equal(result.library[0].nodes[1].data.tool,'get_analytics');
 const repeated=linkStarterAutomations(result.records,result.library,'Workspace',stages);
 assert.deepEqual(repeated,result);
 assert.deepEqual(linkStarterAutomations([],[],'Workspace',stages),{records:[],library:[]});
});

test('removed workflow references stay visible as missing, rather than silently restoring a graph',()=>{
 const record={...row,workflowId:'removed-snapshot'};
 const result=linkStarterAutomations([record],[],'Workspace',stages);
 assert.deepEqual(result,{records:[record],library:[]});
});

test('pending runs become stale when actual data or semantic graph changes, not when blocks move',()=>{
 const flow=buildAutomationBlueprint('Workspace',stages).snapshots[0];
 const client=initialDeals[0],context={clients:initialDeals,tasks:initialTasks,inventory:initialInventory};
 const base=automationFingerprint(flow,client,context,stages);
 const moved=structuredClone(flow);moved.nodes[0].position.x+=100;
 assert.equal(automationFingerprint(moved,client,context,stages),base);
 const changed=structuredClone(flow);changed.nodes[1].data.tool='get_analytics';
 assert.notEqual(automationFingerprint(changed,client,context,stages),base);
 assert.notEqual(automationFingerprint(flow,{...client,note:'Изменённый запрос'},context,stages),base);
 const stock=structuredClone(initialInventory);stock.products[0].price+=1;
 assert.notEqual(automationFingerprint(flow,client,{...context,inventory:stock},stages),base);
 assert.notEqual(automationFingerprint(flow,client,{...context,tasks:[]},stages),base);
 assert.notEqual(automationFingerprint(flow,client,context,['Новый этап']),base);
});
