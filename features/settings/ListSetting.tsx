'use client';
import {useState} from 'react';
import {Check,Plus,X} from 'lucide-react';
export default function ListSetting({label,value,options=[],onChange}:{label:string;value:string;options?:string[];onChange:(value:string)=>void}){
 const [draft,setDraft]=useState('');const [creating,setCreating]=useState(false);
 const selected=value.split('\n').map(v=>v.trim()).filter(Boolean);
 const available=[...new Set([...options,...selected])];
 function toggle(item:string){onChange((selected.includes(item)?selected.filter(v=>v!==item):[...selected,item]).join('\n'))}
 function add(){const item=draft.trim();if(!item)return;if(!selected.includes(item))onChange([...selected,item].join('\n'));setDraft('');setCreating(false)}
 return <div className="settings-list-control"><div className="settings-choice-grid">{available.map(item=><button type="button" key={item} aria-pressed={selected.includes(item)} className={selected.includes(item)?'selected':''} onClick={()=>toggle(item)}>{selected.includes(item)?<Check size={14}/>:<Plus size={14}/>} {item}</button>)}</div><div className="settings-list-add">{creating?<><input aria-label={'Новое значение: '+label} placeholder="Добавить своё название…" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/><button type="button" disabled={!draft.trim()} onClick={add}><Plus size={14}/>Добавить</button><button type="button" aria-label="Отменить создание" onClick={()=>{setDraft('');setCreating(false)}}><X size={14}/></button></>:<button type="button" onClick={()=>setCreating(true)}><Plus size={14}/>Создать новый вариант</button>}</div><small>Нажмите на вариант, чтобы выбрать или убрать его. Новое название добавляется отдельно.</small></div>
}
