'use client';
import Select from '../../components/os/Select';
import {useState,type Dispatch,type SetStateAction,type ReactNode,type CSSProperties} from 'react';
import {Palette as PaletteIcon,Search,RotateCcw,Download,ShieldCheck,Check,SlidersHorizontal,ChevronDown,Monitor,X} from 'lucide-react';
import Link from 'next/link';
import {useStored} from '../../lib/os/storage';
import {defaultAppearance,defaultPalettes,type Palette} from '../../lib/os/appearance';
import {downloadText} from '../../lib/os/export';
import {settingsCatalog,settingDefaults,type SettingField} from './catalog';
import ListSetting from './ListSetting';
import {initialRoles} from '../../lib/os/team';
import StageEditor from './StageEditor';
import ColorPicker from './ColorPicker';
import NeutralArt from '../../components/os/NeutralArt';
import {Modal} from '../../components/os/ui';

type Props={theme:string;setTheme:(s:string)=>void;accent:string;setAccent:(s:string)=>void;accents:Record<string,string>;collapsed:boolean;setCollapsed:(v:boolean)=>void;appearance:typeof defaultAppearance;setAppearance:Dispatch<SetStateAction<typeof defaultAppearance>>;notify:(s:string)=>void;audit:(s:string)=>void;go:(s:string)=>void;setWorkspace:(s:string)=>void};
const tokenNames:Record<keyof Palette,string>={bg:'Фон приложения',panel:'Карточки и окна',sidebar:'Боковое меню',hover:'При наведении',border:'Границы',text:'Основной текст',muted:'Подписи',accent:'Акцентный цвет'};
const sectionGroups=[
 {name:'Для вас',sections:['Внешний вид','Уведомления','Безопасность']},
 {name:'Работа компании',sections:['Компания','CRM и воронки','Диалоги','Товары и остатки','Касса и продажи','Филиалы и склады','Команда и зарплаты','Роли и права']},
 {name:'ИИ и отчёты',sections:['AI и модели','Автоматизации','База знаний','Аналитика','Финансы','Маркетинг']},
 {name:'Система',sections:['Сервер и мониторинг','Данные и приватность','API и разработчик']}
];
const sectionLabels:Record<string,string>={'AI и модели':'ИИ и боты','API и разработчик':'Для разработчика'};
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
function ChoiceButtons<T extends string|number>({label,value,options,onChange}:{label:string;value:T;options:{value:T;label:string;detail?:string}[];onChange:(value:T)=>void}){
 return <div className="setting-options" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} aria-pressed={value===option.value} className={value===option.value?'selected':''} onClick={()=>onChange(option.value)}><span>{option.label}</span>{option.detail&&<small>{option.detail}</small>}{value===option.value&&<Check size={14}/>}</button>)}</div>;
}
export default function Settings(p:Props){
 const [roles]=useStored('team-roles-v3',initialRoles);
 const [section,setSection]=useState('Внешний вид');
 const [query,setQuery]=useState('');
 const [mode,setMode]=useState<'dark'|'light'>(p.theme==='Light'?'light':'dark');
 const [picker,setPicker]=useState<keyof Palette|null>(null);
 const [values,setValues]=useStored('settings-deep-v2',settingDefaults,value=>({...settingDefaults,...value}));
 const [reset,setReset]=useState(false);
 const config=settingsCatalog.find(s=>s.name===section);
 const set=(key:string,value:string|number|boolean)=>{
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
  {f.type==='toggle'?<><span>{f.label}{f.hint&&<small>{f.hint}</small>}</span><input type="checkbox" checked={Boolean(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.checked)}/></>:<>{f.label}
   {f.type==='list'?<ListSetting label={f.label} value={String(values[f.key]??f.value)} options={f.options} onChange={value=>set(f.key,value)}/>:f.type==='select'?<Select value={String(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.value)}>{(f.key==='defaultBranch'?String(values.branches).split('\n').filter(Boolean):f.key==='defaultWarehouse'?String(values.warehouses).split('\n').filter(Boolean):f.key==='newRole'?[...new Set([...roles.map(role=>role.name),String(values.newRole)])]:f.options)?.map(o=><option key={o}>{o}</option>)}</Select>:f.type==='choices'?<div className="settings-choice-grid">{[...new Set([...(f.options||[]),...String(values[f.key]??f.value).split('\n').filter(Boolean)])].map(option=><button type="button" key={option} aria-pressed={String(values[f.key]??f.value).split('\n').includes(option)} className={String(values[f.key]??f.value).split('\n').includes(option)?'selected':''} onClick={()=>{const chosen=String(values[f.key]??f.value).split('\n').filter(Boolean);set(f.key,(chosen.includes(option)?chosen.filter(v=>v!==option):[...chosen,option]).join('\n'))}}>{String(values[f.key]??f.value).split('\n').includes(option)&&<Check size={14}/>} {option}</button>)}</div>:f.type==='textarea'?<textarea value={String(values[f.key]??f.value)} onChange={e=>set(f.key,e.target.value)}/>:<input type={f.type||'text'} step={f.key==='temperature'?.1:1} min={f.min} max={f.max} value={String(values[f.key]??f.value)} onChange={e=>set(f.key,f.type==='number'?Number(e.target.value):e.target.value)}/>}
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
   <section className="settings-content">
    {search&&!matchesSection(section)?<div className="panel settings-search-guidance"><Search size={24}/><h2>{visibleGroups.length?'Выберите найденный раздел':'Нет подходящих настроек'}</h2><p>{visibleGroups.length?'Совпадения показаны в меню настроек.':'Попробуйте «тема», «ответы» или «уведомления».'}</p></div>:section==='Внешний вид'?<>
     <div className="section-intro"><h2>Внешний вид</h2><p>Все изменения сразу видны во всём приложении.</p></div>
     <section className={'panel performance-setting '+(p.appearance.lowPower?'is-enabled':'')}>
      <label className="setting-toggle"><span><b><Monitor size={19}/>Слабый компьютер</b><small>Убирает тяжёлые эффекты и анимации графиков. Все данные и инструменты остаются доступны.</small></span><input type="checkbox" checked={p.appearance.lowPower} onChange={e=>p.setAppearance(a=>({...a,lowPower:e.target.checked}))}/></label>
      {p.appearance.lowPower&&<small className="performance-enabled"><Check size={14}/>Облегчённый режим включён</small>}
     </section>
     <section className="panel appearance-colors"><h3>Тема и цвет</h3>
      <div className="theme-preview-grid">{(['Dark','Light','System'] as const).map((theme,i)=><button key={theme} aria-pressed={p.theme===theme} className={'theme-preview '+(p.theme===theme?'selected':'')} onClick={()=>p.setTheme(theme)}><div className={'theme-mini '+theme.toLowerCase()}><i/><span><b/><b/><em/><em/></span></div><span>{['Тёмная','Светлая','Как на компьютере'][i]}{p.theme===theme&&<Check size={14}/>}</span></button>)}</div>
      <div className="appearance-row"><div><h4>Акцентный цвет</h4><p>Кнопки и выделенные элементы</p></div><div className="accent-options">{Object.entries(p.accents).map(([name,color])=><button key={name} aria-pressed={!p.appearance.custom&&p.accent===name} className={!p.appearance.custom&&p.accent===name?'selected':''} onClick={()=>{p.setAccent(name);p.setAppearance(a=>({...a,custom:false}))}}><i style={{background:color}}/>{name}</button>)}</div></div>
      <details className="settings-disclosure" open={p.appearance.custom||undefined}><summary><span><b>Своя палитра</b><small>Отдельные цвета фона, текста и карточек</small></span><ChevronDown size={17}/></summary><div className="disclosure-content">
       <label className="setting-toggle"><span>Использовать свою палитру</span><input type="checkbox" checked={p.appearance.custom} onChange={e=>p.setAppearance(a=>({...a,custom:e.target.checked}))}/></label>
       <div className="tabs">{(['dark','light'] as const).map(m=><button className={mode===m?'selected':''} key={m} onClick={()=>setMode(m)}>{m==='dark'?'Тёмная тема':'Светлая тема'}</button>)}</div>
       <div className="palette-grid">{Object.entries(tokenNames).map(([key,name])=><button className="color-token" key={key} onClick={()=>setPicker(key as keyof Palette)}><i style={{background:palette[key as keyof Palette]}}/><span>{name}<small>{palette[key as keyof Palette].toUpperCase()}</small></span></button>)}</div>
       <div className="palette-live" style={{background:palette.bg,color:palette.text,borderColor:palette.border}}><aside style={{background:palette.sidebar,borderColor:palette.border}}><b>B</b><span style={{background:palette.accent}}/><span style={{background:palette.hover}}/><span style={{background:palette.hover}}/></aside><div><small style={{color:palette.muted}}>Предпросмотр палитры</small><h3>Рабочий день под контролем</h3><div style={{background:palette.panel,borderColor:palette.border}}><span>Новые сделки <b>24</b></span><span className="palette-sample-button" style={{background:palette.accent,borderColor:palette.accent,color:palette.text}}>Новая сделка</span></div></div></div>
       <button onClick={()=>{p.setAppearance(a=>({...a,palettes:{...a.palettes,[mode]:defaultPalettes[mode]}}));p.notify('Палитра темы восстановлена')}}><RotateCcw size={14}/>Сбросить эту палитру</button>
      </div></details>
     </section>
     <section className="panel appearance-readability"><h3>Размер и расположение</h3>
      <div className="appearance-row"><div><h4>Плотность</h4><p>Расстояния между элементами</p></div><ChoiceButtons label="Плотность интерфейса" value={p.appearance.density} options={[{value:'comfortable',label:'Комфортная',detail:'Больше воздуха'},{value:'compact',label:'Компактная',detail:'Больше на экране'}]} onChange={density=>p.setAppearance(a=>({...a,density}))}/></div>
      <div className="appearance-row"><div><h4>Размер текста</h4><p>{p.appearance.fontSize} px · во всём приложении</p></div><ChoiceButtons label="Размер текста" value={p.appearance.fontSize} options={[{value:12,label:'Мелкий'},{value:14,label:'Обычный'},{value:16,label:'Крупный'},{value:18,label:'Очень крупный'}]} onChange={fontSize=>p.setAppearance(a=>({...a,fontSize}))}/></div>
      <div className="appearance-row"><div><h4>Углы карточек</h4><p>Скругление {p.appearance.radius} px</p></div><ChoiceButtons label="Скругление карточек" value={p.appearance.radius} options={[{value:0,label:'Прямые'},{value:6,label:'Небольшие'},{value:12,label:'Мягкие'},{value:18,label:'Круглые'}]} onChange={radius=>p.setAppearance(a=>({...a,radius}))}/></div>
      <label className="setting-toggle"><span>Только значки в боковом меню<small>Освобождает место для работы</small></span><input type="checkbox" checked={p.collapsed} onChange={e=>p.setCollapsed(e.target.checked)}/></label>
      <label className="setting-toggle"><span>Плавные анимации<small>{p.appearance.lowPower?'Временно отключены в режиме «Слабый компьютер»':'Переходы между разделами и движение элементов'}</small></span><input type="checkbox" disabled={p.appearance.lowPower} checked={p.appearance.motion&&!p.appearance.lowPower} onChange={e=>p.setAppearance(a=>({...a,motion:e.target.checked}))}/></label>
      <details className="settings-disclosure"><summary><span><b>Точная настройка размеров</b><small>Если готовые варианты не подошли</small></span><ChevronDown size={17}/></summary><div className="disclosure-content form-grid"><label>Размер текста · {p.appearance.fontSize} px<input aria-label="Точный размер текста" type="range" min={12} max={18} style={{'--range-fill':`${(p.appearance.fontSize-12)/6*100}%`} as CSSProperties} value={p.appearance.fontSize} onChange={e=>p.setAppearance(a=>({...a,fontSize:Number(e.target.value)}))}/></label><label>Скругление · {p.appearance.radius} px<input aria-label="Точное скругление" type="range" min={0} max={18} style={{'--range-fill':`${p.appearance.radius/18*100}%`} as CSSProperties} value={p.appearance.radius} onChange={e=>p.setAppearance(a=>({...a,radius:Number(e.target.value)}))}/></label></div></details>
      <div className="readability-preview"><small>Так будут выглядеть карточки</small><h3>Рабочее пространство</h3><p>Клиенты, сделки и задачи в одном месте.</p><span className="readability-sample-control">Пример элемента</span></div>
      <button type="button" onClick={()=>{p.setAppearance(a=>({...a,density:'comfortable',fontSize:14,radius:6,motion:true}));p.setCollapsed(false);p.notify('Размеры и расположение восстановлены')}}><RotateCcw size={14}/>Вернуть стандартные размеры</button>
     </section>
    </>:section==='Безопасность'?<section className="panel settings-security"><NeutralArt kind="access"/><h2>Безопасность аккаунта</h2><p>Пароль, двухфакторная проверка, резервные коды и активные сессии.</p><button className="primary" onClick={()=>p.go('security')}>Открыть безопасность</button><Link className="button-link" href="/login">Страница входа</Link></section>:config&&<>
     <div className="section-intro"><h2>{sectionLabels[config.name]||config.name}</h2><p>{config.description}</p></div>
     {section==='AI и модели'&&<section className="panel"><h3>Как бот общается с клиентами</h3><p>Инструкции, готовые ответы и проверка качества собраны в настройках бота.</p><button type="button" className="primary" onClick={()=>p.go('laboratory')}>Настроить бота</button></section>}
     {section==='Роли и права'&&<section className="panel"><h3>Доступ сотрудников</h3><p>Выберите роль, разрешённые страницы и действия.</p><button type="button" className="primary" onClick={()=>p.go('employees')}>Открыть роли и сотрудников</button></section>}
     {section==='Сервер и мониторинг'&&<section className="panel"><h3>ИИ-помощник для сервера</h3><p>Диагностика ошибок и план исправления с Claude Code, Codex, Antigravity или своей моделью.</p><button type="button" onClick={()=>p.go('server')}>Открыть настройки сервера</button></section>}
     {section==='CRM и воронки'&&!search&&<StageEditor notify={p.notify}/>}
     <form onSubmit={e=>e.preventDefault()}>
      {basicFields.length>0&&<section className="panel"><div className="settings-fields">{basicFields.map(renderField)}</div></section>}
      {advancedFields.length>0&&<details key={section} className="panel settings-disclosure advanced-settings"><summary><span><b>Дополнительные настройки</b><small>Лимиты, ограничения и особые случаи</small></span><ChevronDown size={17}/></summary><div className="disclosure-content settings-fields">{advancedFields.map(renderField)}</div></details>}
      <div className="settings-save"><small><Check size={14}/>Изменения сохранены в этом браузере</small><button type="button" onClick={()=>setReset(true)}><RotateCcw size={14}/>Сбросить раздел</button></div>
     </form>
    </>}
    <footer className="settings-tools"><button type="button" onClick={()=>downloadText('business-os-settings.json',JSON.stringify({appearance:p.appearance,theme:p.theme,settings:values,stages:JSON.parse(localStorage.getItem('life-stage-config-v3')||'null'),roles:JSON.parse(localStorage.getItem('life-team-roles-v3')||'null')},null,2),'application/json')}><Download size={14}/>Скачать настройки</button></footer>
   </section>
  </div>
  {picker&&<ColorPicker label={tokenNames[picker]} value={palette[picker]} close={()=>setPicker(null)} onChange={color=>p.setAppearance(a=>({...a,custom:true,palettes:{...a.palettes,[mode]:{...a.palettes[mode],[picker]:color}}}))}/>}
  {reset&&<Modal title="Сбросить настройки раздела?" close={()=>setReset(false)}><p>Будут восстановлены исходные значения раздела «{sectionLabels[section]||section}».</p><div className="modal-footer"><button onClick={()=>setReset(false)}>Отмена</button><button className="primary" onClick={()=>{setValues(v=>({...v,...Object.fromEntries(config!.fields.map(f=>[f.key,f.value]))}));if(section==='Компания')p.setWorkspace(String(settingDefaults.company));setReset(false);p.audit('Сброшены настройки: '+section);p.notify('Настройки раздела сброшены')}}>Сбросить</button></div></Modal>}
 </div>;
}
