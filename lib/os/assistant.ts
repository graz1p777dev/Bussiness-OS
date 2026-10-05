/** Frontend contract: a future server returns text and these allowlisted actions. */
export const assistantTargets={
 'crm-pipeline':{route:'crm',label:'Выбор воронки'},
 'crm-filters':{route:'crm',label:'Фильтры CRM'},
 'crm-card':{route:'crm',label:'Карточка сделки'},
 'global-create':{route:'crm',label:'Создать сделку'},
 'analytics-filters':{route:'analytics',label:'Фильтры аналитики'},
 'analytics-widgets':{route:'analytics',label:'Настроить виджеты'},
 'analytics-ai':{route:'analytics',label:'Анализ с AI'},
 'dashboard-tasks':{route:'dashboard',label:'Задачи Command Center'},
} as const;
export const assistantRoutes=['dashboard','crm','analytics','conversations','customers','tasks','inventory','orders','agents','settings','security','recovery'] as const;
export type AssistantAction={type:'navigate';route:typeof assistantRoutes[number]}|{type:'highlight'|'open';target:keyof typeof assistantTargets};
export type AssistantResponse={text:string;actions:AssistantAction[]};
export function validAssistantAction(value:unknown):value is AssistantAction{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return v.type==='navigate'?assistantRoutes.includes(v.route as typeof assistantRoutes[number]):(v.type==='highlight'||v.type==='open')&&typeof v.target==='string'&&Object.hasOwn(assistantTargets,v.target)&&!(v.type==='open'&&['crm-card','dashboard-tasks','analytics-filters'].includes(v.target));}
export function demoAssistant(text:string):AssistantResponse{
 const q=text.toLowerCase();let target:keyof typeof assistantTargets|undefined;
 if(/воронк/.test(q))target='crm-pipeline';else if(/фильтр/.test(q))target=/аналит/.test(q)?'analytics-filters':'crm-filters';else if(/виджет/.test(q))target='analytics-widgets';else if(/карточк/.test(q))target='crm-card';else if(/созда|добав/.test(q)&&/сделк/.test(q))target='global-create';else if(/задач/.test(q)&&/покаж|выдел|где/.test(q))target='dashboard-tasks';
 if(target)return {text:`Покажу: ${assistantTargets[target].label}.`,actions:[{type:/откро|созда|добав/.test(q)&&!['crm-card','dashboard-tasks','analytics-filters'].includes(target)?'open':'highlight',target}]};
 const destinations:[RegExp,typeof assistantRoutes[number],string][]=[[/аналит/,'analytics','аналитику'],[/диалог|переписк/,'conversations','диалоги'],[/клиент/,'customers','клиентов'],[/склад|товар/,'inventory','склад'],[/задач/,'tasks','задачи'],[/агент/,'agents','агентов'],[/настрой/,'settings','настройки'],[/command|центр/,'dashboard','Command Center'],[/crm|сделк/,'crm','CRM']];const match=destinations.find(([re])=>re.test(q));
 if(match)return {text:`Открываю ${match[2]}.`,actions:[{type:'navigate',route:match[1]}]};
 return {text:'Могу открыть CRM, аналитику, диалоги и другие страницы, показать выбор воронки, фильтры или карточку сделки. Анализ реального бизнеса появится после подключения твоего серверного AI.',actions:[]};
}
