import {agentToolDefinitions,type AgentAnalytics} from './agent-tools.ts';
import {canReadAgentRun,permittedAgentTools,type AgentDataAccess} from './agent-access.ts';

export const agentToolLabels:Record<string,string>={get_clients:'Клиенты и сделки',get_analytics:'Аналитика продаж',get_inventory:'Остатки товаров',get_tasks:'Задачи команды',web_search:'Поиск в интернете'};
export const agentEntityTools:Record<string,string>={clients:'get_clients',analytics:'get_analytics',inventory:'get_inventory',tasks:'get_tasks',web:'web_search'};
export const agentEntityLabels:Record<string,string>={clients:'Карточки клиентов и сделок',analytics:'Агрегаты CRM и кассы',inventory:'Товары и остатки',tasks:'Задачи',web:'Открытые интернет-источники'};
export function configuredAgentEntities(settings:Record<string,unknown>|undefined){
 if(settings?.entities===undefined)return Object.keys(agentEntityTools);
 let values:unknown=settings.entities;if(typeof values==='string'){const raw=values;try{values=JSON.parse(raw)}catch{values=raw.split(/[\n,]/)}}
 const aliases:Record<string,string>={crm:'clients',sales:'analytics',products:'inventory'};
 return Array.isArray(values)?[...new Set(values.filter((value):value is string=>typeof value==='string').map(value=>aliases[value.trim()]||value.trim()).filter(value=>Object.hasOwn(agentEntityTools,value)))]:[];
}
export function restrictAgentEntityTools(settings:Record<string,unknown>|undefined,tools:string[]){const allowed=configuredAgentEntities(settings).map(entity=>agentEntityTools[entity]);return tools.filter(tool=>allowed.includes(tool))}
export type AgentMetric={id:string;label:string;value:number;unit:'number'|'money'|'percent';source:string};
export type AgentPlanStep={id:string;label:string;tool?:string};
export type AgentJournalStep={tool:string;input:unknown;output:unknown;completedAt?:string};
export type AgentReport={id:string;actorId?:string;agentId?:string;agentName?:string;tools?:string[];knowledgeSpaces?:string[];finance?:boolean;task:string;prompt?:string;time:string;startedAt?:string;finishedAt?:string;mode?:'local'|'model';status:string;text:string;journal:AgentJournalStep[];plan?:AgentPlanStep[];metrics?:AgentMetric[];citations?:{url:string;title:string}[]};
export type AgentRecipe={id:string;name:string;description:string;task:string;tools:string[]};
export const agentRecipes:AgentRecipe[]=[
 {id:'sales-analyst',name:'Sales Analyst',description:'Выручка и воронка продаж',task:'Сопоставь выручку кассы и открытые сделки. Покажи факты и вопросы для проверки.',tools:['get_analytics','get_clients']},
 {id:'crm-supervisor',name:'CRM Supervisor',description:'Этапы и ответственность',task:'Проверь начальные этапы сделок, назначение ответственных и незавершённые задачи.',tools:['get_clients','get_tasks']},
 {id:'customer-intelligence',name:'Customer Intelligence',description:'Источники и обращения',task:'Изучи доступные карточки клиентов и распределение обращений по источникам.',tools:['get_clients','get_analytics']},
 {id:'inventory-analyst',name:'Inventory Analyst',description:'Остатки и закупки',task:'Покажи товары ниже минимального остатка и что нужно проверить перед закупкой.',tools:['get_inventory']},
 {id:'marketing-analyst',name:'Marketing Analyst',description:'Каналы и конверсия воронки',task:'Сравни источники обращений и итоги воронки. Не оценивай окупаемость без расходов на рекламу.',tools:['get_analytics']},
 {id:'employee-performance',name:'Employee Performance',description:'Нагрузка по открытым задачам',task:'Покажи количество незавершённых задач по ответственным. Не делай выводов о качестве работы без дополнительных данных.',tools:['get_tasks']},
 {id:'opportunity-finder',name:'Opportunity Finder',description:'Сделки, задачи и остатки',task:'Найди точки внимания в воронке, задачах и остатках. Сформулируй предложения для проверки человеком.',tools:['get_analytics','get_clients','get_inventory','get_tasks']},
];
export function buildAgentPlan(task:string,tools:string[],access:AgentDataAccess,mode:'local'|'model',webSearch=false):AgentPlanStep[]{
 if(!access.run)throw new Error('Запуск ИИ запрещён вашей ролью.');
 if(!task.trim()||task.trim().length>6000)throw new Error('Опишите задачу: от 1 до 6000 символов.');
 if(!tools.length)throw new Error('Выберите хотя бы один источник данных.');
 const permitted=permittedAgentTools(access);
 if(new Set(tools).size!==tools.length||tools.some(tool=>!permitted.includes(tool)||tool==='web_search'&&(mode!=='model'||!webSearch)))throw new Error('Выбран недоступный инструмент. Проверьте разрешения.');
 return [{id:'plan',label:'Проверить задачу и доступы'},...tools.map(tool=>({id:tool,label:agentToolLabels[tool],tool})),{id:'report',label:mode==='local'?'Собрать отчёт по правилам':'Получить ответ модели'},{id:'save',label:'Сохранить результат'}];
}
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const rows=(value:unknown)=>Array.isArray(value)?value.filter(record):[];
const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:0;
const successfulSteps=(journal:AgentJournalStep[])=>new Map(journal.filter(step=>!(record(step.output)&&step.output.error)).map(step=>[step.tool,step]));
export function agentToolStatus(journal:AgentJournalStep[],tool:string){const step=journal.findLast(step=>step.tool===tool);return !step?'pending':record(step.output)&&step.output.error?'error':'complete'}
const finishedTask=(status:unknown)=>['done','завершена','завершено','выполнена','выполнено','готово','отменена','отменено'].includes(String(status).trim().toLocaleLowerCase('ru'));
export function summarizeAgentJournal(journal:AgentJournalStep[]):{text:string;metrics:AgentMetric[]}{
 const findings:string[]=[],metrics:AgentMetric[]=[];
 const metric=(id:string,label:string,value:number,unit:AgentMetric['unit'],source:string)=>metrics.push({id,label,value,unit,source});
 const latest=new Map([...successfulSteps(journal)].map(([tool,step])=>[tool,step.output]));
 const analytics=latest.get('get_analytics');
 if(record(analytics)){
  const a=analytics as unknown as AgentAnalytics;metric('revenue','Выручка после возвратов',numeric(a.revenue),'money','get_analytics');metric('sales','Чеки продаж',numeric(a.sales),'number','get_analytics');metric('leads','Сделки',numeric(a.leads),'number','get_analytics');metric('potential','Потенциал открытых сделок',numeric(a.potential),'money','get_analytics');metric('won','Успешные сделки',numeric(a.won),'number','get_analytics');
  findings.push(`Касса: ${numeric(a.sales)} чеков, ${numeric(a.revenue).toLocaleString('ru-RU')} сом после возвратов. Потенциал открытых сделок: ${numeric(a.potential).toLocaleString('ru-RU')} сом.`);
  if(record(a.sources))findings.push('Обращения по источникам: '+Object.entries(a.sources).map(([source,count])=>source+' — '+count).join('; ')+'.');
 }
 if(latest.has('get_clients')){
  const clients=rows(latest.get('get_clients')),early=clients.filter(client=>['Неразобранное','Первичный контакт'].includes(String(client.stage))),unassigned=clients.filter(client=>!String(client.owner||'').trim());
  metric('early','Сделки на начальных этапах',early.length,'number','get_clients');metric('unassigned','Без ответственного',unassigned.length,'number','get_clients');
  findings.push(`В выбранных карточках: ${clients.length} сделок; на начальных этапах — ${early.length}, без ответственного — ${unassigned.length}. Проверьте историю диалогов перед повторным контактом.`);
 }
 if(latest.has('get_inventory')){
  const products=rows(latest.get('get_inventory')),low=products.filter(product=>product.low===true);metric('lowStock','Товаров ниже минимума',low.length,'number','get_inventory');metric('products','Товаров в каталоге',products.length,'number','get_inventory');
  findings.push(low.length?'Ниже минимального остатка: '+low.map(product=>String(product.name)).join(', ')+'. Проверьте спрос и ожидаемые поставки перед закупкой.':'В доступном каталоге нет товаров ниже установленного минимума.');
 }
 if(latest.has('get_tasks')){
  const tasks=rows(latest.get('get_tasks')),open=tasks.filter(task=>!finishedTask(task.status)),owners=new Map<string,number>();for(const task of open){const owner=String(task.owner||'Без ответственного');owners.set(owner,(owners.get(owner)||0)+1)}
  metric('openTasks','Незавершённые задачи',open.length,'number','get_tasks');findings.push(`Открытых задач: ${open.length}.`+(owners.size?' По ответственным: '+[...owners].map(([owner,count])=>owner+' — '+count).join('; ')+'.':'')+' Количество задач само по себе не оценивает качество работы.');
 }
 return {metrics,text:findings.join('\n\n')||'Нет результатов доступных инструментов для локального отчёта.'};
}
export function compareAgentReports(first:AgentReport,second:AgentReport,actorId:string,access:AgentDataAccess){
 if(!canReadAgentRun(first,actorId,access)||!canReadAgentRun(second,actorId,access))throw new Error('Нет доступа к одному из отчётов.');
 if(first.id===second.id)throw new Error('Выберите два разных отчёта.');
 if(first.status!=='Завершён'||second.status!=='Завершён')throw new Error('Сравниваются только завершённые отчёты.');
 const query=(report:AgentReport,tool:string)=>{const input=successfulSteps(report.journal).get(tool)?.input;return tool==='get_clients'&&record(input)?String(input.query||'').toLowerCase():''};
 return (first.metrics||[]).flatMap(before=>{if(query(first,before.source)!==query(second,before.source))return [];const after=second.metrics?.find(metric=>metric.id===before.id&&metric.unit===before.unit&&metric.source===before.source);return after?[{...before,before:before.value,after:after.value,delta:after.value-before.value}]:[]});
}
export function nextAgentRun(settings:Record<string,string>|undefined,now:Date){
 if(!Number.isFinite(now.getTime())||!settings||!['daily','weekly'].includes(settings.frequency)||settings.status==='disabled')return null;
 let schedule:{time?:unknown;weekday?:unknown}={time:settings.schedule};try{if(settings.schedule?.startsWith('{'))schedule=JSON.parse(settings.schedule)}catch{return null}
 if(typeof schedule.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time))return null;
 const [hours,minutes]=schedule.time.split(':').map(Number),next=new Date(now);next.setHours(hours,minutes,0,0);
 if(settings.frequency==='weekly'){const day=Number(schedule.weekday);if(!Number.isInteger(day)||day<1||day>7)return null;const delta=(day-(next.getDay()||7)+7)%7;next.setDate(next.getDate()+delta);if(next<=now)next.setDate(next.getDate()+7)}else if(next<=now)next.setDate(next.getDate()+1);
 return next.toISOString();
}
export function configuredAgentTools(settings:Record<string,unknown>|undefined,fallback:string[]){
 if(settings?.tools===undefined)return restrictAgentEntityTools(settings,fallback);
 let values:string[]=[];if(Array.isArray(settings.tools))values=settings.tools.filter((value):value is string=>typeof value==='string');else if(typeof settings.tools==='string')try{const parsed:unknown=JSON.parse(settings.tools);if(Array.isArray(parsed))values=parsed.filter((value):value is string=>typeof value==='string')}catch{values=settings.tools.split(/[\n,]/).map(value=>value.trim()).filter(Boolean)}
 const map:Record<string,string>={'crm.read':'get_clients','analytics.read':'get_analytics','inventory.read':'get_inventory','tasks.read':'get_tasks','web.search':'web_search'};
 const known=new Set([...agentToolDefinitions.map(tool=>tool.name),'web_search']);return restrictAgentEntityTools(settings,[...new Set(values.map(value=>map[value]||value).filter(value=>known.has(value)))]);
}
export function appendAgentReport(history:AgentReport[],report:AgentReport){
 const sameActor=(item:AgentReport)=>(item.actorId||'owner-user')===(report.actorId||'owner-user');
 const own=[report,...history.filter(item=>item.id!==report.id&&sameActor(item))].slice(0,100);
 return [...own,...history.filter(item=>!sameActor(item))];
}

export function agentStartMode(tools:string[],access:AgentDataAccess,provider:{configured:boolean;webSearch:boolean}):'local'|'model'|null{const permitted=permittedAgentTools(access),selected=tools.filter(tool=>permitted.includes(tool));if(selected.some(tool=>tool!=='web_search'))return 'local';return selected.includes('web_search')&&provider.configured&&provider.webSearch?'model':null}
