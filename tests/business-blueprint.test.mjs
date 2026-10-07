import test from 'node:test';
import assert from 'node:assert/strict';
import {planBusinessBlueprint,planAutomationProposal,applyBlueprint,undoBlueprint,buildAutomationBlueprint} from '../lib/os/business-blueprint.ts';
import {validateWorkflow} from '../lib/os/workflow-validation.ts';
import {parseWorkflowImport} from '../lib/os/workflow-schema.ts';
import {runWorkflow} from '../lib/os/workflow.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
import {initialDeals,initialAgents} from '../lib/os/data.ts';
const defaults={stages:{sales:[{id:'base-1',name:'Первичный контакт',color:'#6499df'},{id:'base-2',name:'Оплата',color:'#54b8a0'}],repeat:[]},settings:{customFields:'Телефон',company:'Demo'},boards:{Обзор:['revenue'],Товары:['stock']},business:{automations:[],finance:[{id:'cash-1',name:'Моя операция'}]}};
const input={workspace:'Тестовый бизнес',text:'Магазин, пять сотрудников',approved:Array(8).fill(true),defaults,now:'2026-10-06T10:00:00Z'};
function memory(seed={}){const data=new Map(Object.entries(seed));return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}}
const value=(storage,key)=>JSON.parse(storage.getItem('life-'+key));
test('setup adds selected real settings without overwriting existing records or permissions',()=>{
 const currentInventory=structuredClone(initialInventory);currentInventory.products[0].stocks.main=123;
 const storage=memory({
  'life-stage-config-v3':JSON.stringify({sales:[{id:'my-stage',name:'Проверка заказа',color:'#333333'},{id:'custom-contact',name:'Первичный контакт',color:'#123456'}],repeat:[{id:'repeat',name:'Повторно',color:'#eee'}]}),
  'life-settings-deep-v2':JSON.stringify({customFields:'Особое поле',company:'Моя фирма'}),
  'life-team-roles-v3':JSON.stringify([{id:'custom-manager',name:'Менеджер',pages:['crm'],actions:[]}]),
  'life-inventory-v2':JSON.stringify(currentInventory),
  'life-analytics-boards-v2':JSON.stringify({Обзор:['custom-metric'],Мой:['my-widget']}),
 });
 applyBlueprint(storage,planBusinessBlueprint(storage,input));
 assert.deepEqual(value(storage,'stage-config-v3').sales.map(stage=>stage.name),['Проверка заказа','Первичный контакт','Оплата']);
 assert.equal(value(storage,'stage-config-v3').sales[1].color,'#123456');
 assert.equal(value(storage,'stage-config-v3').repeat[0].id,'repeat');
 assert.equal(value(storage,'settings-deep-v2').company,'Моя фирма');
 assert.match(value(storage,'settings-deep-v2').customFields,/Особое поле/);
 assert.deepEqual(value(storage,'team-roles-v3')[0].actions,[]);
 assert.equal(value(storage,'team-roles-v3').filter(role=>role.name==='Менеджер').length,1);
 assert.equal(value(storage,'inventory-v2').products[0].stocks.main,123);
 assert.deepEqual(value(storage,'analytics-boards-v2').Мой,['my-widget']);
 assert.equal(value(storage,'analytics-boards-v2').Обзор[0],'custom-metric');
 assert.deepEqual(value(storage,'business-modules-v1').finance,defaults.business.finance);
 assert.equal(value(storage,'workflow-library-v1').length,4);
 assert.equal(value(storage,'business-modules-v1').automations.every(row=>row.workflowId),true);
});
test('unchecked modules stay untouched, existing reports survive, and repeat setup creates no duplicate records',()=>{
 const storage=memory();
 const entries=planBusinessBlueprint(storage,{...input,approved:[false,false,false,false,false,false,true,false]});
 assert.deepEqual(Object.keys(entries).sort(),['life-analytics-boards-v2','life-os-config']);
 applyBlueprint(storage,entries);
 assert.deepEqual(value(storage,'analytics-boards-v2').Товары,['stock']);
 applyBlueprint(storage,planBusinessBlueprint(storage,input));
 const once=Object.fromEntries(storage.data);
 applyBlueprint(storage,planBusinessBlueprint(storage,input));
 assert.deepEqual(Object.fromEntries(storage.data),once);
});
test('all generated workflows open in Builder, validate and execute locally',()=>{
 const {records,snapshots}=buildAutomationBlueprint('Мой магазин',['Первичный контакт','Оплата'],'2026-10-06T10:00:00Z');
 for(const snapshot of snapshots){
  const graph=parseWorkflowImport(snapshot);
  assert.deepEqual(validateWorkflow(graph.nodes,graph.edges,['Первичный контакт','Оплата']),[]);
  const result=runWorkflow(graph.nodes,graph.edges,initialDeals[0],{clients:initialDeals,tasks:[],inventory:initialInventory},{approvedNodes:graph.nodes.map(node=>node.id)});
  assert.equal(result.waitingFor,null);
  assert.equal(result.journal.length,3);
  assert.equal(records.some(record=>record.workflowId===snapshot.id),true);
 }
});
test('industry and selected channel change the actual fields, stages and trigger',()=>{
 const storage=memory();
 applyBlueprint(storage,planBusinessBlueprint(storage,{...input,text:'Сфера: Обучение\nКоманда: 6–15 человек\nКаналы: Telegram\nКонтекст:\nШкола языков'}));
 assert.equal(value(storage,'stage-config-v3').sales.some(stage=>stage.name==='Пробное занятие'),true);
 assert.match(value(storage,'settings-deep-v2').customFields,/Программа обучения/);
 assert.equal(value(storage,'workflow-library-v1')[0].nodes[0].data.source,'Telegram');
 assert.deepEqual(value(storage,'os-config').profile,{industry:'Обучение',team:'6–15 человек',channels:['Telegram']});
});
test('multi-store setup rolls back save failures and undo protects edits made afterwards',()=>{
 const storage=memory({'life-a':'old'});let fail=true;
 const failing={...storage,setItem:(key,value)=>{if(key==='life-b'&&fail){fail=false;throw new Error('Quota')}storage.setItem(key,value)}};
 assert.throws(()=>applyBlueprint(failing,{'life-a':{new:true},'life-b':[]}));
 assert.deepEqual(Object.fromEntries(storage.data),{'life-a':'old'});
 const snapshot=applyBlueprint(storage,{'life-a':{new:true},'life-b':[]});
 storage.setItem('life-b','[1]');
 assert.throws(()=>undoBlueprint(storage,snapshot),/уже менялись/);
 assert.equal(storage.getItem('life-b'),'[1]');
 storage.setItem('life-b','[]');undoBlueprint(storage,snapshot);
 assert.deepEqual(Object.fromEntries(storage.data),{'life-a':'old'});
});
test('each copilot selection saves only its selected actions in a linked, executable Builder graph',()=>{
 for(let mask=0;mask<8;mask++){
  const selected=[true,Boolean(mask&1),Boolean(mask&2),Boolean(mask&4)];
  const storage=memory();
  applyBlueprint(storage,planAutomationProposal(storage,selected,'Проверить клиента',defaults.business,'proposal-'+mask,input.now));
  const [record]=value(storage,'business-modules-v1').automations;
  const [saved]=value(storage,'workflow-library-v1');
  assert.equal(record.workflowId,saved.id);
  assert.equal(record.status,'Пауза');
  assert.equal(record.value,0);
  const graph=parseWorkflowImport(saved);
  assert.deepEqual(validateWorkflow(graph.nodes,graph.edges,['Первичный контакт']),[]);
  assert.deepEqual(graph.nodes.map(node=>node.data.kind),['Trigger',...(selected[1]?['Delay']:[]),...(selected[2]?['CRM']:[]),...(selected[3]?['Message']:[])]);
  const client={...initialDeals[0],status:'Первичный контакт'};
  const context={clients:[client],tasks:[],inventory:initialInventory,agents:initialAgents,stages:defaults.stages.sales};
  const first=runWorkflow(graph.nodes,graph.edges,client,context,{now:input.now});
  assert.equal(first.waitingType,selected[1]?'delay':null);
  if(selected[1]){assert.equal(first.updated.owner,client.owner);assert.equal(first.drafts.length,0);assert.match(first.journal.at(-1).result,/10 минут/)}
  const done=runWorkflow(graph.nodes,graph.edges,client,context,{approvedNodes:graph.nodes.map(node=>node.id),now:input.now});
  assert.equal(done.updated.owner,selected[2]?'Sales Agent':client.owner);
  assert.equal(done.updated.agentId,selected[2]?'A0':undefined);
  assert.equal(done.drafts.length,selected[3]?1:0);
  if(selected[3]){assert.match(done.drafts[0],new RegExp(done.updated.owner));assert.match(done.journal.at(-1).result,/Менеджер, без отправки/)}
  assert.equal(client.owner,initialDeals[0].owner);
 }
});
test('copilot preserves existing records and edited graphs; missing creation or unavailable agent never writes',()=>{
 const business={...defaults.business,automations:[{id:'custom',name:'Мой сценарий',workflowId:'edited',custom:'keep'}]};
 const edited={id:'edited',name:'Моя схема',nodes:[],edges:[],custom:'keep'};
 const storage=memory({'life-business-modules-v1':JSON.stringify(business),'life-workflow-library-v1':JSON.stringify([edited])});
 applyBlueprint(storage,planAutomationProposal(storage,[true,false,true,false],'',defaults.business,'new-proposal',input.now));
 assert.deepEqual(value(storage,'business-modules-v1').automations[0],business.automations[0]);
 assert.deepEqual(value(storage,'workflow-library-v1')[0],edited);
 assert.deepEqual(value(storage,'business-modules-v1').finance,business.finance);
 const before=Object.fromEntries(storage.data);
 assert.throws(()=>planAutomationProposal(storage,[false,true,true,true],'',defaults.business,'absent',input.now),/Создать автоматизацию/);
 assert.deepEqual(Object.fromEntries(storage.data),before);
 storage.setItem('life-agents',JSON.stringify(initialAgents.map(agent=>({...agent,status:'Пауза'}))));
 assert.throws(()=>planAutomationProposal(storage,[true,false,true,false],'',defaults.business,'absent',input.now),/Включите Sales Agent/);
 assert.equal(value(storage,'business-modules-v1').automations.length,2);
 assert.doesNotThrow(()=>planAutomationProposal(storage,[true,false,false,true],'',defaults.business,'draft-only',input.now));
});
