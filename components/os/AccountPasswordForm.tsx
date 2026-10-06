'use client';
import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export default function AccountPasswordForm({save,currentRequired=true,required=false}:{save:()=>void;currentRequired?:boolean;required?:boolean}){
 const [show,setShow]=useState(false);const [error,setError]=useState('');
 return <form data-permission="password" data-permission-scope="account" onSubmit={e=>{e.preventDefault();setError('');const data=new FormData(e.currentTarget);const password=String(data.get('new'));if(password.length<12){setError('Используйте не менее 12 символов.');return}if(password!==data.get('repeat')){setError('Пароли не совпадают.');return}e.currentTarget.reset();save()}}>
  {required&&<p>Администратор потребовал сменить пароль перед продолжением работы.</p>}
  {currentRequired&&<label>Текущий пароль<input name="current" required type="password" autoComplete="current-password"/></label>}
  <label>Новый пароль<div className="password-field"><input name="new" required minLength={12} type={show?'text':'password'} autoComplete="new-password"/><button type="button" aria-label={show?'Скрыть пароль':'Показать пароль'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></label>
  <label>Повторите пароль<input name="repeat" required minLength={12} type={show?'text':'password'} autoComplete="new-password"/></label>
  <small>Деморежим: проверяем форму и сохраняем дату смены. Пароль не сохраняется и не проверяется сервером.</small>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="modal-footer"><button data-permission="password" data-permission-scope="account" className="primary">Сменить пароль · демо</button></div>
 </form>
}
