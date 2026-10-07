'use client';
import {useState,type FormEvent} from 'react';
import {Handshake,Plus,Search,SlidersHorizontal,Pencil,Pause,Play,ArrowUpRight,Copy,Check,Download,Trash2,Tags,LockKeyhole} from 'lucide-react';
import Select from '../components/os/Select';
import {Modal,Badge} from '../components/os/ui';
import {useStored} from '../lib/os/storage';
import {exportCSV} from '../lib/os/export';
import type {ActionPermissions} from '../lib/os/team';
import {initialPartners,emptyPartner,filterPartners,savePartner,setPartnerStatus,savePartnerType,removePartnerType,type Partner,type PartnerInput,type PartnerType,type PartnerFilters} from '../lib/os/partners';
import './PartnersWorkspace.css';

type Props={notify:(message:string)=>void;audit:(message:string)=>void;permissions?:ActionPermissions};
export default function PartnersWorkspace({notify,audit,permissions}:Props){
 const [state,setState]=useStored('partners-workspace-v1',initialPartners);
 const [filters,setFilters]=useState<PartnerFilters>({query:'',type:'',status:''});
 const [editor,setEditor]=useState<Partner|'new'|null>(null);
 const [draft,setDraft]=useState<PartnerInput>(emptyPartner);
 const [typesOpen,setTypesOpen]=useState(false);
 const [typeEditor,setTypeEditor]=useState<PartnerType|null>(null);
 const [typeName,setTypeName]=useState('');
 const [deleteType,setDeleteType]=useState<PartnerType|null>(null);
 const [statusChange,setStatusChange]=useState<Partner|null>(null);
 const [error,setError]=useState('');
 const [typeError,setTypeError]=useState('');
 const [copied,setCopied]=useState('');
 const allow=(action:keyof ActionPermissions)=>permissions?.[action]??true;
 const rows=filterPartners(state,filters);
 const counts={all:state.partners.length,active:state.partners.filter(partner=>partner.status==='active').length,inactive:state.partners.filter(partner=>partner.status==='inactive').length};
 const editorAction=editor==='new'?'create':'edit';
 const canSave=allow(editorAction);
 const knownTypes=[...new Set([...state.types.map(type=>type.name),...state.partners.map(partner=>partner.type)])];
 function openPartner(partner:Partner|'new'){
  if(partner==='new'&&!allow('create'))return;
  setEditor(partner);setDraft(partner==='new'?{...emptyPartner}:partner);setError('');setCopied('');
 }
 function submit(event:FormEvent){
  event.preventDefault();if(!editor)return;
  try{const id=editor==='new'?crypto.randomUUID():editor.id;setState(savePartner(state,draft,id,new Date().toISOString(),editorAction,permissions));audit((editor==='new'?'Создан':'Обновлён')+' партнёр: '+draft.name.trim());notify(editor==='new'?'Партнёр добавлен':'Изменения сохранены');setEditor(null);setError('')}catch(error){setError(error instanceof Error?error.message:'Проверьте поля партнёра.')}
 }
 function changeStatus(){
  if(!statusChange)return;
  try{const status=statusChange.status==='active'?'inactive':'active';setState(setPartnerStatus(state,statusChange.id,status,new Date().toISOString(),permissions));audit((status==='active'?'Возобновлено':'Приостановлено')+' сотрудничество: '+statusChange.name);notify(status==='active'?'Партнёр активирован':'Сотрудничество приостановлено');setStatusChange(null);setError('')}catch(error){setError(error instanceof Error?error.message:'Не удалось изменить статус.')}
 }
 function addType(event:FormEvent){
  event.preventDefault();
  try{const id=typeEditor?.id||crypto.randomUUID();setState(savePartnerType(state,typeName,id,typeEditor?'edit':'create',permissions));if(typeEditor&&filters.type===typeEditor.name)setFilters(current=>({...current,type:typeName.trim()}));if(editor&&(draft.type===typeEditor?.name||!typeEditor))setDraft(current=>({...current,type:typeName.trim()}));audit((typeEditor?'Переименован':'Создан')+' тип партнёра: '+typeName.trim());setTypeName('');setTypeEditor(null);setTypeError('');notify('Тип партнёра сохранён')}catch(error){setTypeError(error instanceof Error?error.message:'Не удалось сохранить тип.')}
 }
 function deletePartnerType(){
  if(!deleteType)return;
  try{setState(removePartnerType(state,deleteType.id,permissions));if(filters.type===deleteType.name&&!state.partners.some(partner=>partner.type===deleteType.name))setFilters(current=>({...current,type:''}));if(typeEditor?.id===deleteType.id){setTypeEditor(null);setTypeName('')}audit('Удалён тип партнёра: '+deleteType.name);setDeleteType(null);setTypeError('');notify('Тип удалён. Карточки партнёров сохранены')}catch(error){setTypeError(error instanceof Error?error.message:'Не удалось удалить тип.')}
 }
 async function copyContact(partner:Partner){try{await navigator.clipboard.writeText(partner.contact);setCopied(partner.id);notify('Контакт скопирован')}catch{notify('Не удалось скопировать. Откройте карточку и выделите контакт.')}}
 return <div className="partners-workspace">
  <header className="partners-heading"><div><h1><Handshake size={27}/>Партнёры</h1><p>Люди и команды, которые рекомендуют ваш бизнес.</p></div><div className="partners-actions"><button data-read-only="true" onClick={()=>{setTypesOpen(true);setTypeError('')}}><Tags size={16}/>Типы партнёров</button><button className="primary" data-permission="create" disabled={!allow('create')} onClick={()=>openPartner('new')}><Plus size={17}/>Добавить партнёра</button></div></header>
  <div className="partners-summary"><div className="workspace-tabs" aria-label="Статус партнёров">{([['','Все партнёры',counts.all],['active','Активные',counts.active],['inactive','На паузе',counts.inactive]] as const).map(([status,label,count])=><button key={status} className={filters.status===status?'selected':''} onClick={()=>setFilters(current=>({...current,status}))}>{label}<span>{count}</span></button>)}</div><Badge>Локальный справочник · демо</Badge></div>
  <section className="partners-directory">
   <div className="partners-toolbar"><label className="search-field"><Search size={17}/><input aria-label="Поиск партнёра" placeholder="Имя, контакт или условия сотрудничества" value={filters.query} onChange={event=>setFilters(current=>({...current,query:event.target.value}))}/></label><label className="partners-type-filter"><SlidersHorizontal size={15}/><Select aria-label="Тип партнёра" value={filters.type} onChange={event=>setFilters(current=>({...current,type:event.target.value}))}><option value="">Все типы</option>{knownTypes.map(type=><option key={type}>{type}</option>)}</Select></label><button data-permission="export" disabled={!allow('export')||!rows.length} onClick={()=>{if(!allow('export'))return;exportCSV('Партнёры.csv',['Название','Тип','Условия','Контакт','Статус'],rows.map(partner=>[partner.name,partner.type,partner.terms,partner.contact,partner.status==='active'?'Активен':'Неактивен']))}}><Download size={15}/>CSV</button></div>
   <div className="partners-list-heading"><span>Партнёр / направление</span><span>Условия сотрудничества</span><span>Контакт</span><span>Статус</span></div>
   <div className="partners-list">{rows.map(partner=><article className={'partner-row '+(partner.status==='inactive'?'partner-paused':'')} key={partner.id}>
    <button className="partner-identity" data-read-only="true" onClick={()=>openPartner(partner)}><span className="partner-monogram">{partner.name.replace(/[«»]/g,'').split(/\s+/).slice(0,2).map(word=>word[0]).join('')}</span><span><b>{partner.name}</b><small>{partner.type}</small></span><ArrowUpRight size={15}/></button>
    <p className="partner-terms">{partner.terms||<span>Условия ещё не добавлены</span>}</p>
    <div className="partner-contact"><span>{partner.contact||'Контакт не указан'}</span>{partner.contact&&<button aria-label={'Скопировать контакт '+partner.name} data-read-only="true" onClick={()=>void copyContact(partner)}>{copied===partner.id?<Check size={14}/>:<Copy size={14}/>}</button>}</div>
    <div className="partner-row-end"><span className={'partner-status '+partner.status}><i/>{partner.status==='active'?'Активен':'На паузе'}</span><div><button aria-label={'Редактировать партнёра '+partner.name} data-permission="edit" disabled={!allow('edit')} onClick={()=>openPartner(partner)}><Pencil size={15}/></button><button aria-label={(partner.status==='active'?'Приостановить ':'Активировать ')+partner.name} data-permission="edit" disabled={!allow('edit')} onClick={()=>{setStatusChange(partner);setError('')}}>{partner.status==='active'?<Pause size={15}/>:<Play size={15}/>}</button></div></div>
   </article>)}</div>
   {!rows.length&&<div className="partners-empty"><Handshake size={36}/><h2>{state.partners.length?'Партнёры не найдены':'Первое знакомство — начало сотрудничества'}</h2><p>{state.partners.length?'Попробуйте другое имя, контакт или тип партнёра.':'Добавьте контакт и договорённости, чтобы команда знала, с кем вы работаете.'}</p>{state.partners.length?<button onClick={()=>setFilters({query:'',type:'',status:''})}>Сбросить фильтры</button>:<button className="primary" data-permission="create" disabled={!allow('create')} onClick={()=>openPartner('new')}><Plus size={16}/>Добавить партнёра</button>}</div>}
   <footer className="partners-directory-footer"><span>Показано {rows.length} из {state.partners.length}</span><span>Приостановленные партнёры остаются в справочнике.</span></footer>
  </section>
  {editor&&<Modal title={editor==='new'?'Новый партнёр':editor.name} close={()=>setEditor(null)} wide><form className="partner-editor" data-permission={editorAction} onSubmit={submit}>
   {!canSave&&<div className="partner-readonly"><LockKeyhole size={16}/>Карточка доступна для просмотра. Изменения закрыты вашей ролью.</div>}
   <label>Название партнёра<input required readOnly={!canSave} value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))} placeholder="Имя специалиста или название команды"/></label>
   <div className="form-grid"><label>Направление<div className="partner-type-field"><Select disabled={!canSave} value={draft.type} onChange={event=>setDraft(current=>({...current,type:event.target.value}))}>{state.types.map(type=><option key={type.id}>{type.name}</option>)}{!state.types.some(type=>type.name===draft.type)&&<option>{draft.type}</option>}</Select>{canSave&&<button type="button" data-read-only="true" aria-label="Добавить или изменить тип партнёра" onClick={()=>{setTypesOpen(true);setTypeError('')}}><Tags size={16}/></button>}</div></label><label>Статус<Select disabled={!canSave} value={draft.status} onChange={event=>setDraft(current=>({...current,status:event.target.value as Partner['status']}))}><option value="active">Активен</option><option value="inactive">Сотрудничество на паузе</option></Select></label></div>
   <label>Контакт<input readOnly={!canSave} value={draft.contact} onChange={event=>setDraft(current=>({...current,contact:event.target.value}))} placeholder="Имя, телефон, email или мессенджер"/></label>
   <label>Условия сотрудничества<textarea rows={5} readOnly={!canSave} value={draft.terms} onChange={event=>setDraft(current=>({...current,terms:event.target.value}))} placeholder="Договорённости, комиссия, формат сотрудничества…"/></label>
   {editor!=='new'&&<p className="partner-saved-date">Добавлен {new Date(editor.createdAt).toLocaleDateString('ru-RU')} · обновлён {new Date(editor.updatedAt).toLocaleDateString('ru-RU')}</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <div className="modal-footer"><button type="button" onClick={()=>setEditor(null)}>{canSave?'Отмена':'Закрыть'}</button>{canSave&&<button className="primary" data-permission={editorAction}><Check size={16}/>{editor==='new'?'Добавить партнёра':'Сохранить изменения'}</button>}</div>
  </form></Modal>}
  {typesOpen&&<Modal title="Типы партнёров" close={()=>{setTypesOpen(false);setTypeEditor(null);setTypeName('');setDeleteType(null)}}><div className="partner-type-manager"><p>Направления помогают быстро найти нужного партнёра. Базовые типы сохраняются всегда.</p><div className="partner-type-list">{state.types.map(type=><div key={type.id}><span><b>{type.name}</b><small>{state.partners.filter(partner=>partner.type===type.name).length} партнёров{type.system?' · базовый тип':''}</small></span>{!type.system&&<><button data-permission="edit" disabled={!allow('edit')} aria-label={'Переименовать тип '+type.name} onClick={()=>{setTypeEditor(type);setTypeName(type.name);setTypeError('')}}><Pencil size={14}/></button><button data-permission="remove" disabled={!allow('remove')} aria-label={'Удалить тип '+type.name} onClick={()=>{setDeleteType(type);setTypeError('')}}><Trash2 size={14}/></button></>}</div>)}</div>
   <form data-permission={typeEditor?'edit':'create'} onSubmit={addType}><label>{typeEditor?'Новое название типа':'Добавить своё направление'}<input required disabled={!allow(typeEditor?'edit':'create')} value={typeName} onChange={event=>setTypeName(event.target.value)} placeholder="Например: Салон красоты"/></label><div className="row">{typeEditor&&<button type="button" onClick={()=>{setTypeEditor(null);setTypeName('');setTypeError('')}}>Отменить правку</button>}<button className="primary" data-permission={typeEditor?'edit':'create'} disabled={!allow(typeEditor?'edit':'create')||!typeName.trim()}>{typeEditor?<Check size={15}/>:<Plus size={15}/>} {typeEditor?'Сохранить название':'Добавить тип'}</button></div></form>
   {deleteType&&<div className="partner-type-delete"><b>Удалить тип «{deleteType.name}»?</b><p>Его название останется на существующих карточках. Для новых партнёров тип будет недоступен.</p><div className="row"><button onClick={()=>setDeleteType(null)}>Отмена</button><button data-permission="remove" disabled={!allow('remove')} onClick={deletePartnerType}>Удалить тип</button></div></div>}{typeError&&<p role="alert" className="form-error">{typeError}</p>}
  </div></Modal>}
  {statusChange&&<Modal title={statusChange.status==='active'?'Приостановить сотрудничество?':'Возобновить сотрудничество?'} close={()=>setStatusChange(null)}><p><b>{statusChange.name}</b></p><p className="partner-status-note">{statusChange.status==='active'?'Контакт и договорённости сохранятся. Партнёр перейдёт в раздел «На паузе», откуда его можно активировать снова.':'Партнёр снова появится среди активных. Контакт и прежние договорённости сохранятся.'}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button onClick={()=>setStatusChange(null)}>Отмена</button><button className="primary" data-permission="edit" disabled={!allow('edit')} onClick={changeStatus}>{statusChange.status==='active'?'Приостановить':'Активировать'}</button></div></Modal>}
 </div>;
}
