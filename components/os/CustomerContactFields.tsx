'use client';
import {useState} from 'react';
import Select from './Select';
export default function CustomerContactFields({channel='WhatsApp',phone='',username=''}:{channel?:string;phone?:string;username?:string}){
 const [source,setSource]=useState(channel);
 return <><label>Источник<Select name="channel" value={source} onChange={event=>setSource(event.target.value)}>{['WhatsApp','Instagram','Telegram','Сайт'].map(value=><option key={value}>{value}</option>)}</Select></label>{source==='Instagram'||source==='Telegram'?<label>Ник в {source}<input key={source} name="username" required maxLength={33} pattern="@?[A-Za-z0-9_.]{1,32}" defaultValue={source===channel?username:''} placeholder="@username" autoComplete="off" title="Ник латиницей: буквы, цифры, точка или подчёркивание"/></label>:<label>{source==='WhatsApp'?'Номер WhatsApp':'Телефон (необязательно)'}<input name="phone" type="tel" required={source==='WhatsApp'} maxLength={30} pattern="[+0-9() .-]{7,30}" defaultValue={phone} placeholder="+996 555 123 456" autoComplete="tel" title="Номер с кодом страны"/></label>}</>;
}
