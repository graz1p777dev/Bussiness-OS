'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,ChartNoAxesCombined,MessageSquare,Package,SlidersHorizontal,Sparkles,Users,Workflow} from 'lucide-react';
import AIMark from '../components/os/AIMark';
import Select from '../components/os/Select';
import {Modal} from '../components/os/ui';
import {businessSetupItems,businessSetupDetails} from '../lib/os/business-blueprint';
import './BusinessSetup.css';

type Draft={industry:string;team:string;channels:string[];context:string};
type Props={workspace:string;text:string;setText:(text:string)=>void;step:number;ready:boolean;setReady:(ready:boolean)=>void;approved:boolean[];setApproved:(approved:boolean[])=>void;prepare:(description:string)=>void;apply:()=>void;close:()=>void};
const industries=['Магазин и онлайн-продажи','Красота и здоровье','Услуги и консультации','Обучение','Другое'];
const channels=['WhatsApp','Instagram','Telegram','Сайт','Офлайн'];
const goals=[
 {name:'Продажи и клиенты',icon:MessageSquare,items:[0,1]},
 {name:'Команда',icon:Users,items:[2]},
 {name:'ИИ и автоматизации',icon:Workflow,items:[3,4]},
 {name:'Товары и склад',icon:Package,items:[5]},
 {name:'Аналитика',icon:ChartNoAxesCombined,items:[6,7]},
];
function parseDraft(text:string):Draft{
 const field=(name:string)=>text.split('\n').find(line=>line.startsWith(name+': '))?.slice(name.length+2);
 return {industry:field('Сфера')||(/косметик|красот/i.test(text)?'Красота и здоровье':industries[0]),team:field('Команда')||'2–5 человек',channels:field('Каналы')?.split(', ').filter(Boolean)||channels.filter(channel=>text.toLowerCase().includes(channel.toLowerCase())),context:text.includes('\nКонтекст:\n')?text.split('\nКонтекст:\n').slice(1).join('\nКонтекст:\n'):text};
}
function describe(draft:Draft){return ['Сфера: '+draft.industry,'Команда: '+draft.team,'Каналы: '+(draft.channels.join(', ')||'Пока не выбраны'),'Контекст:\n'+draft.context.trim()].join('\n')}

export default function BusinessSetup({workspace,text,setText,step,ready,setReady,approved,setApproved,prepare,apply,close}:Props){
 const [draft,setDraft]=useState(()=>parseDraft(text));
 const busy=step>=0;
 const selected=approved.filter(Boolean).length;
 const phase=Math.min(2,Math.floor(step/4));
 function update(change:Partial<Draft>){const next={...draft,...change};setDraft(next);setText(describe(next));setReady(false)}
 return <Modal title="Настройка бизнеса" wide close={close}><div className="business-setup">
  <div className="business-setup-heading"><span className="business-setup-symbol"><AIMark size={30}/></span><div><span className="business-setup-workspace">{workspace}</span><h2>{ready?'Всё готово к вашему выбору':'Ваш бизнес. Ваше рабочее пространство.'}</h2><p>{ready?'Проверьте, какие разделы добавить. Всё можно настроить дальше.':'Выберите, как работает ваша команда, — соберём подходящую основу.'}</p></div></div>
  <div className="business-setup-steps" aria-label="Шаги настройки"><span className={!ready?'current':'finished'}>{ready?<Check size={14}/>:<span>1</span>}О бизнесе</span><i/><span className={ready?'current':''}><span>2</span>Проверка и запуск</span></div>
  <div className="business-setup-body"><section className="business-setup-main">
   {ready?<div className="business-setup-review"><div className="business-setup-section-title"><h3>Что добавить в {workspace}</h3><button type="button" onClick={()=>setApproved(approved.map(()=>selected!==approved.length))}>{selected===approved.length?'Снять выбор':'Выбрать всё'}</button></div>{businessSetupItems.map((title,index)=><label className={'business-setup-module '+(approved[index]?'checked':'')} key={title}><input type="checkbox" checked={approved[index]} onChange={()=>setApproved(approved.map((value,i)=>i===index?!value:value))}/><span className="business-setup-check" aria-hidden="true">{approved[index]&&<Check size={13}/>}</span><span><b>{title}</b><small>{businessSetupDetails[index]}</small></span></label>)}</div>:<fieldset disabled={busy} className="business-setup-form">
    <div className="business-setup-fields"><label>Сфера бизнеса<Select aria-label="Сфера бизнеса" value={draft.industry} onChange={event=>update({industry:event.target.value})}>{[...new Set([...industries,draft.industry])].map(industry=><option key={industry}>{industry}</option>)}</Select></label><label>Размер команды<Select aria-label="Размер команды" value={draft.team} onChange={event=>update({team:event.target.value})}>{['Только я','2–5 человек','6–15 человек','16–50 человек','Больше 50 человек'].map(team=><option key={team}>{team}</option>)}</Select></label></div>
    <section className="business-setup-field"><h3>Где вы общаетесь с клиентами</h3><div className="business-setup-chips">{channels.map(channel=><button type="button" key={channel} aria-pressed={draft.channels.includes(channel)} className={draft.channels.includes(channel)?'selected':''} onClick={()=>update({channels:draft.channels.includes(channel)?draft.channels.filter(value=>value!==channel):[...draft.channels,channel]})}>{draft.channels.includes(channel)&&<Check size={13}/>} {channel}</button>)}</div></section>
    <section className="business-setup-field"><h3>Что хотите организовать</h3><div className="business-setup-goals">{goals.map(goal=>{const active=goal.items.every(i=>approved[i]);return <button type="button" key={goal.name} aria-pressed={active} className={active?'selected':''} onClick={()=>{setApproved(approved.map((value,i)=>goal.items.includes(i)?!active:value));setReady(false)}}><goal.icon size={18}/><span>{goal.name}</span><span className="business-setup-check" aria-hidden="true">{active&&<Check size={12}/>}</span></button>})}</div></section>
    <label className="business-setup-context">Что ещё учесть <span>Необязательно</span><textarea aria-label="Особенности бизнеса" rows={3} value={draft.context} onChange={event=>update({context:event.target.value})} placeholder="Например: работаем по записи, доставляем по Бишкеку, хотим возвращать постоянных клиентов."/></label>
   </fieldset>}
  </section><aside className="business-setup-summary"><span className="business-setup-summary-icon"><SlidersHorizontal size={22}/></span><h3>{ready?'Подходит вашей команде':'Ваша будущая OS'}</h3><p>{draft.industry}</p><dl><div><dt>Команда</dt><dd>{draft.team}</dd></div><div><dt>Каналы</dt><dd>{draft.channels.length?draft.channels.join(', '):'Можно добавить позже'}</dd></div><div><dt>Разделы</dt><dd>{selected} из {businessSetupItems.length}</dd></div></dl><div className="business-setup-flow">{goals.filter(goal=>goal.items.some(i=>approved[i])).map(goal=><div key={goal.name}><goal.icon size={16}/><span>{goal.name}</span><CheckCircle2 size={14}/></div>)}{!selected&&<small>Выберите разделы слева.</small>}</div><div className="business-setup-footnote"><CheckCircle2 size={16}/><p>Ваши записи сохранятся. Добавим только недостающие настройки; действие можно отменить.</p></div></aside></div>
  {busy&&<div className="business-setup-progress" role="status" aria-live="polite"><div><Sparkles size={17}/><span>{['Подбираем разделы для бизнеса','Готовим настройки и сценарии','Проверяем план рабочего пространства'][phase]}</span></div><div role="progressbar" aria-label="Подготовка рабочего пространства" aria-valuemin={0} aria-valuemax={12} aria-valuenow={step+1}><i style={{width:(step+1)/12*100+'%'}}/></div></div>}
  <footer className="business-setup-footer"><small>Локальная настройка. Модель и внешние сервисы пока не подключены.</small><div>{ready?<><button type="button" onClick={()=>setReady(false)}><ArrowLeft size={15}/>Назад</button><button className="primary" disabled={!selected||busy} onClick={apply}>Применить выбранное<Check size={16}/></button></>:<><button type="button" onClick={close}>Позже</button><button className="primary" disabled={busy||!selected} onClick={()=>prepare(describe(draft))}>{busy?'Подготавливаем…':'Подготовить пространство'}<ArrowRight size={16}/></button></>}</div></footer>
 </div></Modal>
}
