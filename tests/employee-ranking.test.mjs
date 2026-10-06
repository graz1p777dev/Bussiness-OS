import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeRanking} from '../lib/os/employee-ranking.ts';
const employees=[{id:'a',name:'Айым',role:'manager',status:'Активен'},{id:'b',name:'Медина',role:'manager',status:'Активен'},{id:'c',name:'Нуриза',role:'manager',status:'Заблокирован'},{id:'owner',name:'Owner',role:'owner',status:'Активен'}];
test('reply ranking counts only staff outgoing messages within the selected period',()=>{
 const activity=[{employeeId:'a',date:'2026-10-06',replies:2},{employeeId:'b',date:'2026-10-05',replies:20}];
 const messages={chat:[{id:'1',text:'Вопрос',direction:'incoming',employeeId:'a',sentAt:'2026-10-06T10:00:00Z'},{id:'2',text:'Ответ',direction:'outgoing',employeeId:'a',sentAt:'2026-10-06T10:05:00Z'},{id:'3',text:'Ранее',direction:'outgoing',employeeId:'a',sentAt:'2026-10-05T10:05:00Z'},'Старый ответ без автора']};
 assert.deepEqual(employeeRanking(employees,activity,messages,'2026-10-06','2026-10-06').map(e=>[e.id,e.replies,e.rank]),[['a',3,1],['b',0,2]]);
});
test('equal reply counts share a rank and do not change source records',()=>{
 const activity=[{employeeId:'a',date:'2026-10-06',replies:5},{employeeId:'b',date:'2026-10-06',replies:5}];
 assert.deepEqual(employeeRanking(employees,activity,{},'2026-10-01','2026-10-06').map(e=>e.rank),[1,1]);assert.equal(activity[0].replies,5);
});
