import test from 'node:test';
import assert from 'node:assert/strict';
import {planningBaseline,decomposeGoal} from '../lib/os/planning.ts';
test('planning uses net receipts within period and explicit customer conversions',()=>{
 const sales=[{date:'2026-10-06',total:1000,refunds:200,customerId:'c1'},{date:'2026-10-06',total:500,refunds:0,customerId:'c1'},{date:'2026-08-01',total:9000,refunds:0}];
 const result=planningBaseline(sales,[{id:'d1',customerId:'c1',createdAt:'2026-10-02'},{id:'d2',customerId:'c2',createdAt:'2026-10-03'}],30,new Date('2026-10-07'));
 assert.equal(result.revenue,1300);assert.equal(result.averageCheck,650);assert.equal(result.conversion,50);
});
test('goal decomposition rounds required volumes upward and rejects invalid assumptions',()=>{
 assert.deepEqual(decomposeGoal(3000000,5000,30,30),{sales:600,leads:2000,dailyLeads:67,dailyRevenue:100000});
 for(const values of [[0,5000,30,30],[100,0,30,30],[100,10,101,30],[100,10,30,0]])assert.throws(()=>decomposeGoal(...values));
});

import {defaultPlanningPlan,defaultPlanningPeriod,normalizePlanningPlan,validatePlanning,scopePlanningData,planningForecast,normalizeOpportunities,saveOpportunity,removeOpportunity,defaultPlanningAgent,decodePlanningAgent,encodePlanningAgent,generatePlanningOpportunities,opportunityTask} from '../lib/os/planning.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
import {initialEmployees} from '../lib/os/team.ts';
import {defaultSettingsDocument,setSettingsAlias,readSettingsAlias} from '../lib/os/settings-document.ts';
const all={crm:true,sales:true,inventory:true,tasks:true,employees:true};
const none={crm:false,sales:false,inventory:false,tasks:false,employees:false};
const now=new Date('2026-10-08T12:00:00.000Z');
const period={...defaultPlanningPeriod(now),start:'2026-10-08',end:'2026-11-06'};
const plan={...defaultPlanningPlan,revenue:100000,check:1000,conversion:25,days:20,repeatRate:20,itemsPerSale:2,dailyCapacity:8};
const sale=(id,date='2026-10-07',extra={})=>({id,date,shiftId:'s1',warehouse:'main',items:[{productId:'SKU-100',name:'SPF',quantity:4,price:1000,cost:400,returned:1}],discount:0,total:4000,payments:{Наличные:4000},refunds:1000,status:'Частичный возврат',customerId:id,...extra});
const data=()=>({sales:[sale('c1')],deals:[{id:'d1',customerId:'c1',createdAt:'2026-10-02',value:500000,status:'Первичный контакт',pipeline:'Продажи',name:'Клиент',channel:'WhatsApp',owner:'Айым',note:''}],inventory:structuredClone(initialInventory),tasks:[{id:'t1',name:'Просроченная',value:0,status:'To Do',channel:'Высокий',owner:'Айым',note:'',nextTaskAt:'2026-10-01'}],employees:structuredClone(initialEmployees)});
const opportunity=()=>({id:'manual1',title:'Повторные продажи',action:'Проверить отклик после контакта',status:'Идея',category:'Продажи',priority:'Средний',ownerId:'',due:'2026-10-31',metric:'Покупки',target:20,result:'',source:'manual',evidence:'',sources:[],createdAt:now.toISOString(),updatedAt:now.toISOString()});

test('cohort conversion excludes anonymous and unrelated buyers, duplicate deals and prior purchases',()=>{
 const deals=[{id:'d1',customerId:'c1',createdAt:'2026-10-02'},{id:'d2',customerId:'c1',createdAt:'2026-10-03'},{id:'d3',customerId:'c2',createdAt:'2026-10-04'}];
 const result=planningBaseline([sale('c1'),sale('unrelated'),sale('anonymous','2026-10-06',{customerId:undefined}),sale('c2','2026-10-03')],deals,30,now);
 assert.equal(result.leads,3);assert.equal(result.cohortCustomers,2);assert.equal(result.converted,1);assert.equal(result.conversion,50);assert.equal(result.unlinkedSales,1);
});
test('forecast uses paid net receipts, never CRM potential, and transparent plan assumptions',()=>{
 const result=planningForecast(plan,period,data(),all,now);
 assert.equal(result.baseline.revenue,3000);assert.equal(result.pace,3000);assert.equal(result.gap,97000);assert.equal(result.sales,100);assert.equal(result.customers,80);assert.equal(result.leads,320);assert.equal(result.dailyLeads,16);assert.equal(result.neededEmployees,2);assert.equal(result.units,200);assert.ok(result.assumptions.length>=4);
 const noSales=data();noSales.sales=[];assert.equal(planningForecast(plan,period,noSales,all,now).pace,null);
});
test('old decomposition fields migrate and invalid periods or assumptions fail before saving',()=>{
 const legacy=normalizePlanningPlan({revenue:50000,check:800,conversion:20,days:15,adBudget:0});assert.equal(legacy.revenue,50000);assert.equal(legacy.dailyCapacity,20);
 for(const changed of [{...plan,days:31},{...plan,repeatRate:100},{...plan,itemsPerSale:0},{...plan,dailyCapacity:0},{...plan,adBudget:-1}])assert.throws(()=>validatePlanning(changed,period));
 for(const changed of [{...period,start:'2026-02-30'},{...period,end:'2026-01-01'},{...period,baselineDays:12}])assert.throws(()=>validatePlanning(plan,changed));
});
test('selected employees exclude inactive accounts and product allocation sums to required units',()=>{
 const source=data();source.employees[1].status='Уволен';source.inventory.products[1].productType='Услуга';
 const selected={...period,employeeIds:['owner-user','aiym'],productIds:['SKU-100','SKU-101']};const result=planningForecast(plan,selected,source,all,now);
 assert.equal(result.employeePlan.length,1);assert.equal(result.employeePlan[0].id,'owner-user');assert.equal(result.productPlan.length,2);assert.equal(result.productPlan.reduce((sum,item)=>sum+item.required,0),200);assert.equal(result.productPlan[1].stock,null);assert.equal(result.productPlan[1].shortage,0);
 source.sales=[];const equal=planningForecast({...plan,revenue:1500,itemsPerSale:1},selected,source,all,now);assert.equal(equal.productPlan.reduce((sum,item)=>sum+item.required,0),2);assert.match(equal.productBasis,/Равные/);
});
test('denied data is removed before forecast and suggestions, including sales nested in inventory',()=>{
 const source=data();source.inventory.sales=[sale('secret')];const scoped=scopePlanningData(source,{...none,inventory:true});assert.equal(scoped.inventory.sales.length,0);assert.equal(scoped.sales.length,0);assert.equal(scoped.deals.length,0);assert.equal(scoped.tasks.length,0);assert.equal(scoped.employees.length,0);
 const result=planningForecast(plan,period,source,none,now);assert.equal(result.pace,null);assert.equal(result.baseline.revenue,0);assert.equal(result.baseline.leads,0);assert.deepEqual(result.employeePlan,[]);assert.deepEqual(result.productPlan,[]);
 const rows=generatePlanningOpportunities(plan,period,source,{...none,tasks:true},{...defaultPlanningAgent,sources:['tasks']},true,now);assert.equal(rows.length,1);assert.equal(rows[0].id,'analysis:overdue-tasks');assert.deepEqual(rows[0].sources,['tasks']);assert.ok(!JSON.stringify(rows).includes('500000'));
});
test('manual map CRUD enforces role and preserves legacy titles/actions',()=>{
 const migrated=normalizeOpportunities([{id:'old',title:'Старая идея',action:'Сделать',status:'В работе'}]);assert.equal(migrated[0].title,'Старая идея');assert.deepEqual(migrated[0].sources,[]);
 assert.throws(()=>saveOpportunity([],opportunity(),true,false),/запрещено/);let rows=saveOpportunity([],opportunity(),false,true);assert.throws(()=>saveOpportunity(rows,{...rows[0],title:'Изменено'},false,true),/запрещено/);
 rows=saveOpportunity(rows,{...rows[0],status:'Проверено',result:'Получено 21 покупок'},true,false);assert.equal(rows[0].result,'Получено 21 покупок');assert.throws(()=>removeOpportunity(rows,'manual1',false),/запрещено/);assert.equal(removeOpportunity(rows,'manual1',true).length,0);
 assert.throws(()=>saveOpportunity([], {...opportunity(),target:-1},true,true),/неотрицательной/);assert.throws(()=>saveOpportunity([], {...opportunity(),due:'2026-02-31'},true,true),/срок/);
});
test('agent config persists via canonical agent-settings and refuses unavailable grants',()=>{
 const agent={...defaultPlanningAgent,sources:['crm','sales'],frequency:'weekly',time:'10:30',weekday:2},encoded=encodePlanningAgent(agent,true,all);
 const document=setSettingsAlias(defaultSettingsDocument,'agent-settings',{'planning-opportunities':encoded});assert.deepEqual(decodePlanningAgent(readSettingsAlias(document,'agent-settings')['planning-opportunities']),agent);
 assert.throws(()=>encodePlanningAgent(agent,false,all),/запрещена/);assert.throws(()=>encodePlanningAgent(agent,true,{...all,sales:false}),/недоступен/);assert.throws(()=>encodePlanningAgent({...agent,time:'99:00'},true,all),/расписание/);
 assert.deepEqual(decodePlanningAgent({entities:'{}',storePermissions:'null',schedule:'null'}).sources,[]);assert.deepEqual(decodePlanningAgent({entities:'[]',storePermissions:'{}'}).permissions,[]);
});
test('analysis respects activation, explicit rights, selected sources and unavailable model',()=>{
 assert.throws(()=>generatePlanningOpportunities(plan,period,data(),all,defaultPlanningAgent,false,now),/запрещён/);
 assert.throws(()=>generatePlanningOpportunities(plan,period,data(),all,{...defaultPlanningAgent,enabled:false},true,now),/Включите/);
 assert.throws(()=>generatePlanningOpportunities(plan,period,data(),all,{...defaultPlanningAgent,permissions:['read']},true,now),/Включите/);
 assert.throws(()=>generatePlanningOpportunities(plan,period,data(),all,{...defaultPlanningAgent,model:'Claude'},true,now),/не подключена/);
 assert.throws(()=>generatePlanningOpportunities(plan,period,data(),none,defaultPlanningAgent,true,now),/источник/);
 const rows=generatePlanningOpportunities(plan,period,data(),all,defaultPlanningAgent,true,now);assert.ok(rows.some(row=>row.id==='analysis:revenue-gap'));assert.ok(rows.some(row=>row.id==='analysis:open-deals'));assert.ok(rows.every(row=>row.source==='local-analysis'&&row.evidence&&row.sources.length));
});
test('opportunity tasks link to the map, employee and deadline, with duplicate and permission checks',()=>{
 const item=opportunity(),owner={id:'owner-user',name:'Алихан'},task=opportunityTask([],item,owner,'2026-10-31','t1',true,true)[0];
 assert.equal(task.planId,'planning-opportunity:manual1');assert.equal(task.employeeId,'owner-user');assert.equal(task.nextTaskAt,'2026-10-31');assert.match(task.note,/Покупки — 20/);
 assert.throws(()=>opportunityTask([task],item,owner,'2026-10-31','t2',true,true),/уже есть/);assert.throws(()=>opportunityTask([],item,owner,'2026-10-31','t1',false,true),/запрещено/);assert.throws(()=>opportunityTask([],item,undefined,'2026-10-31','t1',true,true),/сотрудника/);
});
