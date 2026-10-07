'use client';
import {useState,type Dispatch,type SetStateAction,type FormEvent} from 'react';
import {Plus,Search,Download,FileText,Pencil,Trash2,Check,ArrowRight,RotateCcw,Eye,Package} from 'lucide-react';
import Select from '../../components/os/Select';
import {Modal,Badge} from '../../components/os/ui';
import {useStored} from '../../lib/os/storage';
import {money} from '../../lib/os/data';
import {exportCSV} from '../../lib/os/export';
import {documentTypes,type InventoryState,type StockDocument,type Sale} from '../../lib/os/inventory-model';
import {documentItems,documentStatuses,emptyDocumentFilters,filterStockDocuments,saveDocumentDraft,deleteDocumentDraft,postStockDocument,cancelStockDocument,purchaseDocument,pricedDocument,type DocumentItem} from '../../lib/os/inventory-documents';
import {isStockTrackedProduct} from '../../lib/os/product-options';
import type {ActionPermissions} from '../../lib/os/team';
import {inventoryDirectories} from './InventoryDirectory';
import './InventoryDocuments.css';

type Props={state:InventoryState;setState:Dispatch<SetStateAction<InventoryState>>;notify:(message:string)=>void;audit:(message:string)=>void;permissions?:ActionPermissions;selectedId:string;onSelect:(id:string)=>void};
function localDate(){const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')}
function statusTone(status:string){return status==='Проведён'?'green':status==='Черновик'?'orange':''}
function itemName(item:DocumentItem|undefined,state:InventoryState){return item?.name||state.products.find(product=>product.id===item?.productId)?.name||item?.productId||'Нет позиций'}
function documentValue(doc:StockDocument,state:InventoryState){return documentItems(doc).reduce((sum,item)=>sum+item.quantity*(purchaseDocument(doc.type)?item.cost:item.referencePrice??state.products.find(product=>product.id===item.productId)?.price??0),0)}

export default function InventoryDocuments({state,setState,notify,audit,permissions,selectedId,onSelect}:Props){
 const [filters,setFilters]=useState(emptyDocumentFilters);
 const [pending,setPending]=useState<{id:string;action:'post'|'cancel'|'delete'}|null>(null);
 const [error,setError]=useState('');
 const rows=filterStockDocuments(state,filters);
 const allow=(action:keyof ActionPermissions)=>permissions?.[action]??true;
 const selected=state.documents.find(doc=>doc.id===selectedId);
 const pendingDoc=state.documents.find(doc=>doc.id===pending?.id);
 const warehouseName=(id:string)=>state.warehouses.find(warehouse=>warehouse.id===id)?.name||id;
 function perform(){
  if(!pending)return;
  try{
   const next=pending.action==='post'?postStockDocument(state,pending.id,permissions):pending.action==='cancel'?cancelStockDocument(state,pending.id,permissions):deleteDocumentDraft(state,pending.id,permissions);
   setState(next);const message=(pending.action==='post'?'Проведён документ ':pending.action==='cancel'?'Отменён документ ':'Удалён черновик ')+pending.id;audit(message);notify(message);setPending(null);setError('');if(pending.action==='delete'&&selectedId===pending.id)onSelect('');
  }catch(error){setError(error instanceof Error?error.message:'Проверьте документ')}
 }
 function ask(id:string,action:'post'|'cancel'|'delete'){setError('');setPending({id,action})}
 return <div className="inventory-documents">
  <header className="inventory-document-heading"><div><h2>Складские документы</h2><p>Сначала черновик, затем проведение и изменения остатков.</p></div><button className="primary" data-permission="create" disabled={!allow('create')||!state.warehouses.length||!state.products.some(product=>!product.deleted&&isStockTrackedProduct(product))} onClick={()=>onSelect('new')}><Plus size={16}/>Новый документ</button></header>
  <div className="inventory-document-counts">{documentStatuses.map(status=><button key={status} className={filters.status===status?'selected':''} onClick={()=>setFilters(current=>({...current,status:current.status===status?'':status}))}><span>{status}</span><b>{state.documents.filter(doc=>doc.status===status).length}</b></button>)}</div>
  <section className="panel inventory-document-filters">
   <label className="search-field"><Search size={16}/><input aria-label="Поиск документов" placeholder="Номер, товар, артикул, поставщик…" value={filters.query} onChange={event=>setFilters(current=>({...current,query:event.target.value}))}/></label>
   <label>Тип<Select value={filters.type} onChange={event=>setFilters(current=>({...current,type:event.target.value}))}><option value="">Все типы</option>{documentTypes.map(type=><option key={type}>{type}</option>)}</Select></label>
   <label>Статус<Select value={filters.status} onChange={event=>setFilters(current=>({...current,status:event.target.value}))}><option value="">Все статусы</option>{documentStatuses.map(status=><option key={status}>{status}</option>)}</Select></label>
   <label>Склад<Select value={filters.warehouse} onChange={event=>setFilters(current=>({...current,warehouse:event.target.value}))}><option value="">Все склады</option>{state.warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select></label>
   <label>С даты<input type="date" value={filters.from} onChange={event=>setFilters(current=>({...current,from:event.target.value}))}/></label>
   <label>По дату<input type="date" value={filters.to} onChange={event=>setFilters(current=>({...current,to:event.target.value}))}/></label>
   <div className="inventory-document-filter-actions"><span>{rows.length} из {state.documents.length}</span><button onClick={()=>setFilters(emptyDocumentFilters)}>Сбросить</button><button data-permission="export" disabled={!allow('export')} onClick={()=>{if(!allow('export'))return;exportCSV('Складские-документы.csv',['Номер','Дата','Тип','Статус','Склад','Назначение','Поставщик','Товары','Количество','Сумма','Примечание'],rows.map(doc=>[doc.id,doc.date,doc.type,doc.status,warehouseName(doc.warehouse),doc.target?warehouseName(doc.target):'',doc.supplier||'',documentItems(doc).map(item=>itemName(item,state)+' × '+item.quantity).join('; '),doc.quantity,pricedDocument(doc.type)?documentValue(doc,state):'',doc.note]))}}><Download size={14}/>CSV</button></div>
  </section>
  <div className="panel table-scroll"><table className="os-table inventory-document-table"><thead><tr>{['Документ','Тип / склад','Товары','Статус','Сумма','Действия'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map(doc=>{
   const items=documentItems(doc);
   return <tr key={doc.id}><td><button className="inventory-document-link" onClick={()=>onSelect(doc.id)}><FileText size={16}/>{doc.id}</button><small>{doc.date}</small>{doc.supplier&&<small>{doc.supplier}</small>}</td><td><b>{doc.type}</b><small>{warehouseName(doc.warehouse)}{doc.target&&<><ArrowRight size={12}/>{warehouseName(doc.target)}</>}</small></td><td><span>{itemName(items[0],state)}</span>{items.length>1&&<small>Ещё {items.length-1} поз.</small>}<small>{doc.quantity} ед. · {items.length} поз.</small></td><td><Badge tone={statusTone(doc.status)}>{doc.status}</Badge></td><td>{pricedDocument(doc.type)?money(documentValue(doc,state)):'—'}{pricedDocument(doc.type)&&!purchaseDocument(doc.type)&&<small>По справочным ценам</small>}</td><td><div className="table-actions"><button aria-label={(doc.status==='Черновик'&&allow('edit')?'Редактировать ':'Открыть ')+doc.id} onClick={()=>onSelect(doc.id)}>{doc.status==='Черновик'&&allow('edit')?<Pencil size={15}/>:<Eye size={15}/>}</button>{doc.status==='Черновик'&&<><button data-permission="inventory" disabled={!allow('inventory')} onClick={()=>ask(doc.id,'post')}><Check size={14}/>Провести</button><button data-permission="remove" disabled={!allow('remove')} aria-label={'Удалить черновик '+doc.id} onClick={()=>ask(doc.id,'delete')}><Trash2 size={14}/></button></>}{doc.status==='Проведён'&&doc.type!=='Приход'&&<button data-permission="inventory" disabled={!allow('inventory')} onClick={()=>ask(doc.id,'cancel')}><RotateCcw size={14}/>Отменить</button>}</div></td></tr>
  })}</tbody></table>{!rows.length&&<div className="inline-empty"><Package size={30}/><h3>{state.documents.length?'Документы не найдены':'Начните с первого документа'}</h3><p>{state.documents.length?'Измените фильтры или сбросьте поиск.':'Приход, расход, перемещение, инвентаризация и возвраты в одном журнале.'}</p></div>}</div>
  {(selectedId==='new'||selected)&&<DocumentEditor key={selectedId} {...{state,setState,notify,audit,permissions}} document={selected} close={()=>onSelect('')} onAsk={ask}/>}
  {selectedId&&selectedId!=='new'&&!selected&&<Modal title="Документ недоступен" close={()=>onSelect('')}><p>Документ был удалён. Обновите журнал и выберите другой.</p></Modal>}
  {pending&&pendingDoc&&<Modal title={pending.action==='post'?'Провести документ?':pending.action==='cancel'?'Отменить проведение?':'Удалить черновик?'} close={()=>setPending(null)}><p><b>{pendingDoc.type} · {pendingDoc.id}</b></p><p>{pending.action==='post'?'Остатки всех позиций будут обновлены. После проведения документ доступен только для просмотра.':pending.action==='cancel'?'Остатки изменятся обратно. Если для отмены недостаточно товара, операция будет отклонена.':'Черновик исчезнет из журнала. Остатки товаров не изменятся.'}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button onClick={()=>setPending(null)}>Назад</button><button className="primary" data-permission={pending.action==='delete'?'remove':'inventory'} disabled={!allow(pending.action==='delete'?'remove':'inventory')} onClick={perform}>{pending.action==='post'?'Провести':pending.action==='cancel'?'Отменить проведение':'Удалить черновик'}</button></div></Modal>}
 </div>
}

type EditorItem={key:string;productId:string;quantity:string;cost:string};
function DocumentEditor({state,setState,document:doc,notify,audit,permissions,close,onAsk}:{state:InventoryState;setState:Dispatch<SetStateAction<InventoryState>>;document?:StockDocument;notify:(message:string)=>void;audit:(message:string)=>void;permissions?:ActionPermissions;close:()=>void;onAsk:(id:string,action:'post'|'cancel'|'delete')=>void}){
 const [directories,setDirectories]=useStored('inventory-directories-v2',inventoryDirectories);
 const [type,setType]=useState(doc?.type||'Приход');
 const [warehouse,setWarehouse]=useState(doc?.warehouse||state.warehouses[0]?.id||'');
 const [target,setTarget]=useState(doc?.target||'');
 const [supplier,setSupplier]=useState(doc?.supplier||'');
 const [date,setDate]=useState(doc?.date||localDate());
 const [note,setNote]=useState(doc?.note||'');
 const [items,setItems]=useState<EditorItem[]>(()=>doc?documentItems(doc).map((item,index)=>({key:String(index),productId:item.productId,quantity:String(item.quantity),cost:String(item.cost)})):[]);
 const [productSearch,setProductSearch]=useState('');
 const [supplierOpen,setSupplierOpen]=useState(false);
 const [supplierName,setSupplierName]=useState('');
 const [supplierPhone,setSupplierPhone]=useState('');
 const [supplierContact,setSupplierContact]=useState('');
 const [error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 const [discard,setDiscard]=useState(false);
 const action=doc?'edit':'create';
 const allow=(permission:keyof ActionPermissions)=>permissions?.[permission]??true;
 const readOnly=Boolean(doc&&doc.status!=='Черновик')||!allow(action);
 const active=state.products.filter(product=>!product.deleted&&isStockTrackedProduct(product));
 const purchase=purchaseDocument(type),priced=pricedDocument(type),count=type==='Инвентаризация';
 const total=items.reduce((sum,item)=>sum+(Number(item.quantity)||0)*(purchase?Number(item.cost)||0:state.products.find(product=>product.id===item.productId)?.price||0),0);
 const update=(key:string,patch:Partial<EditorItem>)=>{setItems(current=>current.map(item=>item.key===key?{...item,...patch}:item));setDirty(true)};
 const changed=()=>{setDirty(true);setError('')};
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(readOnly)return;
  const post=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='post';
  try{
   const normalized=items.map(item=>({productId:item.productId,quantity:item.quantity.trim()?Number(item.quantity):NaN,cost:item.cost.trim()?Number(item.cost):NaN}));
   const draft:StockDocument={id:doc?.id||'DOC-'+crypto.randomUUID().slice(0,8),type,warehouse,target,supplier,date,note,items:normalized,productId:normalized[0]?.productId||'',quantity:0,cost:0,status:'Черновик'};
   let next=saveDocumentDraft(state,draft,doc?'edit':'create',permissions);
   if(post)next=postStockDocument(next,draft.id,permissions);
   setState(next);audit((post?'Проведён':doc?'Изменён':'Создан')+' документ '+draft.id);notify(post?'Документ проведён, остатки обновлены':'Черновик сохранён');close();
  }catch(error){setError(error instanceof Error?error.message:'Проверьте документ')}
 }
 function addSupplier(){
  if(!allow('create'))return;
  const name=supplierName.trim();if(!name){setError('Укажите название поставщика.');return}
  if((directories.Поставщики||[]).some(row=>row.name.toLocaleLowerCase()===name.toLocaleLowerCase())){setError('Такой поставщик уже есть. Выберите его из списка.');return}
  setDirectories(current=>({...current,Поставщики:[...(current.Поставщики||[]),{id:crypto.randomUUID(),name,detail:supplierPhone.trim(),extra:supplierContact.trim()}]}));setSupplier(name);setSupplierOpen(false);setError('');setDirty(true);notify('Поставщик добавлен');audit('Добавлен поставщик '+name);
 }
 return <Modal title={doc?doc.type+' · '+doc.id:'Новый складской документ'} close={()=>{if(dirty&&!readOnly)setDiscard(true);else close()}} wide>
  <form className="inventory-document-editor" data-permission={action} onSubmit={save}>
   <div className="inventory-document-editor-status"><Badge tone={statusTone(doc?.status||'Черновик')}>{doc?.status||'Черновик'}</Badge><span>{readOnly?'Документ доступен для просмотра':count?'Укажите фактический остаток каждого товара':'Черновик не меняет остатки на складе'}</span></div>
   <div className="form-grid"><label>Тип документа<Select disabled={readOnly} value={type} onChange={event=>{setType(event.target.value);changed()}}>{documentTypes.map(type=><option key={type}>{type}</option>)}</Select></label><label>Дата документа<input type="date" required disabled={readOnly} value={date} onChange={event=>{setDate(event.target.value);changed()}}/></label><label>{type==='Перемещение'?'Со склада':'Склад'}<Select disabled={readOnly} value={warehouse} onChange={event=>{setWarehouse(event.target.value);if(target===event.target.value)setTarget('');changed()}}>{!state.warehouses.some(row=>row.id===warehouse)&&<option value={warehouse}>{warehouse||'Выберите склад'}</option>}{state.warehouses.map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</Select></label>{type==='Перемещение'&&<label>На склад<Select disabled={readOnly} value={target} onChange={event=>{setTarget(event.target.value);changed()}}><option value="">Выберите склад назначения</option>{state.warehouses.filter(row=>row.id!==warehouse).map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</Select></label>}{purchase&&<label>Поставщик<div className="inventory-document-supplier"><Select disabled={readOnly} value={supplier} onChange={event=>{setSupplier(event.target.value);changed()}}><option value="">Без поставщика</option>{[...new Set([...(directories.Поставщики||[]).map(row=>row.name),...(supplier?[supplier]:[])])].map(name=><option key={name}>{name}</option>)}</Select>{!readOnly&&<button type="button" data-permission="create" disabled={!allow('create')} aria-label="Добавить поставщика" onClick={()=>setSupplierOpen(!supplierOpen)}><Plus size={15}/></button>}</div></label>}</div>
   {supplierOpen&&!readOnly&&purchase&&<fieldset className="inventory-document-new-supplier"><legend>Новый поставщик</legend><div className="form-grid"><label>Название<input value={supplierName} onChange={event=>setSupplierName(event.target.value)}/></label><label>Телефон<input type="tel" value={supplierPhone} onChange={event=>setSupplierPhone(event.target.value)}/></label><label>Контактное лицо<input value={supplierContact} onChange={event=>setSupplierContact(event.target.value)}/></label></div><div className="row"><button type="button" onClick={()=>setSupplierOpen(false)}>Отмена</button><button type="button" data-permission="create" disabled={!allow('create')} onClick={addSupplier}>Добавить поставщика</button></div></fieldset>}
   <div className="inventory-document-heading"><h3>Позиции <small>· {items.length}</small></h3>{!readOnly&&<button type="button" data-permission={action} disabled={!active.some(product=>!items.some(item=>item.productId===product.id))} onClick={()=>{const product=active.find(product=>!items.some(item=>item.productId===product.id));if(!product)return;setItems(current=>[...current,{key:crypto.randomUUID(),productId:product.id,quantity:String(count?product.stocks[warehouse]||0:1),cost:String(Math.round(product.cost*100)/100)}]);changed()}}><Plus size={15}/>Добавить товар</button>}</div>
   {!readOnly&&items.length>0&&<label className="search-field"><Search size={15}/><input aria-label="Найти товар в списках выбора" placeholder="Поиск товаров в списках по названию и артикулу" value={productSearch} onChange={event=>setProductSearch(event.target.value)}/></label>}
   {items.length===0&&<div className="inventory-document-empty"><Package size={24}/><p>Добавьте товары, затем укажите количество{purchase?' и закупочную цену':''}.</p></div>}
   <div className="inventory-document-lines">{items.map((item,index)=>{
    const product=state.products.find(product=>product.id===item.productId);
    const frozen=doc?documentItems(doc)[index]:undefined;
    const productOptions=active.filter(product=>product.id===item.productId||(!items.some(other=>other.key!==item.key&&other.productId===product.id)&&(product.name+' '+product.sku+' '+product.barcode).toLocaleLowerCase().includes(productSearch.toLocaleLowerCase())));
    const systemStock=readOnly&&doc?.status!=='Черновик'?frozen?.stockBefore:product?.stocks[warehouse]||0;
    const delta=Number(item.quantity)-(systemStock??0);
    const referencePrice=readOnly?frozen?.referencePrice??product?.price??0:product?.price??0;
    return <section className="inventory-document-line" key={item.key}><div className="inventory-document-line-main"><span className="inventory-document-line-number">{index+1}</span><label>Товар{readOnly?<div className="inventory-document-product-name"><b>{frozen?itemName(frozen,state):product?.name||item.productId}</b><small>{frozen?.sku||product?.sku} · {frozen?.unit||product?.unit}</small></div>:<Select aria-label={'Товар '+(index+1)} value={item.productId} onChange={event=>{const selected=active.find(product=>product.id===event.target.value);update(item.key,{productId:event.target.value,cost:String(Math.round((selected?.cost||0)*100)/100),...(count?{quantity:String(selected?.stocks[warehouse]||0)}:{})})}}>{(!product||product.deleted)&&<option value={item.productId}>{product?.name||'Выберите товар'} (недоступен)</option>}{productOptions.map(product=><option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</Select>}</label>{!readOnly&&<button type="button" data-permission={action} aria-label={'Убрать позицию '+(index+1)} onClick={()=>{setItems(current=>current.filter(row=>row.key!==item.key));changed()}}><Trash2 size={15}/></button>}</div><div className="inventory-document-line-values"><div><small>{readOnly&&doc?.status!=='Черновик'?'Остаток до проведения':'На выбранном складе'}</small><strong>{systemStock===undefined?'Не сохранён':systemStock} {systemStock===undefined?'':frozen?.unit||product?.unit}</strong></div><label>{count?'Фактический остаток':'Количество'}<input type="number" min={count?0:.001} step="0.001" required disabled={readOnly} value={item.quantity} onChange={event=>update(item.key,{quantity:event.target.value})}/></label>{purchase?<label>Закупочная цена<input type="number" min={0} step="any" required disabled={readOnly} value={item.cost} onChange={event=>update(item.key,{cost:event.target.value})}/></label>:priced?<div><small>Справочная цена</small><strong>{money(referencePrice)}</strong></div>:null}{count&&<div><small>Изменение остатка</small><strong className={delta<0?'inventory-document-negative':'inventory-document-positive'}>{systemStock===undefined?'—':(delta>0?'+':'')+Number(delta.toFixed(3))}</strong></div>}{priced&&<div><small>Сумма позиции</small><strong>{money((Number(item.quantity)||0)*(purchase?Number(item.cost)||0:referencePrice))}</strong></div>}</div></section>
   })}</div>
   {priced&&<div className="inventory-document-total"><span>{purchase?'Итого по документу':'Сумма по справочным ценам'}</span><strong>{money(readOnly&&doc?documentValue(doc,state):total)}</strong></div>}
   <label>Примечание<textarea rows={3} value={note} readOnly={readOnly} onChange={event=>{setNote(event.target.value);changed()}} placeholder="Основание, номер накладной или комментарий"/></label>
   {doc?.status==='Проведён'&&doc.type==='Приход'&&<p className="inventory-document-hint">Для возврата прихода создайте документ «Возврат поставщику». История и закупочная себестоимость сохраняются.</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   {discard?<div className="inventory-document-discard"><p>Закрыть без сохранения изменений?</p><button type="button" onClick={()=>setDiscard(false)}>Продолжить редактирование</button><button type="button" onClick={close}>Закрыть без сохранения</button></div>:<div className="modal-footer"><button type="button" onClick={()=>{if(dirty&&!readOnly)setDiscard(true);else close()}}>{readOnly?'Закрыть':'Отмена'}</button>{!readOnly&&<><button type="submit" data-permission={action} value="draft">Сохранить черновик</button><button className="primary" type="submit" data-permission="inventory" disabled={!allow('inventory')} value="post"><Check size={15}/>Сохранить и провести</button></>}{readOnly&&doc?.status==='Черновик'&&<button type="button" data-permission="inventory" disabled={!allow('inventory')} onClick={()=>onAsk(doc.id,'post')}>Провести документ</button>}</div>}
  </form>
 </Modal>
}

export function InventoryReceipt({sale,state,close}:{sale:Sale;state:InventoryState;close:()=>void}){
 return <Modal title={'Чек '+sale.id} close={close} wide><div className="inventory-document-editor-status"><Badge>{sale.status}</Badge><span>{new Date(sale.date).toLocaleString('ru-RU')}</span><span>{state.warehouses.find(warehouse=>warehouse.id===sale.warehouse)?.name||sale.warehouse}</span></div><div className="table-scroll"><table className="os-table"><thead><tr><th>Товар</th><th>Продано</th><th>Возвращено</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>{sale.items.map(item=><tr key={item.productId}><td>{item.name}</td><td>{item.quantity}</td><td>{item.returned}</td><td>{money(item.price)}</td><td>{money(item.quantity*item.price)}</td></tr>)}</tbody></table></div><div className="inventory-document-total"><span>Скидка {money(sale.discount)} · Возвраты {money(sale.refunds)}</span><strong>{money(sale.total-sale.refunds)}</strong></div><h3>Оплата</h3>{Object.entries(sale.payments).map(([method,value])=><div className="report-row" key={method}><span>{method}</span><b>{money(value)}</b></div>)}{Boolean(sale.refundHistory?.length)&&<><h3>История возвратов</h3>{sale.refundHistory?.map(refund=><div className="report-row" key={refund.id}><span>{refund.reason}<small>{new Date(refund.date).toLocaleString('ru-RU')} · {refund.cashier}</small></span><b>{money(refund.amount)}</b></div>)}</>}<div className="modal-footer"><button onClick={close}>Закрыть</button></div></Modal>
}
