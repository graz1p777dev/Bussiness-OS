import {z} from 'zod';
import type {Entity} from './data.ts';
import type {InventoryState} from './inventory-model.ts';
import type {Employee} from './team.ts';
import type {Appointment} from './appointments.ts';
import {canReadAgentRun} from './agent-access.ts';
import type {AgentReport} from './agent-workspace.ts';
import {calendarMoment} from './calendar.ts';
import {isStockTrackedProduct} from './product-options.ts';

export type LiveAnalyticsAccess=Record<'crm'|'sales'|'inventory'|'tasks'|'appointments'|'agents'|'marketing'|'employees'|'finance'|'edit'|'export',boolean>;
export type LiveAnalyticsContext={deals:Entity[];inventory:InventoryState;tasks:Entity[];appointments:Appointment[];runs:AgentReport[];employees:Employee[];marketing:Entity[]};
export const liveGroups={none:'Общий итог',date:'По дням',month:'По месяцам',channel:'По источникам',owner:'По ответственным',status:'По статусам',category:'По категориям'};
type Group=keyof typeof liveGroups;
type MetricDefinition={id:string;label:string;source:keyof LiveAnalyticsAccess;unit:'number'|'money'|'percent';snapshot?:boolean;groups:Group[];description:string};
export const liveMetrics:MetricDefinition[]=[
 {id:'revenue',label:'Выручка после возвратов',source:'sales',unit:'money',groups:['none','date','month'],description:'Сумма чеков минус все сохранённые возвраты этих чеков. Период определяется датой покупки; суммы CRM не добавляются.'},
 {id:'sales',label:'Чеки продаж',source:'sales',unit:'number',groups:['none','date','month','status'],description:'Количество сохранённых чеков по дате покупки, включая чеки с возвратом.'},
 {id:'refunds',label:'Возвраты по чекам периода',source:'sales',unit:'money',groups:['none','date','month'],description:'Все сохранённые возвраты по покупкам выбранного периода. Это не движение денег по датам возвратов.'},
 {id:'averageCheck',label:'Средний чек после возвратов',source:'sales',unit:'money',groups:['none','date','month'],description:'Чистая выручка по покупкам периода / число чеков, включая полностью возвращённые.'},
 {id:'buyers',label:'Покупатели с ID',source:'sales',unit:'number',groups:['none','date','month'],description:'Уникальные customerId в чеках с положительной суммой после возвратов. Анонимные чеки не считаются отдельными клиентами.'},
 {id:'leads',label:'Созданные сделки',source:'crm',unit:'number',groups:['none','date','month','channel','owner','status'],description:'Сделки с сохранённой датой создания в выбранном периоде.'},
 {id:'clients',label:'Клиенты CRM',source:'crm',unit:'number',snapshot:true,groups:['none'],description:'Уникальные customerId, а для старых карточек — собственные ID. Текущее состояние, без фильтра даты.'},
 {id:'potential',label:'Потенциал открытых сделок',source:'crm',unit:'money',snapshot:true,groups:['none','channel','owner'],description:'Суммы незакрытых сделок сейчас. Это ожидаемый потенциал, а не выручка кассы.'},
 {id:'wonRate',label:'Доля успешных сделок',source:'crm',unit:'percent',snapshot:true,groups:['none','channel','owner'],description:'Успешные сделки / все текущие сделки × 100%. Это состояние воронки, не конверсия новых клиентов периода.'},
 {id:'stock',label:'Единиц на складах',source:'inventory',unit:'number',snapshot:true,groups:['none','category'],description:'Сумма текущих остатков активных складских товаров. Услуги исключены.'},
 {id:'lowStock',label:'Товаров ниже минимума',source:'inventory',unit:'number',snapshot:true,groups:['none','category'],description:'Количество активных складских товаров, чей суммарный остаток ниже установленного минимума.'},
 {id:'openTasks',label:'Незавершённые задачи',source:'tasks',unit:'number',snapshot:true,groups:['none','owner','status'],description:'Текущие задачи без завершённых и отменённых. Количество не оценивает качество работы сотрудника.'},
 {id:'appointments',label:'Записи в календаре',source:'appointments',unit:'number',groups:['none','date','month','status'],description:'Сохранённые консультации, процедуры и встречи выбранного периода, включая отменённые записи.'},
 {id:'runs',label:'Мои запуски агентов',source:'agents',unit:'number',groups:['none','date','month','status'],description:'Сохранённые запуски текущего аккаунта с ISO-датой начала, доступные по текущим правам.'},
 {id:'campaignBudget',label:'Бюджеты кампаний',source:'marketing',unit:'money',snapshot:true,groups:['none','channel','status'],description:'Сумма сохранённых бюджетов кампаний. Это плановые бюджеты, не фактически потраченные деньги или ROAS.'},
 {id:'campaigns',label:'Кампании',source:'marketing',unit:'number',snapshot:true,groups:['none','channel','status'],description:'Текущее количество сохранённых маркетинговых кампаний.'},
 {id:'employees',label:'Активные сотрудники',source:'employees',unit:'number',snapshot:true,groups:['none','category'],description:'Активные учётные записи команды по отделам. Оклады и другие условия найма не используются.'},
];
export const liveWidgetSchema=z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(100),metric:z.string(),kind:z.enum(['metric','chart','table']),group:z.enum(['none','date','month','channel','owner','status','category'])}).strict().refine(widget=>{const metric=liveMetrics.find(metric=>metric.id===widget.metric);return Boolean(metric&&metric.groups.includes(widget.group)&&(widget.kind!=='metric'||widget.group==='none'))},'Выберите поддерживаемый показатель и группировку');
export type LiveWidget=z.infer<typeof liveWidgetSchema>;
export const liveAnalyticsConfigSchema=z.record(z.array(liveWidgetSchema).max(24).refine(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'Повторяющиеся ID виджетов'));
export const initialLiveWidgets:LiveWidget[]=[{id:'revenue',title:'Выручка после возвратов',metric:'revenue',kind:'metric',group:'none'},{id:'sales',title:'Чеки продаж',metric:'sales',kind:'metric',group:'none'},{id:'potential',title:'Потенциал CRM',metric:'potential',kind:'metric',group:'none'},{id:'lowStock',title:'Низкие остатки',metric:'lowStock',kind:'metric',group:'none'},{id:'daily',title:'Выручка по дням',metric:'revenue',kind:'chart',group:'date'},{id:'sources',title:'Созданные сделки по источникам',metric:'leads',kind:'table',group:'channel'},{id:'tasks',title:'Открытые задачи',metric:'openTasks',kind:'chart',group:'owner'}];
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function validateLivePeriod(start:string,end:string){if(!validDay(start)||!validDay(end)||start>end||Date.parse(end)-Date.parse(start)>365*86400000)throw new Error('Выберите корректный период от 1 до 366 дней.')}
type Observation={value:number;date?:string;channel?:string;owner?:string;status?:string;category?:string;customerId?:string};
export function liveMetricResult(widget:LiveWidget,data:LiveAnalyticsContext,access:LiveAnalyticsAccess,actorId:string,start:string,end:string,timeZone='Asia/Bishkek'){
 const day=(value?:string)=>value?calendarMoment(value,'',timeZone)?.date||'':'';
 const definition=liveMetrics.find(metric=>metric.id===widget.metric);if(!definition||!access[definition.source])throw new Error('Показатель недоступен вашей роли.');liveWidgetSchema.parse(widget);validateLivePeriod(start,end);
 let rows:Observation[]=[];
 if(definition.source==='sales')rows=data.inventory.sales.map(sale=>({date:day(sale.date),status:sale.status,customerId:sale.total>sale.refunds?sale.customerId:undefined,value:widget.metric==='sales'?1:widget.metric==='refunds'?sale.refunds:sale.total-sale.refunds}));
 if(definition.source==='crm'){
  if(widget.metric==='clients')rows=[...new Set(data.deals.map(deal=>deal.customerId||deal.id))].map(()=>({value:1}));
  else rows=data.deals.filter(deal=>widget.metric!=='potential'||![deal.pipeline,deal.status].some(status=>status==='Успешно'||status==='Неуспешно')).map(deal=>({date:day(deal.createdAt),channel:deal.channel,owner:deal.owner,status:deal.status,value:widget.metric==='potential'?deal.value:widget.metric==='wonRate'?(deal.pipeline==='Успешно'||deal.status==='Успешно'?1:0):1}));
 }
 if(definition.source==='inventory')rows=data.inventory.products.filter(product=>!product.deleted&&isStockTrackedProduct(product)).map(product=>({category:product.category,value:widget.metric==='stock'?Object.values(product.stocks).reduce((sum,n)=>sum+n,0):Object.values(product.stocks).reduce((sum,n)=>sum+n,0)<product.minimum?1:0}));
 if(definition.source==='tasks')rows=data.tasks.filter(task=>!['done','завершена','завершено','выполнена','выполнено','готово','отменена','отменено'].includes(task.status.trim().toLocaleLowerCase('ru'))).map(task=>({owner:task.owner,status:task.status,value:1}));
 if(definition.source==='appointments')rows=data.appointments.map(item=>({date:day(item.date),status:item.status,value:1}));
 if(definition.source==='agents')rows=data.runs.filter(run=>canReadAgentRun(run,actorId,{run:access.agents,export:false,clients:access.crm,analytics:access.sales,inventory:access.inventory,tasks:access.tasks,finance:access.finance})).map(run=>({date:day(run.startedAt),status:run.status,value:1}));
 if(definition.source==='marketing')rows=data.marketing.map(campaign=>({channel:campaign.channel,status:campaign.status,value:widget.metric==='campaigns'?1:campaign.value}));
 if(definition.source==='employees')rows=data.employees.filter(employee=>employee.status==='Активен').map(employee=>({category:employee.department||'Без отдела',value:1}));
 const undated=definition.snapshot?0:rows.filter(row=>!row.date).length,selected=definition.snapshot?rows:rows.filter(row=>row.date&&row.date>=start&&row.date<=end);
 const calculate=(rows:Observation[])=>widget.metric==='buyers'?new Set(rows.map(row=>row.customerId).filter(Boolean)).size:widget.metric==='averageCheck'||widget.metric==='wonRate'?rows.length?rows.reduce((sum,row)=>sum+row.value,0)/rows.length*(widget.metric==='wonRate'?100:1):0:rows.reduce((sum,row)=>sum+row.value,0);
 const groups=new Map<string,Observation[]>();for(const row of selected){const label=widget.group==='none'?'Всего':widget.group==='month'?row.date?.slice(0,7):row[widget.group];const name=label||'Не указан';groups.set(name,[...(groups.get(name)||[]),row])}
 const grouped=[...groups].map(([name,rows])=>({name,value:calculate(rows),count:rows.length})).sort((a,b)=>['date','month'].includes(widget.group)?a.name.localeCompare(b.name):b.value-a.value||a.name.localeCompare(b.name));
 return {definition,value:calculate(selected),count:selected.length,undated,rows:grouped};
}
