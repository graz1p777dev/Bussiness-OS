import type {Entity} from './data.ts';
import type {Employee} from './team.ts';
import type {InventoryState} from './inventory-model.ts';
import {planningPersonKey} from './planning-people.ts';
export type CalendarRecord=Entity&{date?:string;time?:string;endTime?:string;employeeId?:string;location?:string};
export type CalendarConsultation={id:string;client:string;clientId?:string;employee:string;employeeId?:string;date:string;time:string;status:string;note:string};
export const initialCalendarConsultations:CalendarConsultation[]=[{id:'consult1',client:'Айжан',employee:'Медина',date:'2026-10-06',time:'14:00',status:'Подтверждена',note:'Подбор ухода'}];
export const calendarSources={calendar:{label:'События',color:'#8b7fe0',route:'calendar'},consultation:{label:'Консультации',color:'#55af9e',route:'planning'},task:{label:'Задачи',color:'#dcaa55',route:'tasks'},crm:{label:'Контакты CRM',color:'#648fde',route:'crm'},sale:{label:'Продажи',color:'#5fba88',route:'pos'},refund:{label:'Возвраты',color:'#cb819b',route:'pos'},finance:{label:'Финансы',color:'#be9361',route:'finance'},marketing:{label:'Маркетинг',color:'#a479c9',route:'marketing'}};
export type CalendarSource=keyof typeof calendarSources;
export type CalendarEvent={id:string;recordId:string;source:CalendarSource;title:string;date:string;time:string;endTime?:string;owner:string;ownerId:string;status:string;note:string;location?:string;amount?:number;completed:boolean};
export type CalendarView='Месяц'|'Неделя'|'Список';
const pad=(value:number)=>String(value).padStart(2,'0');
const iso=(date:Date)=>String(date.getUTCFullYear()).padStart(4,'0')+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate());
export function validCalendarDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
export function validCalendarTime(value:string){return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)}
export function calendarTimezone(value:string){try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value}catch{return 'Asia/Bishkek'}}
export function calendarToday(timeZone:string,now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:calendarTimezone(timeZone),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-')}
export function calendarMoment(value:string,time='',timeZone='Asia/Bishkek'):{date:string;time:string}|null{
 if(validCalendarDate(value))return {date:value,time:validCalendarTime(time)?time:''};
 if(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?$/.test(value)||!validCalendarDate(value.slice(0,10))||!validCalendarTime(value.slice(11,16)))return null;
 if(!/(Z|[+-]\d{2}:?\d{2})$/.test(value))return {date:value.slice(0,10),time:value.slice(11,16)};
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:calendarTimezone(timeZone),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 return {date:calendarToday(timeZone,date),time:parts.find(part=>part.type==='hour')!.value+':'+parts.find(part=>part.type==='minute')!.value};
}
export function calendarDays(start:string,count:number){const date=new Date(start+'T12:00:00Z');return Array.from({length:count},(_,index)=>{const day=new Date(date);day.setUTCDate(day.getUTCDate()+index);return iso(day)})}
export function calendarRange(anchor:string,view:CalendarView){
 const date=new Date(anchor+'T12:00:00Z');
 if(view==='Неделя'){date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const days=calendarDays(iso(date),7);return {start:days[0],end:days[6],days}}
 const start=new Date(date);start.setUTCDate(1);const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 const grid=new Date(start);grid.setUTCDate(grid.getUTCDate()-(grid.getUTCDay()+6)%7);
 return {start:iso(start),end:iso(end),days:calendarDays(iso(grid),42)};
}
export function shiftCalendar(anchor:string,view:CalendarView,direction:number){
 const date=new Date(anchor+'T12:00:00Z');
 if(view==='Неделя')date.setUTCDate(date.getUTCDate()+direction*7);
 else{const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+direction);const last=new Date(date);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);date.setUTCDate(Math.min(day,last.getUTCDate()))}
 return iso(date);
}
export function buildCalendarEvents({business,consultations,deals,tasks,inventory,employees,timeZone='Asia/Bishkek',allowedPages}:{business:Record<string,CalendarRecord[]>;consultations:CalendarConsultation[];deals:Entity[];tasks:Entity[];inventory:InventoryState;employees:Employee[];timeZone?:string;allowedPages?:string[]}):CalendarEvent[]{
 const events:CalendarEvent[]=[];
 const canRead=(source:CalendarSource)=>source==='calendar'||!allowedPages||allowedPages.includes(calendarSources[source].route);
 const owner=(name:string,id?:string)=>{const key=planningPersonKey(employees,name,id);return {owner:employees.find(employee=>employee.id===key)?.name||name||'Не назначен',ownerId:name||id?key:'__none'}};
 const add=(source:CalendarSource,recordId:string,value:string,time:string,details:Omit<CalendarEvent,'source'|'recordId'|'id'|'date'|'time'>)=>{if(!canRead(source))return;const when=calendarMoment(value,time,timeZone);if(when)events.push({source,recordId,id:source+':'+recordId,...when,...details})};
 const done=(status:string)=>['Done','Завершена','Завершено','Завершён','Отменена','Отменено','Неявка','Оплачен'].includes(status);
 for(const record of business.calendar||[])add('calendar',record.id,record.date||'',record.time||'',{title:record.name,...owner(record.owner,record.employeeId),status:record.status,note:record.note,location:record.location,endTime:record.endTime,completed:done(record.status)});
 for(const record of consultations)add('consultation',record.id,record.date,record.time,{title:'Консультация: '+(deals.find(deal=>deal.id===record.clientId)?.name||record.client),...owner(record.employee,record.employeeId),status:record.status,note:record.note,completed:done(record.status)});
 for(const record of tasks)add('task',record.id,record.nextTaskAt||'', '',{title:record.name,...owner(record.owner),status:record.status,note:record.note,completed:done(record.status)});
 for(const record of deals)if(record.hasOpenTasks!==false)add('crm',record.id,record.nextTaskAt||'','',{title:'Связаться: '+record.name,...owner(record.owner),status:record.status,note:record.note,completed:false});
 for(const record of business.finance||[])add('finance',record.id,record.date||'',record.time||'',{title:record.name,...owner(record.owner),status:record.status,note:record.note,amount:record.value,completed:done(record.status)});
 for(const record of business.marketing||[])add('marketing',record.id,record.date||'',record.time||'',{title:record.name,...owner(record.owner),status:record.status,note:record.note,completed:done(record.status)});
 for(const sale of inventory.sales){const cashier=inventory.shifts.find(shift=>shift.id===sale.shiftId)?.cashier||'';add('sale',sale.id,sale.date,'',{title:'Продажа '+sale.id,...owner(cashier),status:sale.status,note:sale.items.map(item=>item.name+' × '+item.quantity).join(', '),amount:sale.total,completed:true});for(const refund of sale.refundHistory||[])add('refund',refund.id,refund.date,'',{title:'Возврат по '+sale.id,...owner(refund.cashier),status:'Возвращено',note:refund.reason,amount:refund.amount,completed:true})}
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title));
}
