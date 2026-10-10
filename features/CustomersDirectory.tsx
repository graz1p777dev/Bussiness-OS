'use client';
import {UserRound,ArrowUpRight} from 'lucide-react';
import ChannelIcon from '../components/os/ChannelIcon';
import type {Entity} from '../lib/os/data';
import {money} from '../lib/os/data';
import type {Sale} from '../lib/os/inventory-model';
import {normalizeCustomers} from '../lib/os/customers';
import {customerPurchaseSummary} from '../lib/os/customer-relations';
export default function CustomersDirectory({deals,sales,canReadSales,open}:{deals:Entity[];sales:Sale[];canReadSales:boolean;open:(customer:Entity)=>void}){
 return <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Клиент</th><th>Контакт</th><th>Источник</th><th>Сделки</th><th>Покупки за всё время</th><th>Ответственный</th><th/></tr></thead><tbody>{normalizeCustomers(deals).map(customer=>{const summary=canReadSales?customerPurchaseSummary(sales,customer.id):null;return <tr key={customer.id} tabIndex={0} onClick={()=>open(customer)} onKeyDown={event=>{if(event.key==='Enter')open(customer)}}><td><div className="table-name"><span className="avatar small"><UserRound size={16}/></span><div><b>{customer.name}</b><small>{customer.id}</small></div></div></td><td>{customer.phone||customer.username||'Не указан'}</td><td><ChannelIcon channel={customer.channel}/></td><td>{customer.dealIds.length}</td><td>{summary?<><b>{money(summary.spent)}</b><small style={{display:'block'}}>{summary.count} чеков</small></>:'Нет доступа'}</td><td>{customer.owner||'Не назначен'}</td><td><ArrowUpRight size={16}/></td></tr>})}</tbody></table></div>{!deals.length&&<div className="empty">Клиенты не найдены. Измените фильтры или добавьте клиента.</div>}</section>;
}
