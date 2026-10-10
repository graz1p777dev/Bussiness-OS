'use client';
import {BotReplyApprovalSettings} from '../../components/os/BotReplyApproval';
import PromptManager from '../PromptManager';
import {ReplyAssistantSettings} from '../../components/os/ConversationAssistant';
import Select from '../../components/os/Select';
import {useState,type Dispatch,type SetStateAction,type ReactNode,type CSSProperties} from 'react';
import {Palette as PaletteIcon,Search,RotateCcw,FileJson,ShieldCheck,Check,SlidersHorizontal,ChevronDown,Monitor,X} from 'lucide-react';
import Link from 'next/link';
import {useStored} from '../../lib/os/storage';
import {defaultAppearance,defaultPalettes,type Palette} from '../../lib/os/appearance';
import SettingsDocumentPanel from './SettingsDocumentPanel';
import SystemAISettings from '../SystemAISettings';
import AgentConfiguration from '../AgentConfiguration';
import {settingsAccess,settingsSectionPaths} from '../../lib/os/settings-document';
import {settingsCatalog,settingDefaults,type SettingField} from './catalog';
import ListSetting from './ListSetting';
import {hasAccess,initialEmployees,initialRoles} from '../../lib/os/team';
import StageEditor from './StageEditor';
import ColorPicker from './ColorPicker';
import NeutralArt from '../../components/os/NeutralArt';
import {Modal} from '../../components/os/ui';

type Props={actorId?:string;canReadClients?:boolean;canEdit?:boolean;theme:string;setTheme:(s:string)=>void;accent:string;setAccent:(s:string)=>void;accents:Record<string,string>;collapsed:boolean;setCollapsed:(v:boolean)=>void;appearance:typeof defaultAppearance;setAppearance:Dispatch<SetStateAction<typeof defaultAppearance>>;notify:(s:string)=>void;audit:(s:string)=>void;go:(s:string)=>void;setWorkspace:(s:string)=>void};
const tokenNames:Record<keyof Palette,string>={bg:'Фон приложения',panel:'Карточки и окна',sidebar:'Боковое меню',hover:'При наведении',border:'Границы',text:'Основной текст',muted:'Подписи',accent:'Акцентный цвет'};
const sectionGroups=[
 {name:'Для вас',sections:['Внешний вид','Уведомления','Безопасность']},
 {name:'Работа компании',sections:['Компания','CRM и воронки','Диалоги','Товары и остатки','Касса и продажи','Филиалы и склады','Команда и зарплаты','Роли и права']},
 {name:'ИИ и отчёты',sections:['AI и модели','Автоматизации','База знаний','Аналитика','Финансы','Маркетинг']},
 {name:'Система',sections:['System AI','Сервер и мониторинг','Данные и приватность','API и разработчик','Конфигурация']}
];
const sectionLabels:Record<string,string>={'AI и модели':'ИИ и боты','API и разработчик':'Для разработчика','Конфигурация':'Общая конфигурация'};
const primaryFields:Record<string,string[]>={
 'Компания':['company','phone','email','address','currency','workdays','open','close'],
 'Филиалы и склады':['defaultBranch','defaultWarehouse','branches','warehouses'],
 'CRM и воронки':['assignment','leadSla','customFields','duplicates','autoDeal'],
 'Диалоги':['inboxMode','handoff','greeting','afterHours','stopOnHuman'],
 'Товары и остатки':['lowStock','negativeStock','reserveOnOrder','reserveHours','units'],
 'Касса и продажи':['paymentMethods','maxDiscount','shiftRequired','receiptHeader','receiptFooter'],
 'Команда и зарплаты':['departments','baseSalary','salesBonus','salaryDay','workingWeek'],
 'Роли и права':['newRole'],
 'AI и модели':['provider','model','systemPrompt','budget','approval'],
 'Автоматизации':['followupHours','quietHours','failureNotify','dryRun'],
 'База знаний':['fileTypes','documentSize','autoIndex','sourceAccess'],
 'Финансы':['accounts','expenseCategories','accounting','includeRefunds'],
 'Маркетинг':['attribution','utmSource','dailyMessages','consent'],
 'Аналитика':['period','revenueGoal','conversionGoal','averageCheckGoal','comparePrevious'],
 'Уведомления':['notifyLead','notifyAssigned','notifyStock','notifyPayment','notifyAI','notifyServer','notifyBrowser','digest'],
 'Сервер и мониторинг':['serverName','refreshSeconds','cpuAlert','ramAlert','diskAlert','watchdog'],
 'API и разработчик':['apiBase','sandbox','eventTypes','allowedOrigins'],
 'Данные и приватность':['historyDays','maskPhone','maskEmail','exportConsent','backupConfig']
};
const appearanceSearch='тема цвет палитра фон акцент текст шрифт размер плотность скругление анимации меню слабый компьютер производительность';
function SettingContainer({grouped,className,children}:{grouped:boolean;className:string;children:ReactNode}){return grouped?<div className={'setting-group '+className}>{children}</div>:<label className={className}>{children}</label>}
function ChoiceButtons<T extends string|number>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:{value:T;label:string;detail?:string}[];onChange:(value:T)=>void;disabled?:boolean}){
 return <div className="setting-options" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} disabled={disabled} aria-pressed={value===option.value} className={value===option.value?'selected':''} onClick={()=>onChange(option.value)}><span>{option.label}</span>{option.detail&&<small>{option.detail}</small>}{value===option.value&&<Check size={14}/>}</button>)}</div>;
}
export default function Settings(props:Props){
 const [employees]=useStored('team-employees-v3',initialEmployees),[previewId]=useStored('team-preview-v3','');
 const [section,setSection]=useState('Внешний вид');
 const [roles]=useStored('team-roles-v3',initialRoles);
 const actor=employees.find(employee=>employee.id===(props.actorId||previewId||'owner-user')),access=settingsAccess(actor,roles,props.canEdit??true),sectionPath=settingsSectionPaths[section];
 const canEdit=(props.canEdit??true)&&(!sectionPath||access.canWrite(...sectionPath));
 const p:Props={...props,canEdit,setTheme:value=>{if(canEdit)props.setTheme(value)},setAccent:value=>{if(canEdit)props.setAccent(value)},setCollapsed:value=>{if(canEdit)props.setCollapsed(value)},setWorkspace:value=>{if(canEdit)props.setWorkspace(value)},setAppearance:value=>{if(canEdit)props.setAppearance(value)}};
 const [promptOpen,setPromptOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [mode,setMode]=useState<'dark'|'light'>(p.theme==='Light'?'light':'dark');
 const [picker,setPicker]=useState<keyof Palette|null>(null);
 const [values,storeValues]=useStored('settings-deep-v2',settingDefaults,value=>({...settingDefaults,...value}));
 const [reset,setReset]=useState(false);
 const setValues:typeof storeValues=update=>{if(canEdit)storeValues(update)};
 const config=settingsCatalog.find(s=>s.name===section);
 const set=(key:string,value:string|number|boolean)=>{
  if(!canEdit)return;
  setValues(v=>{const next={...v,[key]:value};const dependent=key==='branches'?'defaultBranch':key==='warehouses'?'defaultWarehouse':null;if(dependent){const choices=String(value).split('\n').filter(Boolean);if(!choices.includes(String(next[dependent])))next[dependent]=choices[0]||''}return next});
  if(key==='company')p.setWorkspace(String(value));
 };
 const palette=p.appearance.palettes[mode];
 const search=query.trim().toLocaleLowerCase('ru');
 const matchesSection=(name:string)=>!search||(name+' '+(sectionLabels[name]||'')+(name==='Внешний вид'?' '+appearanceSearch:'')).toLocaleLowerCase('ru').includes(search)||settingsCatalog.find(s=>s.name===name)?.fields.some(f=>f.label.toLocaleLowerCase('ru').includes(search));
 const visibleGroups=sectionGroups.map(group=>({...group,sections:group.sections.filter(matchesSection)})).filter(group=>group.sections.length);
 const visibleFields=config?.fields.filter(f=>!f.label.startsWith('Этапы ')&&f.key!=='roles').filter(f=>!search||(config.name+' '+(sectionLabels[config.name]||'')).toLocaleLowerCase('ru').includes(search)||f.label.toLocaleLowerCase('ru').includes(search))||[];
 const basicFields=visibleFields.filter(f=>search||primaryFields[section]?.includes(f.key));
 const advancedFields=search?[]:visibleFields.filter(f=>!primaryFields[section]?.includes(f.key));
 function renderField(f:SettingField){return <SettingContainer key={f.key} grouped={['choices','list'].includes(f.type||'')} className={f.type==='toggle'?'setting-toggle':['textarea','choices','list'].includes(f.type||'')?'setting-full':''}>
  {f.type==='toggle'?<><span>{f.label}{f.hint&&<small>{f.hint}</small>}</span><input type="checkbox" disabled={!canEdit} checked={Boolean(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.checked)}/></>:<>{f.label}
   {f.type==='list'?<ListSetting disabled={!canEdit} label={f.label} value={String(values[f.key]??f.value)} options={f.options} onChange={value=>set(f.key,value)}/>:f.type==='select'?<Select disabled={!canEdit} value={String(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.value)}>{f.key==='language'&&!f.options?.includes(String(values[f.key]??f.value))&&<option value={String(values[f.key])} disabled>{String(values[f.key])} · не поддерживается</option>}{(f.key==='defaultBranch'?String(values.branches).split('\n').filter(Boolean):f.key==='defaultWarehouse'?String(values.warehouses).split('\n').filter(Boolean):f.key==='newRole'?[...new Set([...roles.map(role=>role.name),String(values.newRole)])]:f.options)?.map(o=><option key={o}>{o}</option>)}</Select>:f.type==='choices'?<div className="settings-choice-grid">{[...new Set([...(f.options||[]),...String(values[f.key]??f.value).split('\n').filter(Boolean)])].map(option=><button type="button" key={option} disabled={!canEdit} aria-pressed={String(values[f.key]??f.value).split('\n').includes(option)} className={String(values[f.key]??f.value).split('\n').includes(option)?'selected':''} onClick={()=>{const chosen=String(values[f.key]??f.value).split('\n').filter(Boolean);set(f.key,(chosen.includes(option)?chosen.filter(v=>v!==option):[...chosen,option]).join('\n'))}}>{String(values[f.key]??f.value).split('\n').includes(option)&&<Check size={14}/>} {option}</button>)}</div>:f.type==='textarea'?<textarea disabled={!canEdit} value={String(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.value)}/>:<input disabled={!canEdit} type={f.type||'text'} step={f.key==='temperature'?.1:1} min={f.min} max={f.max} value={String(values[f.key]??f.value)} onChange={e=>set(f.key,f.type==='number'?Number(e.target.value):e.target.value)}/>}
   {f.hint&&<small>{f.hint}</small>}</>}
 </SettingContainer>}
 return <div className="settings-studio settings-simple">
  <header className="studio-heading"><div><h1>Настройки</h1><p>Настройте рабочее место и правила компании.</p></div><span className="settings-autosaved"><Check size={15}/>Сохраняется автоматически</span></header>
  <div className="settings-layout">
   <aside className="settings-index">
    <div className="settings-search"><Search size={15}/><input aria-label="Поиск настроек" placeholder="Найти настройку…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Очистить поиск настроек" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
    <nav className="settings-nav" aria-label="Разделы настроек">{visibleGroups.map(group=><div className="settings-nav-group" key={group.name}><h3>{group.name}</h3>{group.sections.map(name=><button key={name} aria-current={name===section?'page':undefined} className={name===section?'selected':''} onClick={()=>setSection(name)}>{name==='Внешний вид'?<PaletteIcon size={15}/>:name==='Безопасность'?<ShieldCheck size={15}/>:<SlidersHorizontal size={15}/>}<span>{sectionLabels[name]||name}</span></button>)}</div>)}</nav>
    {!visibleGroups.length&&<div className="settings-no-results"><p>Ничего не найдено</p><button type="button" onClick={()=>setQuery('')}>Показать все настройки</button></div>}
    <small>Настройки этого браузера</small>
   </aside>
   <section className="settings-content" data-readonly={!canEdit}>{!canEdit&&<p role="status" className="muted">Только просмотр: ваша роль не разрешает изменять настройки.</p>}
    {search&&!matchesSection(section)?<div className="panel settings-search-guidance"><Search size={24}/><h2>{visibleGroups.length?'Выберите найденный раздел':'Нет подходящих настроек'}</h2><p>{visibleGroups.length?'Совпадения показаны в меню настроек.':'Попробуйте «тема», «ответы» или «уведомления».'}</p></div>:section==='Конфигурация'?<SettingsDocumentPanel actorId={props.actorId} canEdit={props.canEdit??true} notify={p.notify} audit={p.audit}/>:section==='System AI'?<SystemAISettings actorId={props.actorId} canEdit={(props.canEdit??true)&&access.canWrite('system','ai')} canProduction={hasAccess(actor,roles,'server','production')} notify={p.notify} go={p.go}/>:section==='Внешний вид'?<>
     <div className="section-intro"><h2>Внешний вид</h2><p>Все изменения сразу видны во всём приложении.</p></div>
     <section className={'panel performance-setting '+(p.appearance.lowPower?'is-enabled':'')}>
      <label className="setting-toggle"><span><b><Monitor size={19}/>Слабый компьютер</b><small>Убирает тяжёлые эффекты и анимации графиков. Все данные и инструменты остаются доступны.</small></span><input type="checkbox" disabled={!canEdit} checked={p.appearance.lowPower} onChange={e=>p.setAppearance(a=>({...a,lowPower:e.target.checked}))}/></label>
      {p.appearance.lowPower&&<small className="performance-enabled"><Check size={14}/>Облегчённый режим включён</small>}
     </section>
     <section className="panel appearance-colors"><h3>Тема и цвет</h3>
      <div className="theme-preview-grid">{(['Dark','Light','System'] as const).map((theme,i)=><button key={theme} disabled={!canEdit} aria-pressed={p.theme===theme} className={'theme-preview '+(p.theme===theme?'selected':'')} onClick={()=>p.setTheme(theme)}><div className={'theme-mini '+theme.toLowerCase()}><i/><span><b/><b/><em/><em/></span></div><span>{['Тёмная','Светлая','Как на компьютере'][i]}{p.theme===theme&&<Check size={14}/>}</span></button>)}</div>
      <div className="appearance-row"><div><h4>Акцентный цвет</h4><p>Кнопки и выделенные элементы</p></div><div className="accent-options">{Object.entries(p.accents).map(([name,color])=><button key={name} disabled={!canEdit} aria-pressed={!p.appearance.custom&&p.accent===name} className={!p.appearance.custom&&p.accent===name?'selected':''} onClick={()=>{p.setAccent(name);p.setAppearance(a=>({...a,custom:false}))}}><i style={{background:color}}/>{name}</button>)}</div></div>
      <details className="settings-disclosure" open={p.appearance.custom||undefined}><summary><span><b>Своя палитра</b><small>Отдельные цвета фона, текста и карточек</small></span><ChevronDown size={17}/></summary><div className="disclosure-content">
       <label className="setting-toggle"><span>Использовать свою палитру</span><input type="checkbox" disabled={!canEdit} checked={p.appearance.custom} onChange={e=>p.setAppearance(a=>({...a,custom:e.target.checked}))}/></label>
       <div className="tabs">{(['dark','light'] as const).map(m=><button className={mode===m?'selected':''} key={m} onClick={()=>setMode(m)}>{m==='dark'?'Тёмная тема':'Светлая тема'}</button>)}</div>
       <div className="palette-grid">{Object.entries(tokenNames).map(([key,name])=><button disabled={!canEdit} className="color-token" key={key} onClick={()=>setPicker(key as keyof Palette)}><i style={{background:palette[key as keyof Palette]}}/><span>{name}<small>{palette[key as keyof Palette].toUpperCase()}</small></span></button>)}</div>
       <div className="palette-live" style={{background:palette.bg,color:palette.text,borderColor:palette.border}}><aside style={{background:palette.sidebar,borderColor:palette.border}}><b>B</b><span style={{background:palette.accent}}/><span style={{background:palette.hover}}/><span style={{background:palette.hover}}/></aside><div><small style={{color:palette.muted}}>Предпросмотр палитры</small><h3>Рабочий день под контролем</h3><div style={{background:palette.panel,borderColor:palette.border}}><span>Новые сделки <b>24</b></span><span className="palette-sample-button" style={{background:palette.accent,borderColor:palette.accent,color:palette.text}}>Новая сделка</span></div></div></div>
       <button disabled={!canEdit} data-permission="edit" onClick={()=>{p.setAppearance(a=>({...a,palettes:{...a.palettes,[mode]:defaultPalettes[mode]}}));p.notify('Палитра темы восстановлена')}}><RotateCcw size={14}/>Сбросить эту палитру</button>
      </div></details>
     </section>
     <section className="panel appearance-readability"><h3>Размер и расположение</h3>
      <div className="appearance-row"><div><h4>Шрифт</h4><p>Без загрузки внешних ресурсов</p></div><Select aria-label="Шрифт интерфейса" disabled={!canEdit} value={p.appearance.fontFamily} onChange={event=>p.setAppearance(value=>({...value,fontFamily:event.target.value}))}><option value="system">Системный</option><option value="humanist">Мягкий и открытый</option><option value="classic">Классический</option></Select></div>
      <div className="appearance-row"><div><h4>Плотность</h4><p>Расстояния между элементами</p></div><ChoiceButtons disabled={!canEdit} label="Плотность интерфейса" value={p.appearance.density} options={[{value:'comfortable',label:'Комфортная',detail:'Больше воздуха'},{value:'compact',label:'Компактная',detail:'Больше на экране'}]} onChange={density=>p.setAppearance(a=>({...a,density}))}/></div>
      <div className="appearance-row"><div><h4>Размер текста</h4><p>{p.appearance.fontSize} px · во всём приложении</p></div><ChoiceButtons disabled={!canEdit} label="Размер текста" value={p.appearance.fontSize} options={[{value:12,label:'Мелкий'},{value:14,label:'Обычный'},{value:16,label:'Крупный'},{value:18,label:'Очень крупный'}]} onChange={fontSize=>p.setAppearance(a=>({...a,fontSize}))}/></div>
      <div className="appearance-row"><div><h4>Углы карточек</h4><p>Скругление {p.appearance.radius} px</p></div><ChoiceButtons disabled={!canEdit} label="Скругление карточек" value={p.appearance.radius} options={[{value:0,label:'Прямые'},{value:6,label:'Небольшие'},{value:12,label:'Мягкие'},{value:18,label:'Круглые'}]} onChange={radius=>p.setAppearance(a=>({...a,radius}))}/></div>
      <label className="setting-toggle"><span>Только значки в боковом меню<small>Освобождает место для работы</small></span><input type="checkbox" disabled={!canEdit} checked={p.collapsed} onChange={e=>p.setCollapsed(e.target.checked)}/></label>
      <label className="setting-toggle"><span>Плавные анимации<small>{p.appearance.lowPower?'Временно отключены в режиме «Слабый компьютер»':'Переходы между разделами и движение элементов'}</small></span><input type="checkbox" disabled={!canEdit||p.appearance.lowPower} checked={p.appearance.motion&&!p.appearance.lowPower} onChange={e=>p.setAppearance(a=>({...a,motion:e.target.checked}))}/></label>
      <details className="settings-disclosure"><summary><span><b>Точная настройка размеров</b><small>Если готовые варианты не подошли</small></span><ChevronDown size={17}/></summary><div className="disclosure-content form-grid"><label>Размер текста · {p.appearance.fontSize} px<input aria-label="Точный размер текста" disabled={!canEdit} type="range" min={12} max={18} style={{'--range-fill':`${(p.appearance.fontSize-12)/6*100}%`} as CSSProperties} value={p.appearance.fontSize} onChange={e=>p.setAppearance(a=>({...a,fontSize:Number(e.target.value)}))}/></label><label>Скругление · {p.appearance.radius} px<input aria-label="Точное скругление" disabled={!canEdit} type="range" min={0} max={18} style={{'--range-fill':`${p.appearance.radius/18*100}%`} as CSSProperties} value={p.appearance.radius} onChange={e=>p.setAppearance(a=>({...a,radius:Number(e.target.value)}))}/></label></div></details>
      <div className="readability-preview"><small>Так будут выглядеть карточки</small><h3>Рабочее пространство</h3><p>Клиенты, сделки и задачи в одном месте.</p><span className="readability-sample-control">Пример элемента</span></div>
      <button type="button" disabled={!canEdit} onClick={()=>{p.setAppearance(a=>({...a,density:'comfortable',fontSize:14,radius:6,motion:true}));p.setCollapsed(false);p.notify('Размеры и расположение восстановлены')}}><RotateCcw size={14}/>Вернуть стандартные размеры</button>
     </section>
    </>:section==='Безопасность'?<section className="panel settings-security"><NeutralArt kind="access"/><h2>Безопасность аккаунта</h2><p>Пароль, двухфакторная проверка, резервные коды и активные сессии.</p><button className="primary" onClick={()=>p.go('security')}>Открыть безопасность</button><Link className="button-link" href="/login">Страница входа</Link></section>:config&&<>
     <div className="section-intro"><h2>{sectionLabels[config.name]||config.name}</h2><p>{config.description}</p></div>
     {section==='AI и модели'&&hasAccess(actor,roles,'agents')&&<section className="panel"><h3>Постоянные агенты</h3><AgentConfiguration actorId={props.actorId} canEdit={canEdit&&hasAccess(actor,roles,'agents','edit')} access={{knowledge:hasAccess(actor,roles,'knowledge'),finance:hasAccess(actor,roles,'finance'),run:hasAccess(actor,roles,'agents','ai'),export:hasAccess(actor,roles,'agents','export'),clients:Boolean(p.canReadClients),analytics:hasAccess(actor,roles,'analytics'),inventory:hasAccess(actor,roles,'inventory'),tasks:hasAccess(actor,roles,'tasks')}} notify={p.notify} audit={p.audit}/></section>}{section==='AI и модели'&&<section className="panel"><h3>Как бот общается с клиентами</h3><p>Инструкции, готовые ответы и проверка качества собраны в настройках бота.</p><button type="button" className="primary" onClick={()=>p.go('laboratory')}>Настроить бота</button></section>}
     {section==='Роли и права'&&<section className="panel"><h3>Доступ сотрудников</h3><p>Выберите роль, разрешённые страницы и действия.</p><button type="button" className="primary" onClick={()=>p.go('employees')}>Открыть роли и сотрудников</button></section>}
     {section==='Сервер и мониторинг'&&<section className="panel"><h3>ИИ-помощник для сервера</h3><p>Диагностика ошибок и план исправления с Claude Code, Codex, Antigravity или своей моделью.</p><button type="button" onClick={()=>p.go('server')}>Открыть настройки сервера</button></section>}
     {section==='AI и модели'&&<section className="panel"><h3>Автонастройка промпта</h3><p>Менеджер задаст вопросы и поможет улучшить инструкции по выбранным диалогам.</p><button className="primary" onClick={()=>setPromptOpen(true)}>Открыть менеджер промпта</button></section>}{promptOpen&&<PromptManager close={()=>setPromptOpen(false)} notify={p.notify} canEdit={canEdit&&hasAccess(actor,roles,'agents','edit')} canReadClients={p.canReadClients??true}/>} {['AI и модели','Диалоги'].includes(section)&&<BotReplyApprovalSettings canEdit={p.canEdit??true} notify={p.notify}/>} {section==='AI и модели'&&<ReplyAssistantSettings canEdit={p.canEdit??true}/>}{section==='CRM и воронки'&&!search&&<StageEditor canEdit={canEdit} notify={p.notify}/>}
     <form onSubmit={e=>e.preventDefault()}>
      {basicFields.length>0&&<section className="panel"><div className="settings-fields">{basicFields.map(renderField)}</div></section>}
      {advancedFields.length>0&&<details key={section} className="panel settings-disclosure advanced-settings"><summary><span><b>Дополнительные настройки</b><small>Лимиты, ограничения и особые случаи</small></span><ChevronDown size={17}/></summary><div className="disclosure-content settings-fields">{advancedFields.map(renderField)}</div></details>}
      <div className="settings-save"><small><Check size={14}/>Изменения сохранены в этом браузере</small><button type="button" disabled={!canEdit} onClick={()=>setReset(true)}><RotateCcw size={14}/>Сбросить раздел</button></div>
     </form>
    </>}
    {section!=='Конфигурация'&&<footer className="settings-tools"><button type="button" onClick={()=>setSection('Конфигурация')}><FileJson size={14}/>Общая конфигурация · импорт и экспорт</button></footer>}
   </section>
  </div>
  {picker&&<ColorPicker label={tokenNames[picker]} value={palette[picker]} close={()=>setPicker(null)} onChange={color=>p.setAppearance(a=>({...a,custom:true,palettes:{...a.palettes,[mode]:{...a.palettes[mode],[picker]:color}}}))}/>}
  {reset&&<Modal title="Сбросить настройки раздела?" close={()=>setReset(false)}><p>Будут восстановлены исходные значения раздела «{sectionLabels[section]||section}».</p><div className="modal-footer"><button onClick={()=>setReset(false)}>Отмена</button><button className="primary" disabled={!canEdit} data-permission="edit" onClick={()=>{setValues(v=>({...v,...Object.fromEntries(config!.fields.map(f=>[f.key,f.value]))}));if(section==='Компания')p.setWorkspace(String(settingDefaults.company));setReset(false);p.audit('Сброшены настройки: '+section);p.notify('Настройки раздела сброшены')}}>Сбросить</button></div></Modal>}
 </div>;
}
