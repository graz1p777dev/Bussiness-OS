import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalendarEvents,calendarMoment,calendarToday,calendarRange,shiftCalendar,validCalendarDate} from '../lib/os/calendar.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
import {initialEmployees} from '../lib/os/team.ts';
const row=(id,extra={})=>({id,name:id,value:100,status:'Активно',channel:'Встреча',owner:'Медина',note:'',...extra});

test('calendar validates actual dates, preserves local all-day dates and converts timestamp zones',()=>{
 assert.equal(validCalendarDate('2024-02-29'),true);
 assert.equal(validCalendarDate('2026-02-29'),false);
 assert.equal(validCalendarDate('2026-02-31'),false);
 assert.deepEqual(calendarMoment('2026-10-05'),{date:'2026-10-05',time:''});
 assert.deepEqual(calendarMoment('2026-10-05T21:30:00Z','','Asia/Bishkek'),{date:'2026-10-06',time:'03:30'});
 assert.deepEqual(calendarMoment('2026-10-05T21:30:00+06:00','','UTC'),{date:'2026-10-05',time:'15:30'});
 assert.deepEqual(calendarMoment('2026-10-05T23:30','','Asia/Bishkek'),{date:'2026-10-05',time:'23:30'});
 assert.equal(calendarMoment('2026-10-05T23:30broken'),null);
 assert.equal(calendarMoment('2026-02-31T09:30:00Z'),null);
 assert.equal(calendarMoment('До 8 октября'),null);
 assert.equal(calendarToday('Asia/Bishkek',new Date('2026-12-31T20:00:00Z')),'2027-01-01');
});

test('month navigation clamps end-of-month and week navigation crosses years without date rollover',()=>{
 assert.equal(shiftCalendar('2026-01-31','Месяц',1),'2026-02-28');
 assert.equal(shiftCalendar('2024-01-31','Месяц',1),'2024-02-29');
 assert.equal(shiftCalendar('2026-12-31','Месяц',1),'2027-01-31');
 assert.equal(shiftCalendar('2026-12-31','Неделя',1),'2027-01-07');
 const february=calendarRange('2026-02-15','Месяц');
 assert.equal(february.start,'2026-02-01');assert.equal(february.end,'2026-02-28');
 assert.equal(february.days[0],'2026-01-26');assert.equal(february.days.length,42);
 assert.equal(new Set(february.days).size,42);
 const week=calendarRange('2026-12-31','Неделя');
 assert.equal(week.start,'2026-12-28');assert.equal(week.end,'2027-01-03');assert.equal(week.days.length,7);
});

test('calendar joins dated records, not invented deadlines, while preserving source data',()=>{
 const inventory=structuredClone(initialInventory);
 inventory.shifts=[{id:'shift',cashier:'Айым',register:'Касса',warehouse:'main',opening:0,opened:'2026-10-05T09:00:00Z',closed:'',actual:null}];
 inventory.sales=[{id:'sale',shiftId:'shift',warehouse:'main',date:'2026-10-05T21:30:00Z',items:[{productId:'p',name:'SPF',quantity:1,price:100,cost:50,returned:1}],total:100,discount:0,payments:{Наличные:100},refunds:100,status:'Возврат',refundHistory:[{id:'refund',date:'2026-10-06T04:00:00Z',cashier:'Медина',shiftId:'shift',reason:'Не подошёл',amount:100,payments:{Наличные:100},quantities:{p:1}}]}];
 const input={business:{calendar:[row('own',{date:'2026-10-06',time:'11:00'}),row('bad',{date:'2026-02-31'})],finance:[row('rent',{date:'2026-10-01',status:'Оплачен'})],marketing:[row('campaign',{date:'2026-10-08'}),row('undated-campaign')]},consultations:[{id:'consult',client:'Айжан',employee:'Медина',date:'2026-10-06',time:'14:00',status:'Подтверждена',note:'Подбор'}],deals:[row('follow-up',{nextTaskAt:'2026-10-07',hasOpenTasks:true}),row('no-open-task',{nextTaskAt:'2026-10-07',hasOpenTasks:false})],tasks:[row('deadline',{nextTaskAt:'2026-10-06T17:30',status:'Done'}),row('undated-task',{note:'До 8 октября',createdAt:'2026-10-01'})],inventory,employees:initialEmployees,timeZone:'Asia/Bishkek'};
 const before=structuredClone(input),events=buildCalendarEvents(input);
 assert.deepEqual(input,before);
 assert.equal(events.length,8);
 assert.equal(events.find(event=>event.id==='task:deadline').time,'17:30');
 assert.equal(events.find(event=>event.id==='task:deadline').completed,true);
 assert.equal(events.find(event=>event.id==='calendar:own').ownerId,'medina');
 assert.equal(events.find(event=>event.id==='calendar:own').owner,'Медина Осмонова');
 assert.equal(events.find(event=>event.id==='sale:sale').date,'2026-10-06');
 assert.equal(events.find(event=>event.id==='sale:sale').time,'03:30');
 assert.equal(events.find(event=>event.id==='sale:sale').ownerId,'aiym');
 assert.equal(events.find(event=>event.id==='refund:refund').amount,100);
 const restricted=buildCalendarEvents({...input,allowedPages:['calendar','tasks']});
 assert.deepEqual(restricted.map(event=>event.source),['calendar','task']);
});
