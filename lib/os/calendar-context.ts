import type {Entity} from './data.ts';
import type {ChatMessage} from './conversations.ts';
import type {Employee} from './team.ts';
import type {InventoryState} from './inventory-model.ts';
import {calendarCashier,buildCalendarEvents,calendarMoment,calendarToday,validCalendarDate,type CalendarConsultation,type CalendarEvent,type CalendarRecord} from './calendar.ts';
import {planningPersonKey} from './planning-people.ts';

export type CalendarDayTab='ai'|'analytics'|'clients'|'tasks'|'sales';
export type CalendarDayScope={actorId:string;ownOnly:boolean;allowedPages?:string[];canAI:boolean;timeZone:string};
export type CalendarContextData={messages?:Record<string,ChatMessage[]>;business:Record<string,CalendarRecord[]>;consultations:CalendarConsultation[];deals:Entity[];tasks:Entity[];inventory:InventoryState;employees:Employee[]};
export type DayClient={id:string;name:string;phone:string;channel:string;stages:string[];reasons:string[];dealIds:string[];urgent:boolean};
export type DaySale={id:string;date:string;time:string;cashier:string;customer:string;amount:number;kind:'sale'|'refund';saleId:string;status:string;lines:{name:string;quantity:number;price:number}[];note:string};
export type CalendarDayContext={date:string;timeZone:string;ownOnly:boolean;access:Record<CalendarDayTab,boolean>;events:CalendarEvent[];tasks:Entity[];clients:DayClient[];sales:DaySale[];newClients:number;important:number;metrics:{gross:number;refunds:number;net:number;receipts:number;averageCheck:number;tasks:number;completedTasks:number;appointments:number}};
const done=(status:string)=>['Done','Завершена','Завершено','Отменено','Отменена'].includes(status);
export function calendarContextAccess(scope:CalendarDayScope){const can=(page:string)=>!scope.allowedPages||scope.allowedPages.includes(page);return {ai:scope.canAI,analytics:can('analytics'),clients:can('crm')||can('customers')||can('conversations'),tasks:can('tasks'),sales:can('pos')};}
export function calendarRecordInScope(record:{owner?:string;employeeId?:string},employees:Employee[],scope:CalendarDayScope){return !scope.ownOnly||Boolean(scope.actorId)&&planningPersonKey(employees,record.owner||'',record.employeeId)===scope.actorId;}
export function calendarScopedData(data:CalendarContextData,scope:CalendarDayScope):CalendarContextData{
 const access=calendarContextAccess(scope),can=(page:string)=>!scope.allowedPages||scope.allowedPages.includes(page),mine=(record:{owner?:string;employeeId?:string})=>calendarRecordInScope(record,data.employees,scope);
 const shifts=data.inventory.shifts.filter(shift=>mine(calendarCashier(data.inventory,shift.id)));
 const sales=access.sales?data.inventory.sales.filter(sale=>shifts.some(shift=>shift.id===sale.shiftId)).map(sale=>({...sale,refundHistory:(sale.refundHistory||[]).filter(refund=>mine(calendarCashier(data.inventory,refund.shiftId,refund.cashier)))})):[];
 // Refunds belong to the cashier performing the refund even when another cashier sold the item.
 const refundOnly=scope.ownOnly&&access.sales?data.inventory.sales.filter(sale=>!sales.some(row=>row.id===sale.id)).flatMap(sale=>{const refunds=(sale.refundHistory||[]).filter(refund=>mine(calendarCashier(data.inventory,refund.shiftId,refund.cashier)));return refunds.length?[{...sale,date:'',refundHistory:refunds}]:[]}):[];
 const deals=access.clients?data.deals.filter(mine):[];
 const messages=can('conversations')&&access.clients?Object.fromEntries(Object.entries(data.messages||{}).filter(([id])=>deals.some(deal=>deal.id===id||deal.customerId===id)).map(([id,history])=>[id,history.filter(message=>!scope.ownOnly||typeof message!=='string'&&(message.direction==='incoming'||message.employeeId===scope.actorId))])):{};
 return {messages,employees:data.employees,business:Object.fromEntries(Object.entries(data.business).map(([page,records])=>[page,can(page)?records.filter(mine):[]])),consultations:can('appointments')?data.consultations.filter(record=>mine({owner:record.employee,employeeId:record.employeeId})):[],deals,tasks:access.tasks?data.tasks.filter(mine):[],inventory:{products:[],warehouses:[],documents:[],shifts:data.inventory.shifts,sales:scope.ownOnly?[...sales,...refundOnly]:access.sales?data.inventory.sales:[]}};
}
export function selectCalendarDayContext(date:string,data:CalendarContextData,scope:CalendarDayScope):CalendarDayContext{
 if(!validCalendarDate(date))throw new Error('Выберите корректную дату.');
 const access=calendarContextAccess(scope),scoped=calendarScopedData(data,scope),onDay=(value:string|undefined)=>Boolean(value&&calendarMoment(value,'',scope.timeZone)?.date===date);
 const events=buildCalendarEvents({...scoped,timeZone:scope.timeZone,allowedPages:scope.allowedPages}).filter(event=>event.date===date);
 const tasks=scoped.tasks.filter(task=>onDay(task.nextTaskAt));
 const sales:DaySale[]=[];
 const customerLabel=(sale:InventoryState['sales'][number])=>!access.clients||scope.ownOnly&&Boolean(sale.customerId)&&!scoped.deals.some(deal=>deal.id===sale.customerId||deal.customerId===sale.customerId)?'Данные клиента скрыты':sale.customerName||'Без клиента';
 for(const sale of scoped.inventory.sales){
  const cashier=data.inventory.shifts.find(shift=>shift.id===sale.shiftId)?.cashier||'Не указан';
  if(onDay(sale.date))sales.push({id:'sale:'+sale.id,saleId:sale.id,date,time:calendarMoment(sale.date,'',scope.timeZone)?.time||'',kind:'sale',amount:sale.total,cashier,customer:customerLabel(sale),status:sale.status,lines:sale.items.map(item=>({name:item.name,quantity:item.quantity,price:item.price})),note:'Сумма чека на дату продажи. Возвраты учитываются в день возврата.'});
  for(const refund of sale.refundHistory||[])if(onDay(refund.date))sales.push({id:'refund:'+refund.id,saleId:sale.id,date,time:calendarMoment(refund.date,'',scope.timeZone)?.time||'',kind:'refund',amount:refund.amount,cashier:refund.cashier,customer:customerLabel(sale),status:'Возврат',lines:Object.entries(refund.quantities).map(([id,quantity])=>{const item=sale.items.find(item=>item.productId===id);return {name:item?.name||'Удалённый товар',quantity,price:item?.price||0}}),note:refund.reason});
 }
 const clients=new Map<string,DayClient>(),newClients=new Set<string>();
 const addClient=(deal:Entity,reason:string)=>{const id=deal.customerId||deal.id;const current=clients.get(id)||{id,name:deal.name,phone:deal.phone||'',channel:deal.channel,stages:[],reasons:[],dealIds:[],urgent:false};if(!current.reasons.includes(reason))current.reasons.push(reason);if(!current.dealIds.includes(deal.id))current.dealIds.push(deal.id);if(!current.stages.includes(deal.status))current.stages.push(deal.status);current.urgent||=deal.urgent===true;clients.set(id,current)};
 for(const deal of scoped.deals){if(onDay(deal.createdAt)){addClient(deal,'Новая карточка');if(!scoped.deals.some(other=>(other.customerId||other.id)===(deal.customerId||deal.id)&&other.createdAt&&calendarMoment(other.createdAt,'',scope.timeZone)?.date&&calendarMoment(other.createdAt,'',scope.timeZone)!.date<date))newClients.add(deal.customerId||deal.id)}if(deal.hasOpenTasks!==false&&onDay(deal.nextTaskAt))addClient(deal,'Запланирован контакт');if(onDay(deal.closedAt))addClient(deal,'Закрытие сделки')}
 const resolve=(id?:string)=>id?scoped.deals.find(deal=>deal.id===id||deal.customerId===id):undefined;
 for(const [id,history] of Object.entries(scoped.messages||{})){const client=resolve(id);if(!client)continue;for(const message of history)if(typeof message!=='string'&&onDay(message.sentAt))addClient(client,message.direction==='incoming'?'Сообщение клиента':'Ответ сотрудника')}
 for(const record of scoped.consultations)if(onDay(record.date)){const client=resolve(record.clientId)||resolve(record.dealId);if(client)addClient(client,'Запись на консультацию')}
 for(const task of tasks){const client=resolve(task.clientId)||resolve(task.customerId)||resolve(task.dealId);if(client)addClient(client,'Задача на день')}
 for(const sale of scoped.inventory.sales)if(onDay(sale.date)||(sale.refundHistory||[]).some(refund=>onDay(refund.date))){const client=resolve(sale.customerId);if(client)addClient(client,'Кассовая операция')}
 const gross=sales.filter(row=>row.kind==='sale').reduce((sum,row)=>sum+row.amount,0),refunds=sales.filter(row=>row.kind==='refund').reduce((sum,row)=>sum+row.amount,0),receipts=sales.filter(row=>row.kind==='sale').length;
 const important=tasks.filter(task=>!done(task.status)&&(task.urgent||task.channel==='Высокий')).length+events.filter(event=>event.source==='calendar'&&!event.completed&&scoped.business.calendar?.find(record=>record.id===event.recordId)?.urgent).length+[...clients.values()].filter(client=>client.urgent).length;
 return {date,timeZone:scope.timeZone,ownOnly:scope.ownOnly,access,events,tasks,clients:[...clients.values()],sales:sales.sort((a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id)),newClients:newClients.size,important,metrics:{gross,refunds,net:Math.round((gross-refunds)*100)/100,receipts,averageCheck:receipts?gross/receipts:0,tasks:tasks.length,completedTasks:tasks.filter(task=>done(task.status)).length,appointments:events.filter(event=>event.source==='consultation').length}};
}
export function calendarDayInsights(context:CalendarDayContext,now=new Date()){
 if(!context.access.ai)throw new Error('Запуск анализа недоступен вашей роли.');
 const items:{id:string;title:string;detail:string;action:string}[]=[];
 const unfinished=context.tasks.filter(task=>!done(task.status));
 if(context.important)items.push({id:'important',title:'Важные пункты дня',detail:'Записей с высоким приоритетом или срочностью: '+context.important+'.',action:'Сначала проверьте важные задачи и контакты; отметки не означают автоматически просрочку.'});
 if(unfinished.length)items.push({id:'tasks',title:context.date<calendarToday(context.timeZone,now)?'Остались незавершённые задачи':'Нагрузка по задачам',detail:unfinished.length+' из '+context.tasks.length+' задач выбранного дня не завершены.',action:context.date<calendarToday(context.timeZone,now)?'Проверьте результат и обновите статус или согласуйте новый срок.':'Распределите задачи по ответственным и уточните приоритеты.'});
 if(context.metrics.appointments)items.push({id:'appointments',title:'Записи на день',detail:context.metrics.appointments+' записей в доступной части календаря.',action:'Проверьте время и подтверждение клиентов до начала встреч.'});
 if(context.access.sales&&context.metrics.refunds>0)items.push({id:'refunds',title:'Возвраты в этот день',detail:context.metrics.refunds.toLocaleString('ru-RU',{maximumFractionDigits:2})+' сом возвратов по фактическим датам операций.',action:'Посмотрите причины в чеках. Возврат может относиться к продаже другого дня.'});
 if(context.newClients)items.push({id:'clients',title:'Новые клиенты',detail:context.newClients+' уникальных клиентских ID у карточек, созданных в этот день.',action:'Проверьте первый контакт и следующий шаг; статус ответа здесь не выводится без истории диалога.'});
 if(!items.length)items.push({id:'empty',title:'Нет сигналов для дополнительных действий',detail:'В доступных записях выбранного дня нет незавершённых задач, срочных отметок и возвратов.',action:'Это локальный разбор имеющихся данных, а не оценка всего бизнеса.'});
 return items;
}
export function calendarWeekLabel(date:string){if(!validCalendarDate(date))return '';const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay()||7));const year=day.getUTCFullYear(),first=new Date(Date.UTC(year,0,1,12));return 'Неделя '+Math.ceil((((day.getTime()-first.getTime())/86400000)+1)/7)+' · '+year;}
export function calendarImportantDates(data:CalendarContextData,scope:CalendarDayScope){const scoped=calendarScopedData(data,scope),days=new Set<string>();const add=(value?:string)=>{const when=value&&calendarMoment(value,'',scope.timeZone);if(when)days.add(when.date)};for(const record of [...scoped.tasks,...(scoped.business.calendar||[])])if(!done(record.status)&&(record.urgent||record.channel==='Высокий'))add((record as CalendarRecord).date||record.nextTaskAt);for(const deal of scoped.deals)if(deal.urgent&&deal.hasOpenTasks!==false)add(deal.nextTaskAt);return days;}
