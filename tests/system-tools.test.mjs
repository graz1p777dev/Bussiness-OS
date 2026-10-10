import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedSystemTools,executeSystemRead,calendarToolArguments,inferSystemTool} from '../lib/os/system-tools.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
const clients=[{id:'C1',name:'Айжан',phone:'+996555123456',value:100,status:'Новая',channel:'WhatsApp',owner:'Айым',note:''}];
test('OS tools deny hidden pages even when raw context contains data',()=>{const context={clients,tasks:[],inventory:initialInventory,employees:[],can:page=>page==='tasks'};assert.throws(()=>executeSystemRead('get_clients',{},context),/недоступен/);assert.throws(()=>executeSystemRead('get_analytics',{},context),/недоступен/);assert.deepEqual(allowedSystemTools(context.can).map(tool=>tool.name),['get_tasks','create_task']);});
test('OS read does not expose cost without finance access and never executes writes',()=>{const context={clients,tasks:[],inventory:initialInventory,employees:[],can:page=>page==='inventory'||page==='customers'};assert.equal('cost' in executeSystemRead('get_inventory',{},context)[0],false);assert.throws(()=>executeSystemRead('create_client',{},context),/подтверждения/);assert.equal(context.clients.length,1);});
test('OS customer search matches a phone and returns stable relation identifiers',()=>{const context={clients,tasks:[],inventory:initialInventory,employees:[],can:()=>true};assert.equal(executeSystemRead('get_clients',{query:'123456'},context)[0].customerId,'C1');assert.deepEqual(executeSystemRead('get_clients',{query:'неизвестный'},context),[]);});

test('dialog tool reads linked saved messages only with conversations permission',()=>{
 const context={clients:[{id:'d1',name:'Айжан',channel:'WhatsApp'},{id:'d2',name:'Другой',channel:'Telegram'}],tasks:[],employees:[],inventory:{products:[],sales:[],shifts:[]},messages:{d1:[{id:'m1',text:'Есть в наличии?',direction:'incoming'}],d2:['PRIVATE']},can:page=>page==='conversations'};
 const result=executeSystemRead('get_dialogs',{query:'Айжан'},context);
 assert.equal(result.length,1);assert.equal(result[0].messages[0].text,'Есть в наличии?');
 assert.throws(()=>executeSystemRead('get_dialogs',{}, {...context,can:()=>false}),/недоступен/);
});

test('sales tool redacts customer identity and cannot search hidden customer names',()=>{
 const context={clients:[],tasks:[],employees:[],inventory:{products:[],shifts:[],sales:[{id:'s1',date:'2026-10-10',items:[{name:'SPF'}],customerId:'secret-id',customerName:'PRIVATE',total:100,refunds:0,status:'Оплачен'}]},can:page=>page==='pos'};
 const result=executeSystemRead('get_sales',{},context);
 assert.equal(result[0].total,100);assert.equal('customerId' in result[0],false);assert.equal('customerName' in result[0],false);
 assert.deepEqual(executeSystemRead('get_sales',{query:'PRIVATE'},context),[]);
});

test('analytics permission alone never exposes unreadable source data',()=>{
 const context={clients,tasks:[],employees:[],inventory:initialInventory,can:page=>page==='analytics'};
 assert.deepEqual(executeSystemRead('get_analytics',{},context),{});
 const crm=executeSystemRead('get_analytics',{}, {...context,can:page=>['analytics','crm'].includes(page)});
 assert.equal(crm.leads,1);assert.equal('revenue' in crm,false);
});

test('agent catalog returns saved identities only with agent page access',()=>{
 const context={clients:[],tasks:[],employees:[],inventory:initialInventory,agents:[{id:'agent1',name:'Sales Agent',status:'Активен',note:'Продажи',prompt:'SECRET'}],can:page=>page==='agents'};
 assert.deepEqual(executeSystemRead('get_agents',{query:'Sales'},context),[{id:'agent1',name:'Sales Agent',status:'Активен',description:'Продажи'}]);
 assert.throws(()=>executeSystemRead('get_agents',{}, {...context,can:()=>false}),/недоступен/);
});

test('business plan tool exposes selected goal fields without budget or hidden source data',()=>{
 const context={clients:[],tasks:[],employees:[],inventory:initialInventory,plan:{revenue:3000000,check:5000,conversion:30,days:26,dailyCapacity:20,adBudget:60000},can:page=>page==='planning'};
 assert.deepEqual(executeSystemRead('get_planning',{},context),{targetRevenue:3000000,averageCheck:5000,conversion:30,workDays:26,dailyCapacity:20});
 assert.throws(()=>executeSystemRead('get_planning',{}, {...context,can:()=>false}),/недоступен/);
});


test('calendar reads require both calendar and source access and expose only six safe fields',()=>{
 const event={id:'task:t1',recordId:'t1',source:'task',title:'Встреча Айжан',date:'2026-10-10',time:'10:00',owner:'PRIVATE',ownerId:'employee',note:'PRIVATE NOTE',amount:9000,completed:false,status:'В работе'};
 const context={clients:[],tasks:[],employees:[],inventory:initialInventory,calendar:[event,{...event,id:'finance:f1',recordId:'f1',source:'finance',title:'PRIVATE FINANCE'}],can:page=>['calendar','tasks'].includes(page)};
 assert.deepEqual(executeSystemRead('get_calendar',{},context),[{id:'task:t1',recordId:'t1',source:'task',title:'Встреча Айжан',date:'2026-10-10',time:'10:00'}]);
 assert.deepEqual(executeSystemRead('get_calendar',{query:'private'},context),[]);
 assert.throws(()=>executeSystemRead('get_calendar',{}, {...context,can:page=>page==='tasks'}),/недоступен/);
 assert.deepEqual(executeSystemRead('get_calendar',{}, {...context,calendar:undefined}),[]);
});

test('calendar date and text filters compose and natural request arguments do not search command words',()=>{
 const events=[{id:'task:a',recordId:'a',source:'task',title:'Планёрка',date:'2026-10-10',time:'10:00'},{id:'task:b',recordId:'b',source:'task',title:'Планёрка',date:'2026-10-11',time:'11:00'}];
 const context={clients:[],tasks:[],employees:[],inventory:initialInventory,calendar:events,can:()=>true};
 assert.deepEqual(calendarToolArguments('Покажи календарь на 2026-10-10'),{date:'2026-10-10',query:''});
 assert.deepEqual(calendarToolArguments('Найди в календаре Планёрка 2026-10-10'),{date:'2026-10-10',query:'Планёрка'});
 assert.equal(inferSystemTool('Покажи календарь: планёрка'),'get_calendar');
 assert.deepEqual(executeSystemRead('get_calendar',{query:'планёрка',date:'2026-10-10'},context).map(event=>event.id),['task:a']);
 assert.equal(executeSystemRead('get_calendar',{query:'Задачи'},context).length,2);
 assert.deepEqual(executeSystemRead('get_calendar',{query:'2026-10-11'},context).map(event=>event.id),['task:b']);
 assert.throws(()=>executeSystemRead('get_calendar',{date:'2026-02-30'},context),/существующую дату/);
});

test('read settings uses appearance whitelist and is distinct from an update request',()=>{
 const appearance={theme:'Dark',accent:'Violet',collapsed:false,fontFamily:'system',density:'compact',fontSize:14,motion:true,lowPower:false};
 const context={clients:[],tasks:[],employees:[],inventory:initialInventory,appearance:{...appearance,apiKey:'PRIVATE',prompt:'PRIVATE',company:'PRIVATE'},can:page=>page==='settings'};
 assert.deepEqual(executeSystemRead('get_settings',{},context),appearance);
 assert.deepEqual(executeSystemRead('get_settings',{}, {...context,appearance:undefined}),{});
 assert.throws(()=>executeSystemRead('get_settings',{}, {...context,can:()=>false}),/недоступен/);
 assert.equal(inferSystemTool('Покажи настройки'),'get_settings');assert.equal(inferSystemTool('Покажи тему'),'get_settings');assert.equal(inferSystemTool('Измени настройки'),'update_settings');assert.equal(inferSystemTool('Настрой внешний вид'),'update_settings');
});
