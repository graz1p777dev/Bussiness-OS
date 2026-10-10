import test from 'node:test';
import assert from 'node:assert/strict';
import {liveMetricResult,liveWidgetSchema,liveAnalyticsConfigSchema,validateLivePeriod} from '../lib/os/live-analytics.ts';
const access=Object.fromEntries(['crm','sales','inventory','tasks','appointments','agents','marketing','employees','finance','edit','export'].map(key=>[key,true]));
const blank=()=>({deals:[],inventory:{products:[],warehouses:[],documents:[],sales:[],shifts:[]},tasks:[],appointments:[],runs:[],employees:[],marketing:[]});
const widget=(metric,group='none')=>({id:'test',title:'Test',metric,kind:group==='none'?'metric':'table',group});
const result=(metric,data,group='none',permissions=access)=>liveMetricResult(widget(metric,group),data,permissions,'owner','2026-10-01','2026-10-31');
const deal=(id,extra={})=>({id,name:id,value:100,status:'Новый',channel:'WhatsApp',owner:'Айым',note:'',...extra});

test('sales use saved receipts and refunds once, never CRM potential; buyers are distinct and exclude full refunds',()=>{
 const data=blank();data.deals=[deal('huge',{value:9999999})];data.inventory.sales=[{id:'s1',date:'2026-10-03',total:1000,refunds:200,customerId:'c1',status:'Частичный возврат'},{id:'s2',date:'2026-10-04',total:500,refunds:0,customerId:'c1',status:'Продажа'},{id:'s3',date:'2026-10-04',total:500,refunds:500,customerId:'c2',status:'Возврат'},{id:'s4',date:'2026-10-05',total:300,refunds:0,status:'Продажа'},{id:'old',date:'2026-09-01',total:10000,refunds:0,customerId:'old'}];
 assert.equal(result('revenue',data).value,1600);assert.equal(result('sales',data).value,4);assert.equal(result('refunds',data).value,700);assert.equal(result('averageCheck',data).value,400);assert.equal(result('buyers',data).value,1);
 assert.deepEqual(result('revenue',data,'date').rows.map(row=>[row.name,row.value]),[['2026-10-03',800],['2026-10-04',500],['2026-10-05',300]]);
 data.inventory.sales[0].refunds=1000;assert.equal(result('revenue',data).value,800);
});
test('snapshot CRM excludes closed pipeline and legacy status, keeps current totals, and counts missing dates honestly',()=>{
 const data=blank();data.deals=[deal('a',{customerId:'same',createdAt:'2026-10-02'}),deal('b',{customerId:'same',pipeline:'Успешно',value:800,createdAt:'2026-09-01'}),deal('c',{pipeline:'Продажи',status:'Успешно',value:700}),deal('d',{status:'Неуспешно',createdAt:'bad',value:600})];
 assert.equal(result('potential',data).value,100);assert.equal(result('clients',data).value,3);assert.equal(result('wonRate',data).value,50);assert.equal(result('leads',data).value,1);assert.equal(result('leads',data).undated,2);
 const before=JSON.stringify(data);result('potential',data,'owner');assert.equal(JSON.stringify(data),before);
});
test('inventory excludes deleted items and services; task and employee counts use actual statuses',()=>{
 const data=blank();data.inventory.products=[{id:'a',stocks:{main:2,reserve:2},minimum:5,category:'Уход'},{id:'b',stocks:{main:3},minimum:1,category:'Уход'},{id:'service',productType:'service',stocks:{main:999},minimum:1000},{id:'deleted',deleted:true,stocks:{main:999},minimum:1000}];data.tasks=[deal('a',{status:'Done'}),deal('b',{status:'Выполнено'}),deal('c',{status:'In Progress'})];data.employees=[{status:'Активен',department:'Продажи',salary:900000},{status:'Уволен'}];
 assert.equal(result('stock',data).value,7);assert.equal(result('lowStock',data).value,1);assert.equal(result('openTasks',data).value,1);assert.equal(result('employees',data).value,1);assert.doesNotMatch(JSON.stringify(result('employees',data,'category')),/salary|900000/);
});
test('ISO timestamps follow company timezone while calendar dates remain literal',()=>{
 const data=blank();data.inventory.sales=[{date:'2026-10-09T21:00:00Z',total:400,refunds:0},{date:'2026-10-10',total:300,refunds:0}];
 const kyrgyz=liveMetricResult(widget('revenue','date'),data,access,'owner','2026-10-10','2026-10-10','Asia/Bishkek');assert.equal(kyrgyz.value,700);assert.equal(kyrgyz.rows[0].name,'2026-10-10');
 const utc=liveMetricResult(widget('revenue'),data,access,'owner','2026-10-10','2026-10-10','UTC');assert.equal(utc.value,300);
});
test('agent history requires actor and current scopes including finance, and all metrics deny closed sources',()=>{
 const data=blank();data.runs=[{actorId:'owner',tools:['get_tasks'],journal:[],startedAt:'2026-10-03T12:00:00Z',status:'completed'},{actorId:'another',tools:[],journal:[],startedAt:'2026-10-03',status:'completed'},{actorId:'owner',tools:['get_inventory'],finance:true,journal:[],startedAt:'2026-10-03',status:'completed'},{actorId:'owner',tools:[],journal:[],startedAt:'10 октября',status:'completed'}];
 assert.equal(result('runs',data).value,2);assert.equal(result('runs',data).undated,1);assert.equal(result('runs',data,'none',{...access,finance:false,tasks:false}).value,0);
 for(const [metric,source] of [['revenue','sales'],['potential','crm'],['stock','inventory'],['openTasks','tasks'],['campaignBudget','marketing'],['employees','employees'],['appointments','appointments'],['runs','agents']])assert.throws(()=>result(metric,data,'none',{...access,[source]:false}),/недоступен/);
});
test('campaign budgets and appointments are stored counts, not invented spend or attendance',()=>{
 const data=blank();data.marketing=[deal('m1',{value:500,status:'Пауза'}),deal('m2',{value:700})];data.appointments=[{date:'2026-10-08',status:'Отменена'},{date:'2026-09-08',status:'Завершена'}];
 assert.equal(result('campaignBudget',data).value,1200);assert.match(result('campaignBudget',data).definition.description,/не фактически/);assert.equal(result('campaigns',data).value,2);assert.equal(result('appointments',data).value,1);
});
test('builder accepts only supported metrics, groups, shapes and bounded unique layouts',()=>{
 assert.equal(liveWidgetSchema.safeParse(widget('revenue','date')).success,true);
 for(const invalid of [{...widget('revenue'),formula:'eval()'},widget('fakeProfit'),widget('stock','date'),{...widget('sales'),group:'date'},{...widget('sales'),title:'  '}])assert.equal(liveWidgetSchema.safeParse(invalid).success,false);
 assert.equal(liveAnalyticsConfigSchema.safeParse({owner:[widget('revenue')],other:[widget('stock')]}).success,true);assert.equal(liveAnalyticsConfigSchema.safeParse({owner:[widget('revenue'),widget('sales')]}).success,false);assert.equal(liveAnalyticsConfigSchema.safeParse({owner:Array.from({length:25},(_,i)=>({...widget('revenue'),id:String(i)}))}).success,false);
 for(const dates of [['2026-02-30','2026-03-02'],['2026-10-10','2026-10-01'],['2025-01-01','2026-10-01'],['','2026-10-01']])assert.throws(()=>validateLivePeriod(...dates));assert.doesNotThrow(()=>validateLivePeriod('2026-10-10','2026-10-10'));
});
