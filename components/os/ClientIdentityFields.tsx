'use client';
import {useState} from 'react';
import type {Entity} from '../../lib/os/data';
import {normalizeCustomers} from '../../lib/os/customers';
import Select from './Select';
import CustomerContactFields from './CustomerContactFields';
export default function ClientIdentityFields({deals,detail,suggestedName,allowExisting}:{deals:Entity[];detail:Entity|null;suggestedName:string;allowExisting:boolean}){
 const [customerId,setCustomerId]=useState('');
 const customers=normalizeCustomers(deals),selected=customers.find(customer=>customer.id===customerId);
 return <>{!detail&&allowExisting&&<label>Клиент сделки<Select name="customerId" value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">Новый клиент</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name} · {customer.phone||customer.username||customer.channel}</option>)}</Select><small>Выберите существующего клиента, чтобы новая сделка попала в его историю.</small></label>}<label>Имя клиента<input key={selected?.id||'new'} name="name" required readOnly={Boolean(selected)} defaultValue={selected?.name||detail?.name||suggestedName} placeholder="Имя клиента" autoFocus={!selected}/></label>{selected?<><input type="hidden" name="channel" value={selected.channel}/><input type="hidden" name="phone" value={selected.phone||''}/><input type="hidden" name="username" value={selected.username||''}/><div className="info-panel">{selected.channel} · {selected.phone||selected.username||'Контакт не указан'}<small>Контактные данные меняются в карточке клиента.</small></div></>:<div className="form-grid"><CustomerContactFields channel={detail?.channel} phone={detail?.phone} username={detail?.username}/></div>}</>;
}
