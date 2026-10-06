import test from 'node:test';
import assert from 'node:assert/strict';
import {filterDeals,initialDealFilters,activeDealFilters} from '../lib/os/deal-filters.ts';
const now=Date.parse('2026-10-06T12:00:00+06:00');
const rows=[
 {id:'A',name:'Алина',owner:'Медина',value:100,status:'Контакт',channel:'WhatsApp',note:'',phone:'+996 555 123 456',city:'Бишкек',tags:['SPF'],createdAt:'2026-10-01',updatedAt:'2026-10-05',nextTaskAt:'2026-10-04',hasOpenTasks:true,urgent:true,slaDueAt:'2026-10-05T10:00:00+06:00'},
 {id:'B',name:'Нурлан',owner:'',value:50,status:'Оплата',channel:'Telegram',note:'Повторная покупка',city:'Ош',createdAt:'2026-09-01',updatedAt:'2026-10-06',hasOpenTasks:false},
 {id:'C',name:'Айжан',owner:'Медина',value:200,status:'Оплата',channel:'WhatsApp',note:'',city:'Бишкек',createdAt:'2026-10-02',updatedAt:'2026-10-04',nextTaskAt:'2026-10-06',hasOpenTasks:true},
];
const run=conditions=>filterDeals(rows,{...initialDealFilters,...conditions},'', ['A'],'Медина',now).map(d=>d.id);
test('server filter combination intersects assignment, employee, stage, source, tag, city and amount',()=>{
 assert.deepEqual(run({assignment:'Мои',employee:'Медина',stage:'Контакт',source:'WhatsApp',tag:'SPF',city:'Бишкек',min:'90',max:'110'}),['A']);
 assert.deepEqual(run({assignment:'Без ответственного'}),['B']);assert.deepEqual(run({employee:'Медина',source:'Telegram'}),[]);
});
test('task deadlines, urgency and SLA attention match server semantics including end of due day',()=>{
 assert.deepEqual(run({deadline:'Просроченные',taskMode:'С задачами',attention:'Срочные'}),['A']);
 assert.deepEqual(run({attention:'Требуют внимания'}),['A']);assert.deepEqual(run({deadline:'Непросроченные'}),['B','C']);
 assert.deepEqual(run({taskMode:'Без следующей задачи'}),['B']);assert.deepEqual(run({taskMode:'Без задач'}),['B']);
});
test('created dates, unanswered, invalid ranges, search and sorting operate on actual fields',()=>{
 assert.deepEqual(run({createdFrom:'2026-10-01',createdTo:'2026-10-02',reply:'Без ответа'}),['A']);
 assert.deepEqual(run({reply:'Ответ отправлен',sort:'amount-desc'}),['C','B']);assert.deepEqual(run({min:'200',max:'10'}),[]);
 assert.deepEqual(run({createdFrom:'2026-10-02',createdTo:'2026-10-01'}),[]);
 assert.deepEqual(filterDeals(rows,initialDealFilters,'555123456',[],'',now).map(d=>d.id),['A']);
 assert.deepEqual(run({sort:'task-asc'}),['A','C','B']);assert.deepEqual(run({sort:'created-desc'}),['C','A','B']);
 assert.equal(activeDealFilters(initialDealFilters).length,0);assert.equal(activeDealFilters({...initialDealFilters,city:'Ош',sort:'amount-asc'}).length,1);
});
