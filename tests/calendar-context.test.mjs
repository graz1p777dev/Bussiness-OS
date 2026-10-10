import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarContextAccess,calendarDayInsights,calendarImportantDates,calendarRecordInScope,calendarWeekLabel,selectCalendarDayContext} from '../lib/os/calendar-context.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
const person=(id,name)=>({id,name,email:id+'@example.com',role:'manager',position:'Менеджер',status:'Активен'});
const people=[person('u1','Айым Один'),person('u2','Айым Два'),person('u3','Медина Три')];
const record=(id,extra={})=>({id,name:id,value:100,status:'To Do',channel:'Средний',owner:'Айым Один',employeeId:'u1',note:'',...extra});
const scope={actorId:'u1',ownOnly:false,canAI:true,timeZone:'Asia/Bishkek'};
const base=()=>({employees:people,business:{calendar:[]},consultations:[],deals:[],tasks:[],inventory:structuredClone(initialInventory)});
const sale=(id,extra={})=>({id,date:'2026-10-09T21:00:00Z',shiftId:'s1',warehouse:'main',items:[{productId:'p1',name:'Услуга',quantity:1,price:200,cost:50,returned:0}],discount:0,total:200,payments:{Наличные:200},refunds:0,status:'Оплачен',...extra});
const shift=(id,cashier)=>({id,cashier,warehouse:'main',register:'Касса',opening:0,opened:'2026-10-01',closed:'',actual:null});

test('day context uses company timezone and refunds on their operation day, without mutating records',()=>{
 const data=base();data.inventory.shifts=[shift('s1','Айым Один')];
 data.inventory.sales=[sale('receipt',{refunds:50,refundHistory:[{id:'r1',date:'2026-10-11T00:00:00+06:00',shiftId:'s1',cashier:'Айым Один',reason:'Частичный возврат',amount:50,payments:{Наличные:50},quantities:{p1:1}}]})];
 data.tasks=[record('task',{nextTaskAt:'2026-10-09T22:00:00Z'})];const before=structuredClone(data);
 const day=selectCalendarDayContext('2026-10-10',data,scope);assert.equal(day.metrics.gross,200);assert.equal(day.metrics.refunds,0);assert.equal(day.metrics.net,200);assert.equal(day.tasks.length,1);assert.equal(day.sales[0].time,'03:00');
 const next=selectCalendarDayContext('2026-10-11',data,scope);assert.equal(next.metrics.gross,0);assert.equal(next.metrics.refunds,50);assert.equal(next.metrics.net,-50);assert.equal(next.sales[0].saleId,'receipt');assert.deepEqual(data,before);
 assert.throws(()=>selectCalendarDayContext('2026-02-30',data,scope),/дату/);
});

test('stable client IDs join day tasks, appointments and receipts; equal names never merge people',()=>{
 const data=base();data.inventory.shifts=[shift('s1','Айым Один')];
 data.deals=[record('d1',{customerId:'c1',name:'Одинаковое имя',createdAt:'2026-10-09',nextTaskAt:'2026-10-10',status:'Контакт'}),record('d2',{customerId:'c1',name:'Одинаковое имя',createdAt:'2026-10-10',status:'Оплата'}),record('d3',{customerId:'c2',name:'Одинаковое имя',createdAt:'2026-10-10'}),record('d4',{name:'Без связи',createdAt:'2026-01-01'})];
 data.tasks=[record('t1',{nextTaskAt:'2026-10-10',clientId:'c1'})];
 data.consultations=[{id:'appointment',client:'Без связи',employee:'Айым Один',employeeId:'u1',clientId:'c2',date:'2026-10-10',time:'10:00',status:'Подтверждена',note:''},{id:'unlinked',client:'Без связи',employee:'Айым Один',date:'2026-10-10',time:'11:00',status:'Подтверждена',note:''}];
 data.inventory.sales=[sale('receipt',{customerId:'c1',customerName:'Одинаковое имя'})];
 const result=selectCalendarDayContext('2026-10-10',data,scope);assert.equal(result.clients.length,2);assert.equal(result.newClients,1);const client=result.clients.find(x=>x.id==='c1');assert.deepEqual(client.dealIds,['d1','d2']);assert.ok(client.reasons.includes('Задача на день'));assert.ok(client.reasons.includes('Кассовая операция'));assert.ok(!result.clients.some(x=>x.id==='d4'));
});

test('page permissions remove source data and customer identity from sales and AI output',()=>{
 const data=base();data.deals=[record('secret-deal',{name:'PRIVATE CLIENT',nextTaskAt:'2026-10-10',createdAt:'2026-10-10'})];data.tasks=[record('secret-task',{name:'PRIVATE TASK',nextTaskAt:'2026-10-10'})];data.inventory.sales=[sale('receipt',{customerId:'secret-deal',customerName:'PRIVATE CLIENT'})];
 const limited={...scope,allowedPages:['calendar','pos']},result=selectCalendarDayContext('2026-10-10',data,limited);
 assert.deepEqual(result.clients,[]);assert.deepEqual(result.tasks,[]);assert.equal(result.access.analytics,false);assert.equal(result.access.sales,true);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(calendarDayInsights(result)).includes('PRIVATE'));
 const noSales=selectCalendarDayContext('2026-10-10',data,{...scope,allowedPages:['calendar','analytics']});assert.equal(noSales.metrics.gross,0);assert.deepEqual(noSales.sales,[]);
 assert.throws(()=>calendarDayInsights({...result,access:{...result.access,ai:false}}),/недоступен/);
});

test('own scope trusts explicit employeeId and rejects ambiguous or absent legacy names',()=>{
 const own={...scope,ownOnly:true};assert.equal(calendarRecordInScope({owner:'Айым Один',employeeId:'u2'},people,own),false);assert.equal(calendarRecordInScope({owner:'Старое имя',employeeId:'u1'},people,own),true);assert.equal(calendarRecordInScope({owner:'Айым'},people,own),false);assert.equal(calendarRecordInScope({owner:'Айым Один'},people,own),true);assert.equal(calendarRecordInScope({owner:'Айым Один'},people,{...own,actorId:''}),false);
 const data=base();data.tasks=[record('mine',{nextTaskAt:'2026-10-10',owner:'Старое имя'}),record('not-mine',{nextTaskAt:'2026-10-10',employeeId:'u2'}),record('ambiguous',{nextTaskAt:'2026-10-10',employeeId:undefined,owner:'Айым'})];data.business.calendar=[record('mine-event',{date:'2026-10-10'}),record('other-event',{employeeId:'u2',date:'2026-10-10'})];
 const result=selectCalendarDayContext('2026-10-10',data,own);assert.deepEqual(result.tasks.map(x=>x.id),['mine']);assert.deepEqual(result.events.map(x=>x.recordId).sort(),['mine','mine-event']);assert.equal(result.events.find(x=>x.recordId==='mine').ownerId,'u1');
});

test('own cashier sees their refunds on another cashier receipt, without counting that sale',()=>{
 const data=base();data.inventory.shifts=[shift('s1','Медина Три'),shift('s2','Айым Один')];data.inventory.sales=[sale('other-sale',{customerId:'private-client',customerName:'PRIVATE CLIENT',refundHistory:[{id:'own-refund',date:'2026-10-10',shiftId:'s2',cashier:'Айым Один',reason:'Возврат',amount:50,payments:{Наличные:50},quantities:{p1:1}},{id:'other-refund',date:'2026-10-10',shiftId:'s1',cashier:'Медина Три',reason:'Возврат',amount:30,payments:{Наличные:30},quantities:{p1:1}}]})];
 const result=selectCalendarDayContext('2026-10-10',data,{...scope,ownOnly:true});assert.equal(result.metrics.gross,0);assert.equal(result.metrics.refunds,50);assert.deepEqual(result.sales.map(x=>x.id),['refund:own-refund']);assert.ok(!JSON.stringify(result.sales).includes('PRIVATE CLIENT'));
});

test('importance and weekly labels are factual, closed tasks excluded and week-year correct',()=>{
 const data=base();data.tasks=[record('urgent',{urgent:true,nextTaskAt:'2026-10-10'}),record('closed',{channel:'Высокий',status:'Done',nextTaskAt:'2026-10-11'})];data.business.calendar=[record('meeting',{date:'2026-10-12',urgent:true,status:'Подтверждено'})];assert.deepEqual([...calendarImportantDates(data,scope)],['2026-10-10','2026-10-12']);assert.equal(selectCalendarDayContext('2026-10-10',data,scope).important,1);
 assert.equal(calendarWeekLabel('2021-01-01'),'Неделя 53 · 2020');assert.equal(calendarWeekLabel('2026-12-31'),'Неделя 53 · 2026');assert.equal(calendarWeekLabel('2027-01-04'),'Неделя 1 · 2027');assert.equal(calendarWeekLabel('invalid'),'');
 const insights=calendarDayInsights(selectCalendarDayContext('2026-10-10',data,scope),new Date('2026-10-12T00:00:00Z'));assert.ok(insights.some(row=>row.title==='Остались незавершённые задачи'));assert.deepEqual(calendarContextAccess({...scope,allowedPages:['calendar'],canAI:false}),{ai:false,analytics:false,clients:false,tasks:false,sales:false});
});

test('saved messages contribute clients by date and stable IDs, scoped to conversations and actor',()=>{
 const data=base();data.deals=[record('d1',{customerId:'c1',name:'Мой клиент',createdAt:'2020-01-01'}),record('d2',{customerId:'c2',name:'Чужой клиент',employeeId:'u3',owner:'Медина Три',createdAt:'2020-01-01'}),record('d3',{name:'Без связи',createdAt:'2020-01-01'})];
 data.messages={d1:[{id:'in',text:'Входящее',direction:'incoming',sentAt:'2026-10-09T21:00:00Z'},'Старая строка',{id:'undated',text:'Без даты',direction:'incoming'},{id:'other',text:'Ответ коллеги',employeeId:'u3',direction:'outgoing',sentAt:'2026-10-10T01:00:00Z'}],c1:[{id:'out',text:'Мой ответ',employeeId:'u1',direction:'outgoing',sentAt:'2026-10-10T01:00:00Z'}],d2:[{id:'private',text:'Недоступно',direction:'incoming',sentAt:'2026-10-10'}],'Без связи':[{id:'unlinked',text:'Нет ID',direction:'incoming',sentAt:'2026-10-10'}]};
 const own=selectCalendarDayContext('2026-10-10',data,{...scope,ownOnly:true,allowedPages:['calendar','conversations']});assert.deepEqual(own.clients.map(item=>item.id),['c1']);assert.deepEqual(own.clients[0].reasons,['Сообщение клиента','Ответ сотрудника']);assert.equal(own.newClients,0);
 assert.equal(selectCalendarDayContext('2026-10-09',data,{...scope,ownOnly:true}).clients.length,0);
 assert.equal(selectCalendarDayContext('2026-10-10',data,{...scope,allowedPages:['calendar','crm']}).clients.length,0);
 const denied=selectCalendarDayContext('2026-10-10',data,{...scope,allowedPages:['calendar']});assert.equal(denied.clients.length,0);assert.ok(!JSON.stringify(denied).includes('Входящее'));
 delete data.messages.d1;delete data.messages.c1;
 data.messages.d1=[{id:'otheronly',text:'Ответ коллеги',employeeId:'u3',direction:'outgoing',sentAt:'2026-10-10'}];assert.equal(selectCalendarDayContext('2026-10-10',data,{...scope,ownOnly:true}).clients.length,0);
});

test('calendar cashiers keep stable ownership after rename, including refund performer',()=>{
 const data=base();data.inventory.shifts=[{...shift('s1','Старое имя'),cashierId:'u1'},{...shift('s2','Айым Один'),cashierId:'u3'}];data.inventory.sales=[sale('mine',{refundHistory:[{id:'r',date:'2026-10-10',shiftId:'s1',cashier:'Старое имя',amount:20,reason:'Возврат',payments:{Наличные:20},quantities:{p1:1}}]}),sale('notmine',{shiftId:'s2'})];
 const day=selectCalendarDayContext('2026-10-10',data,{...scope,ownOnly:true});assert.deepEqual(day.sales.map(item=>item.id).sort(),['refund:r','sale:mine']);assert.equal(day.metrics.net,180);assert.ok(day.events.every(event=>event.ownerId==='u1'));
});
