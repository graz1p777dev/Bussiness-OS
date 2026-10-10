import {initialAgents,type Entity} from './data.ts';
import {initialReplyTemplates} from './reply-templates.ts';
import {initialDocuments} from './documents.ts';

export const extensionCategories={agents:'Агенты',plugins:'Плагины',integrations:'Интеграции',pages:'Страницы',themes:'Темы',dashboards:'Дашборды',automations:'Автоматизации','business-packs':'Бизнес-пакеты'} as const;
export type ExtensionCategory=keyof typeof extensionCategories;
export const extensionPermissions={
 'agents.configure':{label:'Конфигурация агентов',detail:'Создать отдельного агента и его инструкции.',pages:['agents'],action:'create'},
 'crm.read':{label:'Чтение клиентов',detail:'Разрешить инструменты чтения карточек и сделок.',pages:['crm','customers','conversations'],action:undefined},
 'inventory.read':{label:'Чтение остатков',detail:'Разрешить инструменты чтения каталога и запасов.',pages:['inventory'],action:undefined},
 'analytics.read':{label:'Агрегаты аналитики',detail:'Разрешить чтение итоговых показателей.',pages:['analytics'],action:undefined},
 'knowledge.read':{label:'База знаний',detail:'Использовать доступные документы в инструкциях агента.',pages:['knowledge'],action:undefined},
 'tasks.read':{label:'Чтение задач',detail:'Разрешить чтение задач команды.',pages:['tasks'],action:undefined},
 'web.search':{label:'Поиск в интернете',detail:'Разрешить поиск при будущем подключении модели.',pages:['agents'],action:'ai'},
 'replyTemplates.write':{label:'Шаблонные ответы',detail:'Добавить шаблоны в диалоги. Отправка клиентам не выполняется.',pages:['conversations'],action:'create'},
 'integrations.configure':{label:'Профиль интеграции',detail:'Добавить неактивный профиль без токенов и внешних запросов.',pages:['integrations'],action:'edit'},
 'documents.create':{label:'Новая страница в документах',detail:'Добавить редактируемую страницу-инструкцию в проводник.',pages:['knowledge'],action:'create'},
 'appearance.configure':{label:'Цветовая палитра',detail:'Применить цвета светлой и тёмной темы. Плотность и режим производительности сохранятся.',pages:['settings'],action:'edit'},
 'analytics.configure':{label:'Рабочий дашборд',detail:'Создать отдельный отчёт из действующих метрик.',pages:['analytics'],action:'edit'},
 'automations.configure':{label:'Шаблон автоматизации',detail:'Сохранить граф в библиотеке и сценарий на паузе.',pages:['automations','builder'],action:'create'},
} as const;
export type ExtensionPermission=keyof typeof extensionPermissions;
export type ExtensionPackage={id:string;name:string;category:ExtensionCategory;author:string;description:string;details:string;version:string;versions:string[];required:ExtensionPermission[];optional:ExtensionPermission[];preset:string;body?:string;accentDark?:string;accentLight?:string;publisherId?:string;releaseNotes:string};
const pack=(id:string,name:string,category:ExtensionCategory,description:string,required:ExtensionPermission[],optional:ExtensionPermission[]=[],preset=id):ExtensionPackage=>({id,name,category,author:'Business OS',description,details:description+' Пакет содержит редактируемую локальную конфигурацию. После установки откройте соответствующий раздел и настройте его под команду.',version:'1.1.0',versions:['1.1.0','1.0.0'],required,optional,preset,releaseNotes:'Уточнены инструкции, подписи и стартовая конфигурация. Данные workspace сохраняются.'});
export const extensionCatalog:ExtensionPackage[]=[
 pack('sales-concierge','Консультант по продажам','agents','Уточняет запрос и готовит короткий ответ для проверки менеджером.',['agents.configure'],['crm.read','inventory.read','knowledge.read']),
 pack('quality-guide','Редактор ответов','agents','Проверяет ясность, тон и следующий шаг в ответе клиенту.',['agents.configure'],['crm.read','knowledge.read']),
 pack('business-analyst','Аналитик бизнеса','agents','Помогает разобрать итоги продаж и приоритеты команды.',['agents.configure'],['analytics.read','tasks.read','web.search']),
 pack('service-replies','Ответы службы заботы','plugins','Три готовых ответа с переменными из карточки клиента.',['replyTemplates.write']),
 pack('delivery-replies','Доставка без уточнений','plugins','Шаблоны для адреса, времени доставки и получения заказа.',['replyTemplates.write']),
 pack('telegram-starter','Telegram · стартовый профиль','integrations','Входящие сообщения и маршрутизация к менеджеру. Подключение остаётся выключенным.',['integrations.configure']),
 pack('whatsapp-starter','WhatsApp · GREEN-API','integrations','Стартовые события и ручное подтверждение ответов. Без хранения секретов.',['integrations.configure']),
 pack('opening-checklist','Открытие магазина','pages','Редактируемая страница с проверками перед началом рабочего дня.',['documents.create']),
 pack('service-playbook','Стандарт заботы о клиенте','pages','Страница-инструкция: ответ, уточнение, решение и следующий контакт.',['documents.create']),
 pack('graphite','Graphite','themes','Спокойная графитовая палитра для светлой и тёмной темы.',['appearance.configure']),
 pack('sage','Sage','themes','Мягкий зелёный акцент и нейтральные рабочие поверхности.',['appearance.configure']),
 pack('sales-desk','Продажи · рабочий стол','dashboards','Выручка, конверсия, каналы и динамика продаж в одном отчёте.',['analytics.configure']),
 pack('team-pulse','Команда · пульс','dashboards','Нагрузка команды, скорость ответа и продажи сотрудников.',['analytics.configure']),
 pack('gentle-followup','Деликатный повторный контакт','automations','Пауза 24 часа и черновик ответа по данным клиента.',['automations.configure','crm.read']),
 pack('request-summary','Резюме обращения','automations','Карточка клиента → краткий черновик для менеджера.',['automations.configure','crm.read']),
 pack('retail-kit','Магазин · готовый набор','business-packs','Консультант, рабочий отчёт, сценарий повторного контакта и инструкция.',['agents.configure','analytics.configure','automations.configure','documents.create','crm.read'],['replyTemplates.write','inventory.read']),
];
export type EffectStore='agents'|'agent-settings'|'workflow-library-v1'|'business-modules-v1'|'analytics-boards-v2'|'appearance-v2'|'reply-templates-v1'|'channel-config-v2'|'documents-explorer-v1';
export type AppliedEffect={store:EffectStore;kind:'array'|'map'|'value'|'automation';slot:string;before:unknown;after:unknown};
export type InstalledExtension={id:string;packageId:string;name:string;category:ExtensionCategory;author:string;version:string;actorId:string;grants:ExtensionPermission[];installedAt:string;updatedAt:string;effects:AppliedEffect[]};
export type DeveloperProfile={displayName:string;accountCreatedAt:string;identity:'not-declared'|'declared';subscription:'inactive'|'active';agreement:boolean};
export type PublicationStatus='draft'|'review'|'security'|'published'|'changes-requested'|'withdrawn';
export type ExtensionSubmission={id:string;packageId:string;actorId:string;basePackageId:string;name:string;description:string;version:string;body:string;accentDark:string;accentLight:string;status:PublicationStatus;createdAt:string;updatedAt:string;reviewNote:string;securityCheckedAt?:string;publishedAt?:string};
export type ExtensionEvent={id:string;actorId:string;at:string;message:string};
export type ExtensionsState={version:1;installs:InstalledExtension[];publications:ExtensionSubmission[];developers:Record<string,DeveloperProfile>;events:ExtensionEvent[]};
export const initialExtensionsState:ExtensionsState={version:1,installs:[],publications:[],developers:{},events:[]};
export type ExtensionAccess={create:boolean;edit:boolean;remove:boolean;review:boolean;scopes:ExtensionPermission[]};
export type ExtensionPlan={state:ExtensionsState;workspace:Record<string,unknown>;warnings:string[]};
export const extensionWorkspaceDefaults:Partial<Record<EffectStore,unknown>>={agents:initialAgents,'agent-settings':{},'workflow-library-v1':[],'reply-templates-v1':initialReplyTemplates,'channel-config-v2':{},'documents-explorer-v1':initialDocuments};
const effectStores:EffectStore[]=['agents','agent-settings','workflow-library-v1','business-modules-v1','analytics-boards-v2','appearance-v2','reply-templates-v1','channel-config-v2','documents-explorer-v1'];
const effectPermission:Record<EffectStore,ExtensionPermission>={agents:'agents.configure','agent-settings':'agents.configure','workflow-library-v1':'automations.configure','business-modules-v1':'automations.configure','analytics-boards-v2':'analytics.configure','appearance-v2':'appearance.configure','reply-templates-v1':'replyTemplates.write','channel-config-v2':'integrations.configure','documents-explorer-v1':'documents.create'};
const permissionIds=Object.keys(extensionPermissions) as ExtensionPermission[];
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const validText=(value:unknown,max=500)=>typeof value==='string'&&value.length<=max;
const validId=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9._:-]{1,150}$/.test(value);
const isDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const versionPattern=/^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
function same(a:unknown,b:unknown):boolean{if(Object.is(a,b))return true;if(object(a)&&object(b)&&validAppearance(a)&&validAppearance(b)&&(a.fontFamily===undefined||b.fontFamily===undefined))return same({...a,fontFamily:a.fontFamily??'system'},{...b,fontFamily:b.fontFamily??'system'});if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));}
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message)}
function guard(access:ExtensionAccess,action:'create'|'edit'|'remove'|'review'){assert(access[action],'Действие запрещено ролью сотрудника.')}
function event(state:ExtensionsState,actorId:string,at:string,message:string):ExtensionsState{return {...state,events:[{id:at+'-'+state.events.length,actorId,at,message},...state.events].slice(0,100)}}
function safeObject(value:unknown,depth=0):boolean{
 if(depth>20)return false;
 if(value===undefined||value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return true;
 if(Array.isArray(value))return value.length<=5000&&value.every(item=>safeObject(item,depth+1));
 return object(value)&&Object.keys(value).every(key=>!['__proto__','prototype','constructor'].includes(key)&&safeObject(value[key],depth+1));
}
const keysOnly=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every(key=>keys.includes(key));
const hex=(value:unknown)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function validAppearance(value:unknown){
 if(!object(value)||!keysOnly(value,['custom','palettes','density','fontFamily','fontSize','radius','motion','lowPower'])||(value.fontFamily!==undefined&&!['system','humanist','classic'].includes(String(value.fontFamily)))||typeof value.custom!=='boolean'||typeof value.motion!=='boolean'||typeof value.lowPower!=='boolean'||!['comfortable','compact'].includes(String(value.density))||typeof value.fontSize!=='number'||value.fontSize<12||value.fontSize>18||typeof value.radius!=='number'||value.radius<0||value.radius>18||!object(value.palettes))return false;
 const colors=['bg','panel','sidebar','hover','border','text','muted','accent'],palettes=value.palettes;
 return keysOnly(palettes,['dark','light'])&&['dark','light'].every(mode=>{const palette=palettes[mode];return object(palette)&&keysOnly(palette,colors)&&colors.every(key=>hex(palette[key]))});
}
function validEffect(effect:unknown,packageId:string){
 if(!object(effect)||!keysOnly(effect,['store','kind','slot','before','after'])||!effectStores.includes(effect.store as EffectStore)||!['array','map','value','automation'].includes(String(effect.kind))||!validText(effect.slot)||!safeObject(effect.before)||!safeObject(effect.after))return false;
 const prefix='ext:'+packageId+':';
 if(effect.store==='appearance-v2')return effect.kind==='value'&&effect.slot==='appearance'&&validAppearance(effect.before)&&validAppearance(effect.after);
 if(effect.store==='channel-config-v2'){const value=effect.after;return effect.kind==='map'&&['Telegram','GREEN-API'].includes(String(effect.slot))&&effect.before===null&&object(value)&&keysOnly(value,['enabled','values','events','updated'])&&value.enabled===false&&isDate(value.updated)&&Array.isArray(value.events)&&value.events.every(item=>['Входящие сообщения','Статусы доставки'].includes(item))&&object(value.values)&&Object.entries(value.values).every(([key,text])=>['routing','retry','hours','apiUrl'].includes(key)&&validText(text,250));}
 if(effect.store==='analytics-boards-v2')return effect.kind==='map'&&String(effect.slot).startsWith('Store · '+packageId+' · ')&&effect.before===null&&Array.isArray(effect.after)&&effect.after.length<=20&&effect.after.every(id=>['revenue','conversion','check','revenueTrend','channelRevenue','outcomes','employeeRevenue','employeeTable','workload','responseChannels'].includes(id));
 if(!String(effect.slot).startsWith(prefix)||effect.before!==null)return false;
 const value=effect.after;if(!object(value))return false;
 if(effect.store==='agent-settings')return effect.kind==='map'&&Object.entries(value).every(([key,text])=>['prompt','model','temperature','tokens','approval','tools','storePermissions'].includes(key)&&validText(text,20000));
 if(value.id!==effect.slot||!validText(value.name,500))return false;
 if(effect.store==='agents')return effect.kind==='array'&&keysOnly(value,['id','name','value','status','channel','owner','note'])&&value.status==='Пауза'&&value.value===0&&validText(value.channel)&&validText(value.owner)&&validText(value.note,12000);
 if(effect.store==='reply-templates-v1')return effect.kind==='array'&&keysOnly(value,['id','name','body'])&&validText(value.body,12000);
 if(effect.store==='documents-explorer-v1')return effect.kind==='array'&&keysOnly(value,['id','name','parent','kind','mime','modified','text'])&&value.parent===null&&value.kind==='file'&&value.mime==='text/markdown'&&isDate(value.modified)&&validText(value.text,14000);
 if(effect.store==='business-modules-v1')return effect.kind==='automation'&&keysOnly(value,['id','name','value','status','channel','owner','note','workflowId'])&&value.value===0&&value.status==='Пауза'&&validText(value.channel)&&validText(value.owner)&&validText(value.note)&&value.workflowId===effect.slot;
 if(effect.store==='workflow-library-v1')return effect.kind==='array'&&keysOnly(value,['id','name','date','nodes','edges'])&&isDate(value.date)&&Array.isArray(value.nodes)&&value.nodes.length<=10&&value.nodes.every(node=>object(node)&&keysOnly(node,['id','type','position','data'])&&typeof node.id==='string'&&node.id.startsWith(prefix)&&node.type==='agent'&&object(node.position)&&keysOnly(node.position,['x','y'])&&typeof node.position.x==='number'&&typeof node.position.y==='number'&&object(node.data)&&keysOnly(node.data,['kind','label','source','event','minutes','channel','template'])&&['Trigger','Delay','Message'].includes(String(node.data.kind))&&Object.values(node.data).every(part=>validText(part,12000)||typeof part==='number'&&part>=0&&part<=10080))&&Array.isArray(value.edges)&&value.edges.length<=10&&value.edges.every(edge=>object(edge)&&keysOnly(edge,['id','source','target'])&&Object.values(edge).every(part=>typeof part==='string'&&part.startsWith(prefix)));
 return false;
}
/** Data-only Store state. Imports never execute installations or embedded scripts. */
export function parseExtensionsState(value:unknown):ExtensionsState{
 assert(object(value)&&keysOnly(value,['version','installs','publications','developers','events'])&&value.version===1&&Array.isArray(value.installs)&&Array.isArray(value.publications)&&object(value.developers)&&Array.isArray(value.events)&&safeObject(value),'Некорректный документ Store.');
 assert(JSON.stringify(value).length<=2_000_000,'Документ Store слишком большой.');
 for(const item of value.installs){assert(object(item)&&keysOnly(item,['id','packageId','name','category','author','version','actorId','grants','installedAt','updatedAt','effects'])&&validId(item.id)&&validId(item.packageId)&&validText(item.name)&&typeof item.category==='string'&&item.category in extensionCategories&&validText(item.author)&&versionPattern.test(String(item.version))&&validId(item.actorId)&&Array.isArray(item.grants)&&item.grants.every(scope=>permissionIds.includes(scope))&&isDate(item.installedAt)&&isDate(item.updatedAt)&&Array.isArray(item.effects)&&item.effects.every(effect=>validEffect(effect,item.packageId as string)&&(item.grants as ExtensionPermission[]).includes(effectPermission[(effect as AppliedEffect).store])),'Некорректная установка Store.');}
 for(const [id,profile] of Object.entries(value.developers)){assert(validId(id)&&object(profile)&&keysOnly(profile,['displayName','accountCreatedAt','identity','subscription','agreement'])&&validText(profile.displayName,120)&&isDate(profile.accountCreatedAt)&&['not-declared','declared'].includes(String(profile.identity))&&['inactive','active'].includes(String(profile.subscription))&&typeof profile.agreement==='boolean','Некорректный локальный профиль разработчика.');}
 for(const item of value.publications){assert(object(item)&&keysOnly(item,['id','packageId','actorId','basePackageId','name','description','version','body','accentDark','accentLight','status','createdAt','updatedAt','reviewNote','securityCheckedAt','publishedAt'])&&validId(item.id)&&validId(item.packageId)&&String(item.packageId).startsWith('community:'+item.actorId+':')&&validId(item.actorId)&&extensionCatalog.some(base=>base.id===item.basePackageId)&&validText(item.name,100)&&validText(item.description,1200)&&versionPattern.test(String(item.version))&&validText(item.body,12000)&&/^#[a-f\d]{6}$/i.test(String(item.accentDark))&&/^#[a-f\d]{6}$/i.test(String(item.accentLight))&&['draft','review','security','published','changes-requested','withdrawn'].includes(String(item.status))&&isDate(item.createdAt)&&isDate(item.updatedAt)&&validText(item.reviewNote,1200)&&(!item.securityCheckedAt||isDate(item.securityCheckedAt))&&(!item.publishedAt||isDate(item.publishedAt))&&(item.status!=='published'||Boolean(item.securityCheckedAt&&item.publishedAt)),'Некорректная заявка разработчика.');}
 for(const item of value.events)assert(object(item)&&keysOnly(item,['id','actorId','at','message'])&&validText(item.id,200)&&validId(item.actorId)&&isDate(item.at)&&validText(item.message,1500),'Некорректный журнал Store.');
 assert(new Set(value.installs.map(item=>item.packageId)).size===value.installs.length,'Расширение установлено несколько раз.');
 assert(new Set(value.publications.map(item=>item.id)).size===value.publications.length,'Заявка повторяется.');
 return structuredClone(value) as ExtensionsState;
}
export function compareVersions(a:string,b:string){const left=a.split('.').map(Number),right=b.split('.').map(Number);return left[0]-right[0]||left[1]-right[1]||left[2]-right[2]}
export function packagesForState(state:ExtensionsState):ExtensionPackage[]{
 const published=state.publications.filter(item=>item.status==='published');
 const ids=[...new Set(published.map(item=>item.packageId))];
 return [...extensionCatalog,...ids.map(id=>{const releases=published.filter(item=>item.packageId===id).sort((a,b)=>compareVersions(b.version,a.version));const item=releases[0],base=extensionCatalog.find(base=>base.id===item.basePackageId)!;return {...base,id,name:item.name,description:item.description,details:item.description,version:item.version,versions:releases.map(release=>release.version),author:state.developers[item.actorId]?.displayName||'Локальный разработчик',publisherId:item.actorId,body:item.body||base.body,accentDark:item.accentDark,accentLight:item.accentLight,releaseNotes:'Локальная публикация '+item.version+'. Проверки реального Store не выполнялись.'}})];
}
export function developerEligibility(profile:DeveloperProfile|undefined,now:string){
 const age=profile?Math.floor((Date.parse(now)-Date.parse(profile.accountCreatedAt))/86400000):-1;
 return [{id:'profile',label:'Имя разработчика',ok:Boolean(profile?.displayName.trim())},{id:'identity',label:'Личность заявлена в локальном профиле',ok:profile?.identity==='declared'},{id:'subscription',label:'Тестовая подписка активна',ok:profile?.subscription==='active'},{id:'age',label:'Аккаунту не менее 7 дней',ok:Number.isFinite(age)&&age>=7},{id:'agreement',label:'Правила публикации приняты',ok:profile?.agreement===true}];
}
export function saveDeveloperProfile(state:ExtensionsState,actorId:string,profile:DeveloperProfile,now:string,access:ExtensionAccess){guard(access,'edit');assert(validText(profile.displayName,120)&&profile.displayName.trim(),'Укажите имя разработчика.');assert(isDate(profile.accountCreatedAt)&&Date.parse(profile.accountCreatedAt)<=Date.parse(now),'Дата аккаунта должна быть в прошлом.');const next={...state,developers:{...state.developers,[actorId]:{...profile,displayName:profile.displayName.trim()}}};parseExtensionsState(next);return event(next,actorId,now,'Обновлён локальный профиль разработчика.');}
export function saveExtensionDraft(state:ExtensionsState,draft:ExtensionSubmission,actorId:string,now:string,access:ExtensionAccess){
 const existing=state.publications.find(item=>item.id===draft.id);guard(access,existing?'edit':'create');assert(!existing||existing.actorId===actorId,'Можно редактировать только свои пакеты.');assert(draft.actorId===actorId,'Автор пакета не совпадает с аккаунтом.');assert(!existing||['draft','changes-requested'].includes(existing.status),'Создайте новую версию опубликованного пакета.');assert(!state.publications.some(item=>item.packageId===draft.packageId&&item.basePackageId!==draft.basePackageId),'Новая версия должна сохранять основу пакета.');assert(!state.publications.some(item=>item.id!==draft.id&&item.packageId===draft.packageId&&['published','withdrawn'].includes(item.status)&&compareVersions(draft.version,item.version)<=0),'Версия должна быть выше опубликованных ранее.');assert(draft.name.trim()&&draft.description.trim(),'Добавьте название и описание.');assert(draft.packageId.startsWith('community:'+actorId+':'),'Некорректный идентификатор пакета разработчика.');assert(!state.publications.some(item=>item.packageId===draft.packageId&&item.actorId!==actorId),'Пакет принадлежит другому разработчику.');assert(!state.publications.some(item=>item.id!==draft.id&&item.packageId===draft.packageId&&item.version===draft.version),'Такая версия пакета уже существует.');
 const item={...draft,name:draft.name.trim(),description:draft.description.trim(),status:'draft' as const,reviewNote:'',securityCheckedAt:undefined,publishedAt:undefined,createdAt:existing?.createdAt||now,updatedAt:now};const next={...state,publications:existing?state.publications.map(row=>row.id===item.id?item:row):[item,...state.publications]};parseExtensionsState(next);return event(next,actorId,now,'Сохранён черновик «'+item.name+'».');
}
export function transitionPublication(state:ExtensionsState,id:string,action:'submit'|'review'|'security'|'publish'|'return'|'withdraw',actorId:string,now:string,access:ExtensionAccess,note=''){
 const item=state.publications.find(item=>item.id===id);assert(item,'Пакет не найден.');
 if(['review','security','publish','return'].includes(action))guard(access,'review');else{guard(access,action==='withdraw'?'remove':'edit');assert(item.actorId===actorId,'Это пакет другого разработчика.');}
 let updated={...item,updatedAt:now};
 if(action==='submit'){assert(['draft','changes-requested'].includes(item.status),'Заявка уже отправлена.');assert(developerEligibility(state.developers[item.actorId],now).every(check=>check.ok),'Заполните условия допуска разработчика.');updated={...updated,status:'review',reviewNote:'Заявка отправлена на локальную проверку.',securityCheckedAt:undefined};}
 if(action==='review'){assert(item.status==='review','Сначала отправьте заявку.');updated={...updated,status:'security',reviewNote:'Локальная модерация пройдена. Ожидается проверка структуры.'};}
 if(action==='security'){assert(item.status==='security','Пакет ещё не на проверке структуры.');assert(!/<script\b|javascript:|\beval\s*\(/i.test(item.body),'Исполняемый код не принимается. Вставьте только текст инструкций.');updated={...updated,securityCheckedAt:now,reviewNote:'Структура локального пакета проверена. Проверка реальной инфраструктуры не выполнялась.'};}
 if(action==='publish'){assert(item.status==='security'&&item.securityCheckedAt,'Пройдите локальную проверку структуры.');assert(developerEligibility(state.developers[item.actorId],now).every(check=>check.ok),'Условия допуска разработчика больше не выполнены.');updated={...updated,status:'published',publishedAt:now,reviewNote:'Опубликовано только в каталоге этого браузера.'};}
 if(action==='return'){assert(['review','security'].includes(item.status),'Пакет не находится на проверке.');assert(note.trim(),'Укажите, что нужно исправить.');updated={...updated,status:'changes-requested',reviewNote:note.trim(),securityCheckedAt:undefined};}
 if(action==='withdraw'){assert(item.status==='published','Отозвать можно опубликованный пакет.');updated={...updated,status:'withdrawn',reviewNote:'Снят с локальной публикации. Установленные копии сохраняются.'};}
 const next={...state,publications:state.publications.map(row=>row.id===id?updated:row)};parseExtensionsState(next);return event(next,actorId,now,'Пакет «'+item.name+'»: '+updated.reviewNote);
}
function currentEffect(workspace:Record<string,unknown>,effect:AppliedEffect){const store=workspace[effect.store];if(effect.kind==='value')return store??null;if(effect.kind==='map')return object(store)?store[effect.slot]??null:null;const rows=effect.kind==='automation'&&object(store)?store.automations:store;return Array.isArray(rows)?rows.find(row=>object(row)&&row.id===effect.slot)??null:null;}
function putEffect(workspace:Record<string,unknown>,effect:AppliedEffect,value:unknown){
 value=structuredClone(value);
 if(effect.kind==='value'){workspace[effect.store]=value;return}
 const stored=workspace[effect.store],record=object(stored)?stored:{};
 if(effect.kind==='map'){const next={...record};if(value===null)delete next[effect.slot];else next[effect.slot]=value;workspace[effect.store]=next;return}
 const source=effect.kind==='automation'?record.automations:stored;const rows=Array.isArray(source)?source:[];const next=rows.filter(row=>!object(row)||row.id!==effect.slot);if(value!==null)next.push(value);workspace[effect.store]=effect.kind==='automation'?{...record,automations:next}:next;
}
function packageEffects(pkg:ExtensionPackage,grants:ExtensionPermission[],now:string,workspace:Record<string,unknown>):AppliedEffect[]{
 const effects:AppliedEffect[]=[],prefix='ext:'+pkg.id+':';
 const add=(store:EffectStore,kind:AppliedEffect['kind'],slot:string,after:unknown)=>effects.push({store,kind,slot,before:currentEffect(workspace,{store,kind,slot,before:null,after}),after});
 const agent=()=>{const id=prefix+'agent';add('agents','array',id,{id,name:pkg.name,value:0,status:'Пауза',channel:'Chat Model',owner:'Workspace',note:pkg.body||'Уточняй задачу клиента. Используй только разрешённые источники. Готовь ответ для проверки человеком. Версия '+pkg.version+'.'} satisfies Entity);add('agent-settings','map',id,{prompt:pkg.body||'Действуй в рамках назначенной задачи. Не выдумывай сведения, показывай использованные источники и проси подтверждение перед действием.',temperature:'0.4',tokens:'4096',approval:'on',tools:grants.filter(scope=>['crm.read','inventory.read','analytics.read','tasks.read','web.search','knowledge.read'].includes(scope)).join('\n'),storePermissions:JSON.stringify(grants)});};
 const replies=()=>{['Уточнить запрос','Предложить следующий шаг','Проверить результат'].forEach((name,index)=>add('reply-templates-v1','array',prefix+'reply-'+index,{id:prefix+'reply-'+index,name:pkg.name+' · '+name,body:pkg.body||[`Здравствуйте, {{имя}}! Спасибо за обращение. Уточните, пожалуйста, что для вас сейчас важнее всего?`,`{{имя}}, ваш менеджер — {{ответственный}}. По сделке {{id}} следующий этап — {{этап}}. Удобно обсудить детали?`,`Здравствуйте, {{имя}}! Всё ли получилось с вашим заказом? Если остались вопросы, я помогу.`][index]}));};
 const page=()=>add('documents-explorer-v1','array',prefix+'page',{id:prefix+'page',parent:null,name:pkg.name+'.md',kind:'file',mime:'text/markdown',modified:now,text:pkg.body||'# '+pkg.name+'\n\n1. Проверьте задачи и сообщения без ответа.\n2. Уточните остатки важных товаров.\n3. Назначьте ответственных за обращения.\n4. Зафиксируйте следующий шаг для каждого клиента.\n\nЭта страница редактируется в проводнике документов.'});
 const dashboard=()=>{assert(object(workspace['analytics-boards-v2']),'Сначала откройте раздел аналитики, чтобы создать рабочие отчёты.');add('analytics-boards-v2','map','Store · '+pkg.id+' · '+pkg.name,pkg.preset==='team-pulse'?['employeeRevenue','employeeTable','workload','responseChannels']:['revenue','conversion','check','revenueTrend','channelRevenue','outcomes']);};
 const workflow=()=>{assert(object(workspace['business-modules-v1']),'Конфигурация автоматизаций не загружена. Откройте раздел «Автоматизации».');const id=prefix+'workflow';const steps=[{kind:'Trigger',label:'Обращение клиента',source:'Все',event:'message.received'},...(pkg.preset==='request-summary'?[]:[{kind:'Delay',label:'Пауза 24 часа',minutes:1440}]),{kind:'Message',label:'Подготовить ответ',channel:pkg.preset==='request-summary'?'Менеджер':'Канал клиента',template:pkg.body||'Здравствуйте, {{имя}}! Возвращаюсь к нашему разговору. Остались ли вопросы по вашему запросу?'}];add('workflow-library-v1','array',id,{id,name:pkg.name,date:now,nodes:steps.map((data,index)=>({id:id+'-'+index,type:'agent',position:{x:70+index*310,y:140},data})),edges:steps.slice(1).map((_,index)=>({id:id+'-edge-'+index,source:id+'-'+index,target:id+'-'+(index+1)}))});add('business-modules-v1','automation',id,{id,name:pkg.name,value:0,status:'Пауза',channel:'message.received',owner:'Workspace',note:'Шаблон Store '+pkg.version+'. Проверьте на локальных данных перед применением.',workflowId:id});};
 if(pkg.category==='agents')agent();
 if(pkg.category==='plugins')replies();
 if(pkg.category==='pages')page();
 if(pkg.category==='dashboards')dashboard();
 if(pkg.category==='automations')workflow();
 if(pkg.category==='integrations')add('channel-config-v2','map',pkg.preset==='whatsapp-starter'?'GREEN-API':'Telegram',{enabled:false,values:{routing:'AI с подтверждением',retry:'3',hours:'09:00–20:00',...(pkg.preset==='whatsapp-starter'?{apiUrl:'https://api.green-api.com'}:{})},events:['Входящие сообщения','Статусы доставки'],updated:now});
 if(pkg.category==='themes'){
  const current=workspace['appearance-v2'];assert(object(current)&&object(current.palettes),'Конфигурация оформления ещё не загружена. Откройте настройки.');const palettes=structuredClone(current.palettes) as Record<string,Record<string,string>>;
  palettes.dark={...palettes.dark,accent:pkg.accentDark||(pkg.preset==='sage'?'#81b29a':'#b7c1d1')};palettes.light={...palettes.light,accent:pkg.accentLight||(pkg.preset==='sage'?'#39765b':'#45536b')};add('appearance-v2','value','appearance',{...current,custom:true,palettes});
 }
 if(pkg.category==='business-packs'){agent();page();dashboard();workflow();if(grants.includes('replyTemplates.write'))replies();}
 return effects;
}
export function planExtensionInstall(state:ExtensionsState,pkg:ExtensionPackage,version:string,grants:ExtensionPermission[],actorId:string,now:string,access:ExtensionAccess,source:Record<string,unknown>):ExtensionPlan{
 const canonical=packagesForState(state).find(item=>item.id===pkg.id);assert(canonical,'Пакет недоступен в каталоге.');pkg=canonical;const release=state.publications.find(item=>item.packageId===pkg.id&&item.version===version&&item.status==='published');if(release)pkg={...pkg,body:release.body||undefined,accentDark:release.accentDark,accentLight:release.accentLight};
 const previous=state.installs.find(item=>item.packageId===pkg.id);guard(access,previous?'edit':'create');assert(!previous||previous.grants.filter(scope=>!scope.endsWith('.read')&&scope!=='web.search').every(scope=>access.scopes.includes(scope)),'Нет прав на обновление ресурсов расширения.');assert(pkg.versions.includes(version),'Версия пакета недоступна.');assert(!previous||compareVersions(version,previous.version)>0,'Установлена эта или более новая версия.');assert(pkg.required.every(scope=>grants.includes(scope)),'Подтвердите обязательные разрешения.');assert(grants.every(scope=>[...pkg.required,...pkg.optional].includes(scope)&&access.scopes.includes(scope)),'Пакет запрашивает недоступное разрешение.');assert(new Set(grants).size===grants.length,'Разрешения повторяются.');
 const workspace=structuredClone(source),warnings:string[]=[];
 for(const effect of previous?.effects||[]){assert(same(currentEffect(workspace,effect),effect.after),'Вы изменили ресурс «'+previous!.name+'» после установки. Сохраните свою копию перед обновлением.');putEffect(workspace,effect,effect.before);}
 const effects=packageEffects({...pkg,version},grants,now,workspace);
 for(const effect of effects){if(effect.kind!=='value')assert(effect.before===null,'Ресурс «'+effect.slot+'» уже существует. Пакет не перезаписывает вашу конфигурацию.');putEffect(workspace,effect,effect.after);}
 const installed:InstalledExtension={id:previous?.id||'install:'+pkg.id,packageId:pkg.id,name:pkg.name,category:pkg.category,author:pkg.author,version,actorId,grants:[...grants],installedAt:previous?.installedAt||now,updatedAt:now,effects};
 const next=event({...state,installs:[...state.installs.filter(item=>item.packageId!==pkg.id),installed]},actorId,now,(previous?'Обновлено':'Установлено')+' «'+pkg.name+'» '+version+'.');parseExtensionsState(next);
 const changed=Object.fromEntries(effectStores.filter(key=>!same(source[key],workspace[key])).map(key=>[key,workspace[key]]));return {state:next,workspace:changed,warnings};
}
export function planExtensionRemoval(state:ExtensionsState,packageId:string,actorId:string,now:string,access:ExtensionAccess,source:Record<string,unknown>):ExtensionPlan{
 guard(access,'remove');const installed=state.installs.find(item=>item.packageId===packageId);assert(installed,'Расширение не установлено.');assert(installed.grants.filter(scope=>!scope.endsWith('.read')&&scope!=='web.search').every(scope=>access.scopes.includes(scope)),'Нет прав на изменение ресурсов расширения.');
 const workspace=structuredClone(source),warnings:string[]=[];
 const changedGroups=new Set(installed.effects.filter(effect=>['agents','agent-settings','workflow-library-v1','business-modules-v1'].includes(effect.store)&&!same(currentEffect(workspace,effect),effect.after)).map(effect=>effect.slot));
 for(const effect of [...installed.effects].reverse()){if(changedGroups.has(effect.slot)||!same(currentEffect(workspace,effect),effect.after)){warnings.push('Изменённый ресурс «'+effect.slot+'» сохранён.');continue}putEffect(workspace,effect,effect.before);}
 const next=event({...state,installs:state.installs.filter(item=>item.packageId!==packageId)},actorId,now,'Удалено расширение «'+installed.name+'».');const changed=Object.fromEntries(effectStores.filter(key=>!same(source[key],workspace[key])).map(key=>[key,workspace[key]]));return {state:next,workspace:changed,warnings};
}
/** Storage facade is canonical-settings aware. Restore original bytes on any failed write. */
export function commitExtensionPlan(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,plan:ExtensionPlan){
 const entries={...plan.workspace,'extension-store-v1':plan.state};const before=Object.fromEntries(Object.keys(entries).map(key=>[key,storage.getItem('life-'+key)]));const written:string[]=[];
 try{for(const [key,value] of Object.entries(entries)){storage.setItem('life-'+key,JSON.stringify(value));written.push(key)}}catch(error){for(const key of written.reverse()){if(before[key]===null)storage.removeItem('life-'+key);else storage.setItem('life-'+key,before[key]!)}throw error}
}
