import type {Entity} from './data.ts';
import type {ChatMessage} from './conversations.ts';
import type {Sale,Shift} from './inventory-model.ts';
import {canManageEmployees,type Employee,type EmployeeActor} from './team.ts';

export type ReportPeriod={kind:'day'|'shift';date:string;shiftId?:string};
export type EmployeeMetrics={replies:number;sales:number;assignedTasks:number;completedTasks:number;openTasks:number};
export type EmployeeReport=ReportPeriod&{id:string;employeeId:string;results:string;comment:string;metrics:EmployeeMetrics;submittedAt:string;updatedAt:string;revisions:{at:string;results:string;comment:string;metrics:EmployeeMetrics}[]};
export type EmployeeReportContext={messages:Record<string,ChatMessage[]>;sales:Sale[];shifts:Shift[];tasks:Entity[]};
export function employeeReportDate(value:string|Date){
 const date=typeof value==='string'?new Date(value):value;
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'';
}
function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date}
export function employeeOwnsRecord(employee:Employee,employees:Employee[],owner:string,employeeId?:string){
 if(employeeId)return employeeId===employee.id;
 const name=owner.trim().toLocaleLowerCase();if(!name)return false;
 const matches=employees.filter(person=>person.name.trim().toLocaleLowerCase()===name||person.name.trim().split(/\s+/)[0].toLocaleLowerCase()===name);
 return matches.length===1&&matches[0].id===employee.id;
}
export function employeeShifts(employee:Employee,employees:Employee[],shifts:Shift[]){return shifts.filter(shift=>employeeOwnsRecord(employee,employees,shift.cashier,(shift as Shift&{cashierId?:string}).cashierId))}
export function employeeTasks(employee:Employee,employees:Employee[],tasks:Entity[]){return tasks.filter(task=>employeeOwnsRecord(employee,employees,task.owner,task.employeeId))}
export function employeeReportMetrics(employee:Employee,employees:Employee[],context:EmployeeReportContext,period:ReportPeriod,now:string):EmployeeMetrics{
 const ownShifts=employeeShifts(employee,employees,context.shifts);
 const selectedShift=period.kind==='shift'?ownShifts.find(shift=>shift.id===period.shiftId):undefined;
 if(period.kind==='shift'&&!selectedShift)throw new Error('Выберите свою кассовую смену.');
 if(period.kind==='day'&&!validDate(period.date))throw new Error('Выберите корректную дату.');
 const inside=(date:string|undefined)=>Boolean(date&&(selectedShift?Date.parse(date)>=Date.parse(selectedShift.opened)&&Date.parse(date)<=Date.parse(selectedShift.closed||now):employeeReportDate(date)===period.date));
 const replyIds=new Set<string>();
 for(const history of Object.values(context.messages))for(const message of history){if(typeof message!=='string'&&message.direction==='outgoing'&&message.employeeId===employee.id&&inside(message.sentAt))replyIds.add(message.id)}
 const shiftIds=new Set(ownShifts.map(shift=>shift.id));
 const sales=new Set(context.sales.filter(sale=>shiftIds.has(sale.shiftId)&&(!selectedShift||sale.shiftId===selectedShift.id)&&inside(sale.date)).map(sale=>sale.id));
 const tasks=employeeTasks(employee,employees,context.tasks),completed=tasks.filter(task=>['Done','Готово','Завершено'].includes(task.status));
 return {replies:replyIds.size,sales:sales.size,assignedTasks:tasks.length,completedTasks:completed.length,openTasks:tasks.length-completed.length};
}
export function canReviewEmployeeReports(actor:EmployeeActor,employees:Employee[]){return canManageEmployees(actor,employees)}
export function visibleEmployeeReports(reports:EmployeeReport[],actor:EmployeeActor,employees:Employee[],targetId=actor.employeeId){
 if(!employees.some(employee=>employee.id===actor.employeeId&&employee.status==='Активен'))return [];
 if(targetId!==actor.employeeId&&!canReviewEmployeeReports(actor,employees))return [];
 return reports.filter(report=>report.employeeId===targetId);
}
export function saveEmployeeReport(reports:EmployeeReport[],input:ReportPeriod&{id:string;employeeId:string;results:string;comment:string},actor:EmployeeActor,employees:Employee[],context:EmployeeReportContext,now:string):EmployeeReport[]{
 const employee=employees.find(person=>person.id===actor.employeeId&&person.status==='Активен'),previous=reports.find(report=>report.id===input.id);
 if(!employee||input.employeeId!==actor.employeeId||(previous&&previous.employeeId!==actor.employeeId))throw new Error('Можно отправлять и исправлять только собственные отчёты.');
 if(!(actor.permissions?.[previous?'edit':'create']??actor.employeeId==='owner-user'))throw new Error('Сохранение отчёта запрещено вашей ролью.');
 if(!['day','shift'].includes(input.kind))throw new Error('Выберите отчёт за день или смену.');
 const shift=input.kind==='shift'?employeeShifts(employee,employees,context.shifts).find(item=>item.id===input.shiftId):undefined;
 const date=shift?employeeReportDate(shift.opened):input.date;
 if(!validDate(date)||date>employeeReportDate(now))throw new Error('Отчёт доступен за текущий или прошедший день.');
 if(previous&&(previous.kind!==input.kind||previous.date!==date||previous.shiftId!==(input.kind==='shift'?input.shiftId:undefined)))throw new Error('Период отправленного отчёта не меняется.');
 if(reports.some(report=>report.id!==input.id&&report.employeeId===actor.employeeId&&report.kind===input.kind&&(input.kind==='day'?report.date===date:report.shiftId===input.shiftId)))throw new Error('Отчёт за этот период уже отправлен. Откройте его для исправления.');
 const results=input.results.trim(),comment=input.comment.trim();if(!results)throw new Error('Опишите результат своей работы.');
 const metrics=employeeReportMetrics(employee,employees,context,{...input,date},now);
 const report:EmployeeReport={id:input.id,employeeId:actor.employeeId,kind:input.kind,date,...(input.kind==='shift'?{shiftId:input.shiftId}:{}),results,comment,metrics,submittedAt:previous?.submittedAt||now,updatedAt:now,revisions:previous?[{at:previous.updatedAt,results:previous.results,comment:previous.comment,metrics:previous.metrics},...previous.revisions]:[]};
 return previous?reports.map(item=>item.id===report.id?report:item):[report,...reports];
}
