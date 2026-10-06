import {initialAgents,type Entity} from './data.ts';
import {initialRoles,type TeamRole} from './team.ts';
import {initialInventory,type InventoryState} from './inventory-model.ts';

export const businessSetupItems=[
 'Воронка продаж','Поля карточки клиента','Роли команды','4 ИИ-агента',
 '4 сценария автоматизации','Основной склад','3 рабочих отчёта','6 ключевых виджетов',
];
export const businessSetupDetails=[
 'Основные и отраслевые этапы. Ваши этапы сохранятся.',
 'Контакты, потребности и история клиента в настройках CRM.',
 'Владелец, менеджер и консультант с отдельными правами.',
 'Продажи, поддержка, повторный контакт и контроль качества.',
 'Готовые схемы в Автоматизациях и библиотеке Agent Builder.',
 'Склад для приёмки, остатков и кассы. Товары сохранятся.',
 'Продажи, команда и маркетинг в разделе «Аналитика».',
 'Выручка, конверсия, лиды, средний чек, расходы ИИ и остатки.',
];
type Stage={id:string;name:string;color:string};
type StoredRow={id:string;name:string;[key:string]:unknown};
export type BlueprintDefaults={
 stages:{sales:Stage[];repeat:Stage[]};settings:Record<string,string|number|boolean>;
 boards:Record<string,string[]>;business:Record<string,StoredRow[]>;
};
type BlueprintInput={workspace:string;text:string;approved:boolean[];defaults:BlueprintDefaults;now?:string};
type StorageAccess=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type BlueprintSnapshot={before:Record<string,string|null>;after:Record<string,string>};
export type BlueprintWorkflow={id:string;name:string;date:string;nodes:{id:string;type:'agent';position:{x:number;y:number};data:Record<string,unknown>}[];edges:{id:string;source:string;target:string}[]};
export function businessProfile(text:string){
 const field=(name:string)=>text.split('\n').find(line=>line.startsWith(name+': '))?.slice(name.length+2)||'';
 const industry=field('Сфера');
 const channels=field('Каналы').split(', ').filter(channel=>['WhatsApp','Instagram','Telegram','Сайт','Офлайн'].includes(channel));
 const specific=industry==='Красота и здоровье'?{fields:['Тип кожи','Текущий уход','Чувствительность'],stages:['Консультация']}:industry==='Услуги и консультации'?{fields:['Услуга','Формат консультации','Дата встречи'],stages:['Запись на услугу','Оказание услуги']}:industry==='Обучение'?{fields:['Программа обучения','Уровень подготовки','Расписание'],stages:['Пробное занятие','Зачисление']}:industry==='Магазин и онлайн-продажи'?{fields:['Категория интереса','Размер','Способ доставки'],stages:[]}: {fields:[],stages:[]};
 return {industry,team:field('Команда'),channels,...specific};
}

function read<T>(storage:StorageAccess,key:string,fallback:T):T{
 const raw=storage.getItem('life-'+key);
 if(raw===null)return structuredClone(fallback);
 try{return JSON.parse(raw) as T}catch{throw new Error('Не удалось прочитать настройки. Повреждён раздел «'+key+'».')}
}
function appendNamed<T extends {name:string}>(rows:T[],added:T[]){
 const names=new Set(rows.map(row=>row.name.trim().toLocaleLowerCase()));
 return [...rows,...added.filter(row=>{const key=row.name.trim().toLocaleLowerCase();if(names.has(key))return false;names.add(key);return true})];
}
function workflows(prefix:string,date:string,stages:string[]):BlueprintWorkflow[]{
 const contact=stages.find(stage=>stage==='Первичный контакт')||stages[0]||'Первичный контакт';
 const paid=stages.find(stage=>stage==='Оплата')||stages.at(-1)||contact;
 const specs=[
  {key:'lead',name:'Новый лид → Sales Agent',nodes:[{kind:'Trigger',label:'Новое обращение',source:'Все'},{kind:'AI Agent',label:'Изучить клиента',tool:'get_clients'},{kind:'CRM',label:'Первичный контакт',action:'move',stage:contact}]},
  {key:'followup',name:'Повторный контакт через 24 часа',nodes:[{kind:'Trigger',label:'Нужен повторный контакт',source:'Все'},{kind:'Delay',label:'Подождать 24 часа',minutes:1440},{kind:'Message',label:'Подготовить ответ',template:'Здравствуйте, {{имя}}! Возвращаюсь к нашему разговору. Остались ли у вас вопросы?',channel:'Канал клиента'}]},
  {key:'payment',name:'Подтверждение оплаты → CRM',nodes:[{kind:'Trigger',label:'Проверить оплату',source:'Все'},{kind:'Human Approval',label:'Подтверждение менеджера',approver:'Ответственный за сделку'},{kind:'CRM',label:'Отметить оплату',action:'move',stage:paid}]},
  {key:'stock',name:'Проверка остатков склада',nodes:[{kind:'Trigger',label:'Проверить каталог',source:'Все'},{kind:'Inventory',label:'Получить остатки',tool:'get_inventory'},{kind:'Output',label:'Отчёт по остаткам',format:'Отчёт'}]},
 ];
 return specs.map(spec=>{const id=prefix+'-'+spec.key;return {id,name:spec.name,date,nodes:spec.nodes.map((data,i)=>({id:id+'-'+i,type:'agent' as const,position:{x:70+i*310,y:140},data})),edges:spec.nodes.slice(1).map((_,i)=>({id:id+'-edge-'+i,source:id+'-'+i,target:id+'-'+(i+1)}))}});
}
export function buildAutomationBlueprint(workspace:string,stages:string[]|string,now=new Date().toISOString()){
 const prefix='blueprint-'+encodeURIComponent(workspace.trim()||'workspace');
 const snapshots=workflows(prefix,now,Array.isArray(stages)?stages:[stages]);
 const records=snapshots.map(flow=>({id:flow.id,name:flow.name,value:0,status:'Пауза',channel:flow.id.endsWith('-lead')?'lead.created':flow.id.endsWith('-followup')?'timer.24h':flow.id.endsWith('-payment')?'order.paid':'stock.low',owner:workspace,note:'Готовый сценарий. Откройте и проверьте на локальных данных клиента.',workflowId:flow.id}));
 return {records,snapshots};
}

export function planBusinessBlueprint(storage:StorageAccess,input:BlueprintInput){
 const {workspace,text,approved,defaults}=input;
 if(!approved.some(Boolean))throw new Error('Выберите хотя бы один раздел для настройки.');
 const date=input.now||new Date().toISOString();
 const profile=businessProfile(text);
 const prefix='blueprint-'+encodeURIComponent(workspace.trim()||'workspace');
 const entries:Record<string,unknown>={};
 const put=(key:string,value:unknown)=>entries['life-'+key]=value;
 const stageConfig=read(storage,'stage-config-v3',defaults.stages);
 if(approved[0]){
  const suggestions=[...defaults.stages.sales.map((stage,i)=>({...stage,id:prefix+'-stage-'+i})),...profile.stages.map((name,i)=>({id:prefix+'-industry-stage-'+i,name,color:['#6499df','#54b8a0'][i%2]}))];
  const sales=appendNamed(stageConfig.sales,suggestions);
  put('stage-config-v3',{...stageConfig,sales});
  stageConfig.sales=sales;
 }
 if(approved[1]){
  const values=read(storage,'settings-deep-v2',defaults.settings);
  const fields=['Телефон','Город','Источник','Email','Адрес','Компания','Потребность','Бюджет','Предпочтительный канал','Следующий контакт','Интересующие товары','Условия доставки','Способ оплаты','Примечание',...profile.fields];
  put('settings-deep-v2',{...values,customFields:[...new Set([...String(values.customFields||'').split('\n').filter(Boolean),...fields])].join('\n')});
 }
 if(approved[2]){
  const roles=read<TeamRole[]>(storage,'team-roles-v3',initialRoles);
  const consultant:TeamRole={id:prefix+'-consultant',name:'Консультант',pages:['dashboard','crm','conversations','customers','tasks','calendar','knowledge','help'],actions:['create','edit','ai','password']};
  put('team-roles-v3',appendNamed(roles,[...initialRoles.filter(role=>['owner','manager'].includes(role.id)).map(role=>({...role,id:prefix+'-'+role.id})),consultant]));
 }
 if(approved[3]){
  const agents=read<Entity[]>(storage,'agents',initialAgents);
  put('agents',appendNamed(agents,initialAgents.slice(0,4).map((agent,i)=>({...agent,id:prefix+'-agent-'+i,name:agent.name+' · '+workspace,value:0,owner:'Workspace',note:'Контекст бизнеса: '+text+'\n'+agent.note}))));
 }
 if(approved[4]){
  const library=read<BlueprintWorkflow[]>(storage,'workflow-library-v1',[]);
  const {snapshots:prepared,records}=buildAutomationBlueprint(workspace,stageConfig.sales.map(stage=>stage.name),date);
  if(profile.channels.length===1){const trigger=prepared[0].nodes[0];trigger.data={...trigger.data,source:profile.channels[0],label:'Новое обращение · '+profile.channels[0]}}
  const merged=[...library,...prepared.filter(flow=>!library.some(existing=>existing.id===flow.id))];
  put('workflow-library-v1',merged);
  const business=read(storage,'business-modules-v1',defaults.business);
  const existing=business.automations||[];
  put('business-modules-v1',{...business,automations:[...existing,...records.filter(record=>!existing.some(row=>row.id===record.id))]});
 }
 if(approved[5]){
  const inventory=read<InventoryState>(storage,'inventory-v2',initialInventory);
  if(!inventory.warehouses.some(warehouse=>warehouse.name==='Основной склад')){
   const id=prefix+'-warehouse';
   put('inventory-v2',{...inventory,warehouses:[...inventory.warehouses,{id,name:'Основной склад',address:''}],products:inventory.products.map(product=>({...product,stocks:{...product.stocks,[id]:0}}))});
  }else put('inventory-v2',inventory);
 }
 if(approved[6]||approved[7]){
  const boards=read<Record<string,string[]>>(storage,'analytics-boards-v2',defaults.boards);
  if(approved[6]){
   const reports:Record<string,string[]>={Продажи:['revenue','orders','conversion','check','revenueTrend','leadsTrend','outcomes'],Команда:['employeeRevenue','employeeTable','teamResponse','workload'],Маркетинг:['channelRevenue','roas','cac','campaignTable']};
   for(const [name,widgets] of Object.entries(reports)){const title=workspace+' · '+name;if(!boards[title])boards[title]=widgets}
  }
  if(approved[7])boards.Обзор=[...new Set([...(boards.Обзор||[]),'revenue','conversion','leads','check','aiCost','stock'])];
  put('analytics-boards-v2',boards);
 }
 const config=read<Record<string,unknown>>(storage,'os-config',{});
 put('os-config',{...config,business:text,profile:{industry:profile.industry,team:profile.team,channels:profile.channels},modules:businessSetupItems.filter((_,i)=>approved[i]),createdAt:date});
 return entries;
}

/** Commit the selected stores together; restore their previous bytes if saving fails. */
export function applyBlueprint(storage:StorageAccess,entries:Record<string,unknown>):BlueprintSnapshot{
 const before=Object.fromEntries(Object.keys(entries).map(key=>[key,storage.getItem(key)]));
 const after=Object.fromEntries(Object.entries(entries).map(([key,value])=>[key,JSON.stringify(value)]));
 const written:string[]=[];
 try{for(const [key,value] of Object.entries(after)){storage.setItem(key,value);written.push(key)}}catch(error){for(const key of written.reverse()){if(before[key]===null)storage.removeItem(key);else storage.setItem(key,before[key]!)}throw error}
 return {before,after};
}
export function undoBlueprint(storage:StorageAccess,snapshot:BlueprintSnapshot){
 if(Object.keys(snapshot.after).some(key=>storage.getItem(key)!==snapshot.after[key]))throw new Error('После настройки эти данные уже менялись. Отмена недоступна, чтобы сохранить новые изменения.');
 const restored:string[]=[];
 try{for(const [key,value] of Object.entries(snapshot.before)){if(value===null)storage.removeItem(key);else storage.setItem(key,value);restored.push(key)}}catch(error){for(const key of restored.reverse())storage.setItem(key,snapshot.after[key]);throw error}
}
