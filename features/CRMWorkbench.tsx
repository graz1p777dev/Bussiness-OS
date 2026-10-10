'use client';
import {MessageCircle,AlarmClock,UserRound,Layers,CheckSquare} from 'lucide-react';
import type {Entity} from '../lib/os/data';
import {focusDeals,type CRMFocus} from '../lib/os/crm-workbench';
import {money} from '../lib/os/data';
import './CRMWorkbench.css';
const views=[{id:'all',label:'Все сделки',Icon:Layers},{id:'reply',label:'Ждут ответа',Icon:MessageCircle},{id:'overdue',label:'Просроченные',Icon:AlarmClock},{id:'unassigned',label:'Без ответственного',Icon:UserRound},{id:'mine',label:'Мои сделки',Icon:CheckSquare}] as const;
export default function CRMWorkbench({deals,visible,focus,setFocus,unanswered,viewer,now}:{deals:Entity[];visible:Entity[];focus:CRMFocus;setFocus:(value:CRMFocus)=>void;unanswered:string[];viewer:string;now:number}){
 return <section className="crm-workbench" aria-label="Рабочая очередь CRM"><div className="crm-focus-views tabs">{views.map(({id,label,Icon})=><button key={id} aria-pressed={focus===id} className={focus===id?'selected':''} onClick={()=>setFocus(id)}><Icon size={15}/><span>{label}</span><b>{focusDeals(deals,id,unanswered,viewer,now).length}</b></button>)}</div><div className="crm-workbench-summary"><span><b>{visible.length}</b> в рабочей очереди</span><span>Потенциал <b>{money(visible.reduce((sum,deal)=>sum+deal.value,0))}</b></span><small>Фильтры очереди работают вместе с поиском и фильтрами воронки.</small></div></section>;
}
