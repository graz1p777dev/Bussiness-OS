import test from 'node:test';
import assert from 'node:assert/strict';
import {chartRows,reorderWidget} from '../lib/os/analytics-interaction.ts';
const rows=[
 {id:'a',date:'2026-10-05',client:'A',channel:'WhatsApp',employee:'Лена',status:'Успешно',rating:4.7,cost:10,spend:0,aiCost:2},
 {id:'b',date:'2026-10-04',client:'A',channel:'Telegram',employee:'Лена',status:'Успешно',rating:3.8,cost:10,spend:5,aiCost:0},
 {id:'c',date:'2026-10-05',client:'B',channel:'Telegram',employee:'Игорь',status:'В работе',rating:4.6,cost:0,spend:3,aiCost:0},
 {id:'d',date:'2026-10-05',client:'C',channel:'WhatsApp',employee:'Игорь',status:'Успешно',rating:3,cost:10,spend:0,aiCost:0},
];
const ids=values=>values.map(r=>r.id);
test('chart details match full date, source, team and exact scatter record',()=>{
 assert.deepEqual(ids(chartRows('revenueTrend',undefined,{fullDate:'2026-10-04'},rows)),['b']);
 assert.deepEqual(ids(chartRows('channelMix',undefined,{name:'WhatsApp'},rows)),['a','d']);
 assert.deepEqual(ids(chartRows('teamOutcomes',undefined,{name:'Лена'},rows)),['a','b']);
 assert.deepEqual(ids(chartRows('responseScatter',undefined,{id:'c'},rows)),['c']);
});
test('weekday, rounded rating and outcome details match displayed aggregates',()=>{
 assert.deepEqual(ids(chartRows('weekdaySales',undefined,{weekday:1},rows)),['a','c','d']);
 assert.deepEqual(ids(chartRows('ratingMix',undefined,{rating:5},rows)),['a','c']);
 assert.deepEqual(ids(chartRows('outcomes',undefined,{name:'Успешно'},rows)),['a','b','d']);
});
test('repeat and cost groups use purchase history and actual contributing records',()=>{
 assert.deepEqual(ids(chartRows('repeatMix',undefined,{name:'Повторные покупки'},rows)),['a','b']);
 assert.deepEqual(ids(chartRows('repeatMix',undefined,{name:'Одна покупка в периоде'},rows)),['d']);
 assert.deepEqual(ids(chartRows('costMix',undefined,{name:'Реклама'},rows)),['b','c']);
});
test('widget reorder preserves members, input and handles missing targets',()=>{
 const source=['a','b','c'];assert.deepEqual(reorderWidget(source,'a','c'),['b','c','a']);
 assert.deepEqual(source,['a','b','c']);assert.deepEqual(reorderWidget(source,'c','a'),['c','a','b']);
 assert.equal(reorderWidget(source,'missing','c'),source);
});
