import test from 'node:test';
import assert from 'node:assert/strict';
import {initialEmployees,teamActions} from '../lib/os/team.ts';
import {employeeOwnsRecord,employeeShifts,employeeReportMetrics,saveEmployeeReport,visibleEmployeeReports} from '../lib/os/employee-reports.ts';
const employees=structuredClone(initialEmployees),me=employees.find(employee=>employee.id==='aiym');
const permissions=Object.fromEntries(Object.keys(teamActions).map(action=>[action,['create','edit'].includes(action)]));
const actor={employeeId:me.id,permissions},now='2026-10-07T12:00:00Z';
const shift={id:'mine',cashier:me.name,opened:'2026-10-07T06:00:00Z',closed:'2026-10-07T11:00:00Z'};
const message=(id,at,extra={})=>({id,text:'Сохранённый ответ',direction:'outgoing',employeeId:me.id,sentAt:at,...extra});
const context={messages:{a:[message('m1','2026-10-07T05:00:00Z'),message('m2','2026-10-07T08:00:00Z'),message('next-day','2026-10-07T18:30:00Z'),message('other','2026-10-07T08:00:00Z',{employeeId:'medina'}),message('incoming','2026-10-07T08:00:00Z',{direction:'incoming'}),'legacy',message('no-author','2026-10-07T08:00:00Z',{employeeId:undefined})]},sales:[{id:'s1',shiftId:'mine',date:'2026-10-07T09:00:00Z',total:999999},{id:'s2',shiftId:'other',date:'2026-10-07T09:00:00Z',total:888888}],shifts:[shift,{id:'other',cashier:'Медина Осмонова',opened:shift.opened,closed:shift.closed}],tasks:[{id:'own',employeeId:me.id,owner:'Old name',status:'Done'},{id:'legacy-own',owner:'Айым',status:'To Do'},{id:'wrong-id',employeeId:'medina',owner:'Айым',status:'Done'}]};
const input={id:'r1',employeeId:me.id,kind:'day',date:'2026-10-07',results:'Отвечено клиентам',comment:'Нужен новый каталог'};

test('reports count real author-tagged replies, owned receipts and assigned tasks without company money',()=>{
 const metrics=employeeReportMetrics(me,employees,context,{kind:'day',date:'2026-10-07'},now);
 assert.deepEqual(metrics,{replies:2,sales:1,assignedTasks:2,completedTasks:1,openTasks:1});
 assert.equal(Object.hasOwn(metrics,'revenue'),false);
 const shiftMetrics=employeeReportMetrics(me,employees,context,{kind:'shift',date:'2026-10-07',shiftId:'mine'},now);
 assert.equal(shiftMetrics.replies,1);
 assert.equal(shiftMetrics.sales,1);
 assert.throws(()=>employeeReportMetrics(me,employees,context,{kind:'shift',date:'2026-10-07',shiftId:'other'},now),/свою кассовую смену/);
});
test('legacy names are attributed only when unambiguous; explicit employee ID survives rename',()=>{
 assert.equal(employeeOwnsRecord(me,employees,'Айым'),true);
 const ambiguous=[...employees,{...me,id:'second',name:'Айым Другой'}];
 assert.equal(employeeOwnsRecord(me,ambiguous,'Айым'),false);
 assert.equal(employeeOwnsRecord(me,ambiguous,'Айым',me.id),true);
 assert.equal(employeeOwnsRecord(me,employees,me.name,'medina'),false);
 assert.equal(employeeShifts({...me,name:'Новое имя'},employees,[{...shift,cashierId:me.id}]).length,1);
});
test('submitted report snapshots remain stable; own correction preserves the previous text and metrics',()=>{
 const saved=saveEmployeeReport([],input,actor,employees,context,now);
 assert.equal(saved[0].metrics.replies,2);
 const changedContext={...context,messages:{...context.messages,b:[message('m3','2026-10-07T10:00:00Z')]}};
 assert.equal(saved[0].metrics.replies,2);
 const edited=saveEmployeeReport(saved,{...input,results:'Итог исправлен'},actor,employees,changedContext,'2026-10-07T13:00:00Z');
 assert.equal(edited[0].metrics.replies,3);
 assert.equal(edited[0].submittedAt,now);
 assert.equal(edited[0].revisions.length,1);
 assert.equal(edited[0].revisions[0].results,input.results);
 assert.equal(edited[0].revisions[0].metrics.replies,2);
 assert.equal(saved[0].revisions.length,0);
 assert.throws(()=>saveEmployeeReport(saved,{...input,id:'duplicate'},actor,employees,context,now),/уже отправлен/);
 assert.throws(()=>saveEmployeeReport(saved,{...input,date:'2026-10-06'},actor,employees,context,now),/Период отправленного/);
});
test('readonly, blocked staff and even managers cannot submit or correct another person report',()=>{
 const saved=saveEmployeeReport([],input,actor,employees,context,now);
 const owner={employeeId:'owner-user'};
 assert.equal(visibleEmployeeReports(saved,actor,employees,'medina').length,0);
 assert.equal(visibleEmployeeReports(saved,owner,employees,me.id).length,1);
 assert.throws(()=>saveEmployeeReport(saved,input,owner,employees,context,now),/собственные отчёты/);
 assert.throws(()=>saveEmployeeReport([],input,{...actor,permissions:{...permissions,create:false}},employees,context,now),/запрещено/);
 assert.throws(()=>saveEmployeeReport(saved,input,{...actor,permissions:{...permissions,edit:false}},employees,context,now),/запрещено/);
 const blocked=employees.map(employee=>employee.id===me.id?{...employee,status:'Заблокирован'}:employee);
 assert.equal(visibleEmployeeReports(saved,actor,blocked).length,0);
 assert.throws(()=>saveEmployeeReport(saved,input,actor,blocked,context,now),/собственные/);
 assert.throws(()=>saveEmployeeReport([],{...input,date:'2026-10-08'},actor,employees,context,now),/текущий или прошедший/);
});
