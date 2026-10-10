import type {Entity} from './data.ts';
import {messageText,messageDirection,type ChatMessage} from './conversations.ts';
import type {InventoryState} from './inventory-model.ts';
import type {Employee,TeamAction} from './team.ts';
import {calendarSources,validCalendarDate,type CalendarEvent} from './calendar.ts';
import {summarizeAgentAnalytics} from './agent-tools.ts';
export const systemTools=[
 {name:'get_clients',label:'Найти клиентов',pages:['customers','crm','conversations']},
 {name:'get_client',label:'Карточка клиента',pages:['customers','crm','conversations']},
 {name:'get_dialogs',label:'Посмотреть диалог',pages:['conversations']},
 {name:'get_deals',label:'Посмотреть сделки',pages:['crm']},
 {name:'get_sales',label:'Посмотреть продажи',pages:['pos']},
 {name:'get_products',label:'Найти товары',pages:['inventory']},
 {name:'get_inventory',label:'Получить остатки',pages:['inventory']},
 {name:'get_tasks',label:'Посмотреть задачи',pages:['tasks']},
 {name:'get_employees',label:'Посмотреть сотрудников',pages:['employees']},
 {name:'get_planning',label:'Посмотреть план бизнеса',pages:['planning']},
 {name:'get_agents',label:'Посмотреть AI-агентов',pages:['agents']},
 {name:'get_analytics',label:'Получить аналитику',pages:['analytics']},
 {name:'create_client',label:'Создать клиента',pages:['customers','crm'],action:'create'},
 {name:'update_client',label:'Изменить клиента',pages:['customers','crm'],action:'edit'},
 {name:'create_deal',label:'Создать сделку',pages:['crm'],action:'create'},
 {name:'create_task',label:'Создать задачу',pages:['tasks'],action:'create'},
 {name:'create_employee',label:'Добавить сотрудника',pages:['employees'],action:'manageTeam'},
 {name:'run_agent',label:'Запустить агента',pages:['agents'],action:'ai'},
 {name:'get_calendar',label:'Посмотреть календарь',pages:['calendar']},
 {name:'get_settings',label:'Посмотреть оформление',pages:['settings']},
 {name:'update_settings',label:'Изменить настройки',pages:['settings'],action:'edit'}
] as const;
export type SystemToolName=typeof systemTools[number]['name'];
export type SystemAccess=(page:string,action?:TeamAction)=>boolean;
export function allowedSystemTools(can:SystemAccess){return systemTools.filter(tool=>tool.pages.some(page=>can(page,'action' in tool?tool.action:undefined)))}
export type SystemAppearance={theme:string;accent:string;collapsed:boolean;fontFamily:string;density:string;fontSize:number;motion:boolean;lowPower:boolean};
export type SystemCalendarResult=Pick<CalendarEvent,'id'|'title'|'date'|'time'|'source'|'recordId'>;
export function systemAppearanceResult(appearance:unknown):Partial<SystemAppearance>{
 if(!appearance||typeof appearance!=='object'||Array.isArray(appearance))return {};
 const value=appearance as Record<string,unknown>,result:Record<string,unknown>={};
 for(const key of ['theme','accent','fontFamily','density'])if(typeof value[key]==='string')result[key]=value[key];
 for(const key of ['collapsed','motion','lowPower'])if(typeof value[key]==='boolean')result[key]=value[key];
 if(typeof value.fontSize==='number'&&Number.isFinite(value.fontSize))result.fontSize=value.fontSize;
 return result;
}
export function calendarToolArguments(text:string){
 const date=text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
 const query=(date?text.replace(date,''):text).replace(/^(покажи|посмотри|найди|открой)\s+/i,'').replace(/^(?:в\s+)?(календар[ьяе]|событи[яе]|записи?)(?:\s+на)?[\s:—-]*/i,'').trim();
 return {...(date?{date}:{}),query};
}
export type SystemContext={messages?:Record<string,ChatMessage[]>;clients:Entity[];tasks:Entity[];inventory:InventoryState;employees:Employee[];agents?:Entity[];calendar?:CalendarEvent[];appearance?:SystemAppearance;plan?:{revenue:number;check:number;conversion:number;days:number;dailyCapacity:number};can:SystemAccess};
export function executeSystemRead(name:SystemToolName,args:{query?:string;id?:string;date?:string},context:SystemContext){
 const tool=systemTools.find(tool=>tool.name===name);
 if(!tool||!allowedSystemTools(context.can).some(tool=>tool.name===name))throw new Error('Инструмент недоступен вашей роли.');
 if('action' in tool)throw new Error('Изменение требует отдельного подтверждения.');
 const q=(args.query||'').trim().toLocaleLowerCase('ru'),matches=(text:string)=>text.toLocaleLowerCase('ru').includes(q);
 if(name==='get_clients'||name==='get_client'||name==='get_deals')return context.clients.filter(client=>(!args.id||client.id===args.id||client.customerId===args.id)&&matches([client.name,client.phone,client.channel,client.username,client.status].join(' '))).map(client=>({id:client.id,customerId:client.customerId||client.id,name:client.name,phone:client.phone||'',channel:client.channel,stage:client.status,owner:client.owner}));
 if(name==='get_dialogs')return context.clients.filter(client=>(!args.id||client.id===args.id||client.customerId===args.id)&&matches([client.name,client.phone,client.username].join(' '))).map(client=>({id:client.id,name:client.name,channel:client.channel,messages:(context.messages?.[client.id]||[]).map(message=>({text:messageText(message),direction:messageDirection(message)}))}));
 if(name==='get_planning')return context.plan?{targetRevenue:context.plan.revenue,averageCheck:context.plan.check,conversion:context.plan.conversion,workDays:context.plan.days,dailyCapacity:context.plan.dailyCapacity}:{};
 if(name==='get_agents')return (context.agents||[]).filter(agent=>matches(agent.name+' '+agent.note)).map(agent=>({id:agent.id,name:agent.name,status:agent.status,description:agent.note}));
 if(name==='get_tasks')return context.tasks.filter(task=>matches(task.name+' '+task.owner)).map(task=>({id:task.id,name:task.name,status:task.status,owner:task.owner,deadline:task.nextTaskAt||'',clientId:task.clientId||''}));
 if(name==='get_employees')return context.employees.filter(employee=>matches(employee.name+' '+employee.position)).map(({id,name,position,status,role})=>({id,name,position,status,role}));
 if(name==='get_inventory'||name==='get_products')return context.inventory.products.filter(product=>!product.deleted&&matches(product.name+' '+product.sku)).map(product=>({id:product.id,name:product.name,price:product.price,stock:Object.values(product.stocks).reduce((sum,count)=>sum+count,0),minimum:product.minimum,...(context.can('finance')?{cost:product.cost}:{})}));
 if(name==='get_sales'){const canReadCustomers=['crm','customers','conversations'].some(page=>context.can(page));return context.inventory.sales.filter(sale=>matches(sale.id+' '+(canReadCustomers?sale.customerName||'':'')+' '+sale.items.map(item=>item.name).join(' '))).map(sale=>({id:sale.id,date:sale.date,...(canReadCustomers?{customerId:sale.customerId||'',customerName:sale.customerName||'Без клиента'}:{}),total:sale.total-sale.refunds,status:sale.status}));}
 if(name==='get_analytics'){const result=summarizeAgentAnalytics({clients:context.clients,tasks:context.tasks,inventory:context.inventory}),crm=context.can('crm'),sales=context.can('pos')&&(context.can('analytics')||context.can('finance'));return {...(crm?{leads:result.leads,won:result.won,lost:result.lost,potential:result.potential,sources:result.sources}:{}),...(sales?{sales:result.sales,revenue:result.revenue,refunds:result.refunds}:{})};}
 if(name==='get_calendar'){
  if(args.date&&!validCalendarDate(args.date))throw new Error('Укажите существующую дату в формате ГГГГ-ММ-ДД.');
  return (context.calendar||[]).filter(event=>Object.hasOwn(calendarSources,event.source)&&context.can(calendarSources[event.source].route)&&(!args.id||event.id===args.id)&&(!args.date||event.date===args.date)&&matches([event.title,event.date,event.time,event.source,calendarSources[event.source].label,event.recordId].join(' '))).map(({id,title,date,time,source,recordId}):SystemCalendarResult=>({id,title,date,time,source,recordId}));
 }
 if(name==='get_settings')return systemAppearanceResult(context.appearance);
 throw new Error('Инструмент пока не поддерживается.');
}
export function inferSystemTool(text:string):SystemToolName{
 const q=text.toLocaleLowerCase('ru');
 if(/диалог|переписк/.test(q))return 'get_dialogs';
 if(/календар|событи|запис/.test(q))return 'get_calendar';
 if(/план|цел[ьи]/.test(q))return 'get_planning';
 if(/аналит|выруч|конверси/.test(q))return 'get_analytics';
 if(/остат|склад/.test(q))return 'get_inventory';
 if(/товар|продукт/.test(q))return 'get_products';
 if(/сотруд|команд/.test(q))return /созда|добав/.test(q)?'create_employee':'get_employees';
 if(/агент/.test(q))return /запус|запуст/.test(q)?'run_agent':'get_agents';
 if(/настрой|внешн.*вид|оформлен|шрифт|тема|тему/.test(q))return /измен|помен|настроить|(?:^|\s)настрой(?:те)?(?:\s|$)|установ|включ|выключ/.test(q)?'update_settings':'get_settings';
 if(/клиент/.test(q)&&/измен|редакт|обнов/.test(q))return 'update_client';
 if(/задач/.test(q))return /созда|добав/.test(q)?'create_task':'get_tasks';
 if(/продаж|чек|покуп/.test(q))return 'get_sales';
 if(/сделк/.test(q))return /созда|добав/.test(q)?'create_deal':'get_deals';
 if(/клиент/.test(q)&&/созда|добав/.test(q))return 'create_client';
 return 'get_clients';
}
