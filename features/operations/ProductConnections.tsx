'use client';
import {useState} from 'react';
import type {Sale,StockDocument} from '../../lib/os/inventory-model';
import type {Entity} from '../../lib/os/data';
import {money} from '../../lib/os/data';
import {normalizeCustomers} from '../../lib/os/customers';
import {productRelations} from '../../lib/os/product-relations';
import {Modal} from '../../components/os/ui';
export default function ProductConnections({productId,sales,documents,clients,onCustomer}:{productId:string;sales:Sale[];documents:StockDocument[];clients?:Entity[];onCustomer?:(client:Entity)=>void}){
 const [receipt,setReceipt]=useState<Sale|null>(null);
 const related=productRelations(productId,sales,documents),customers=clients?normalizeCustomers(clients).filter(client=>related.customerIds.includes(client.id)):[];
 return <section className="panel"><h3>Продажи и связи товара</h3><div className="stat-grid"><div><small>Продано</small><strong>{related.sold}</strong></div><div><small>Возвращено</small><strong>{related.returned}</strong></div><div><small>Выручка после скидок и возвратов</small><strong>{money(related.revenue)}</strong></div></div><small className="muted">Скидка чека распределяется пропорционально стоимости позиций.</small><details><summary>Чеки · {related.receipts.length}</summary>{related.receipts.map(sale=><button type="button" className="customer-related-row" key={sale.id} onClick={()=>setReceipt(sale)}><span>{sale.id} · {new Date(sale.date).toLocaleDateString('ru-RU')}</span><strong>{money(sale.total-sale.refunds)}</strong></button>)}</details><details><summary>Складские документы · {related.movements.length}</summary>{related.movements.map(document=><div className="report-row" key={document.id}><span>{document.date} · {document.type}</span><small>{document.status} · {document.id}</small></div>)}</details>{clients&&<details><summary>Покупатели · {customers.length}</summary>{customers.map(client=><button type="button" className="customer-related-row" key={client.id} onClick={()=>onCustomer?.(client)}><span>{client.name}</span><small>{client.phone||client.username||client.channel}</small></button>)}</details>}{receipt&&<Modal title={'Чек '+receipt.id} close={()=>setReceipt(null)}><p>{new Date(receipt.date).toLocaleString('ru-RU')}</p>{receipt.items.map(line=><div className="report-row" key={line.productId}><span>{line.name} · {line.quantity} шт.{line.returned>0?' · возврат '+line.returned:''}</span><b>{money(line.price*line.quantity)}</b></div>)}<p>Оплачено: {money(receipt.total)} · возвраты: {money(receipt.refunds)}</p></Modal>}</section>;
}
