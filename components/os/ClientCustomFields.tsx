'use client';
import {useState} from 'react';
import {useStored} from '../../lib/os/storage';
import {initialInventory} from '../../lib/os/inventory-model';
import {settingDefaults} from '../../features/settings/catalog';
import {clientFieldNames,clientFieldInputName} from '../../lib/os/client-fields';
import Select from './Select';

const choices:Record<string,string[]>={
 'Тип кожи':['Нормальная','Сухая','Жирная','Комбинированная','Не определён'],
 'Чувствительность':['Нет','Есть','Неизвестно'],
 'Предпочтительный канал':['WhatsApp','Instagram','Telegram','Сайт','Телефон','Офлайн'],
 'Формат консультации':['В офисе','Видеозвонок','По телефону','В переписке'],
 'Способ доставки':['Самовывоз','Курьер','Почта','Транспортная компания'],
 'Уровень подготовки':['Начинающий','Базовый','Средний','Продвинутый'],
};
function ProductChoices({name,value,options}:{name:string;value:string;options:string[]}){
 const [selected,setSelected]=useState(()=>value.split('\n').filter(Boolean));
 const all=[...new Set([...options,...selected])];
 return <div><input name={name} type="hidden" value={selected.join('\n')}/><div className="settings-choice-grid" style={{maxHeight:180,overflow:'auto'}}>{all.map(option=><button type="button" key={option} aria-pressed={selected.includes(option)} className={selected.includes(option)?'selected':''} onClick={()=>setSelected(rows=>rows.includes(option)?rows.filter(row=>row!==option):[...rows,option])}>{option}</button>)}</div>{!all.length&&<small>Добавьте товары в каталог, чтобы выбрать их здесь.</small>}</div>;
}
export default function ClientCustomFields({values={}}:{values?:Record<string,string>}){
 const [settings]=useStored('settings-deep-v2',settingDefaults);
 const [inventory]=useStored('inventory-v2',initialInventory);
 const fields=clientFieldNames(settings.customFields);
 if(!fields.length)return null;
 return <section className="client-custom-fields"><h3>Дополнительные поля клиента</h3><div className="form-grid">{fields.map(field=>{
  const value=values[field]||'';const name=clientFieldInputName(field);
  const options=field==='Способ оплаты'?String(settings.paymentMethods||'Наличные\nКарта\nQR').split('\n').filter(Boolean):field==='Категория интереса'?[...new Set(inventory.products.filter(product=>!product.deleted).map(product=>product.category).filter(Boolean))]:choices[field];
  const type=['Бюджет','Возраст'].includes(field)?'number':field==='Email'?'email':['Дата рождения'].includes(field)?'date':['Следующий контакт','Дата встречи'].includes(field)?'datetime-local':'text';
  return <label key={field}>{field}{field==='Интересующие товары'?<ProductChoices name={name} value={value} options={inventory.products.filter(product=>!product.deleted).map(product=>product.name)}/>:options?<Select name={name} defaultValue={value}><option value="">Не указано</option>{[...new Set([...options,...(value?[value]:[])])].map(option=><option key={option}>{option}</option>)}</Select>:<input name={name} type={type} defaultValue={value} min={type==='number'?0:undefined} max={field==='Возраст'?150:undefined} step={field==='Бюджет'?'0.01':undefined}/>}</label>;
 })}</div></section>;
}
export function ClientCustomFieldDetails({values={}}:{values?:Record<string,string>}){
 const [settings]=useStored('settings-deep-v2',settingDefaults);
 const fields=clientFieldNames(settings.customFields).filter(field=>values[field]);
 if(!fields.length)return null;
 return <section className="client-custom-fields"><h3>Дополнительные данные</h3>{fields.map(field=><label key={field}>{field}<b style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{values[field]}</b></label>)}</section>;
}
