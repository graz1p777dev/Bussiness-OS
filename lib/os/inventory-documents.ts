import {documentTypes,postDocument,cancelDocument,type InventoryState,type StockDocument} from './inventory-model.ts';
import {isStockTrackedProduct} from './product-options.ts';
import type {ActionPermissions} from './team.ts';

export type DocumentItem={productId:string;quantity:number;cost:number;name?:string;sku?:string;unit?:string;referencePrice?:number;stockBefore?:number};
export type DocumentFilters={query:string;type:string;status:string;warehouse:string;from:string;to:string};
export const emptyDocumentFilters:DocumentFilters={query:'',type:'',status:'',warehouse:'',from:'',to:''};
export const documentStatuses=['Черновик','Проведён','Отменён'] as const;
export const purchaseDocument=(type:string)=>['Приход','Возврат поставщику'].includes(type);
export const pricedDocument=(type:string)=>purchaseDocument(type)||['Расход','Возврат от клиента'].includes(type);
export function documentItems(doc:StockDocument):DocumentItem[]{return doc.items||[{productId:doc.productId,quantity:doc.quantity,cost:doc.cost}]}
function requirePermission(permissions:Partial<ActionPermissions>|undefined,action:keyof ActionPermissions){if(permissions&&permissions[action]!==true)throw new Error('Недостаточно прав для этого действия.')}
function validDate(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const parsed=new Date(date+'T12:00:00Z');return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date}
export function saveDocumentDraft(state:InventoryState,doc:StockDocument,mode:'create'|'edit',permissions?:Partial<ActionPermissions>):InventoryState{
 requirePermission(permissions,mode);
 const existing=state.documents.find(row=>row.id===doc.id);
 if(mode==='create'&&existing)throw new Error('Документ с таким номером уже существует.');
 if(mode==='edit'&&(!existing||existing.status!=='Черновик'))throw new Error('Изменить можно только существующий черновик.');
 if(!doc.id.trim()||!documentTypes.includes(doc.type))throw new Error('Выберите тип документа.');
 if(!validDate(doc.date))throw new Error('Укажите корректную дату документа.');
 if(!state.warehouses.some(warehouse=>warehouse.id===doc.warehouse))throw new Error('Выберите существующий склад.');
 if(doc.type==='Перемещение'&&(doc.target===doc.warehouse||!state.warehouses.some(warehouse=>warehouse.id===doc.target)))throw new Error('Выберите другой склад назначения.');
 const input=documentItems(doc);
 if(!input.length)throw new Error('Добавьте хотя бы один товар.');
 if(new Set(input.map(item=>item.productId)).size!==input.length)throw new Error('Товар повторяется. Измените количество в существующей позиции.');
 const items:DocumentItem[]=input.map(item=>{
  const product=state.products.find(product=>product.id===item.productId&&!product.deleted);
  if(!product)throw new Error('Выберите существующий товар для каждой позиции.');
  if(!isStockTrackedProduct(product))throw new Error('Услуги не участвуют в складских документах.');
  if(!Number.isFinite(item.quantity)||item.quantity<0||(doc.type!=='Инвентаризация'&&item.quantity===0)||Math.abs(item.quantity*1000-Math.round(item.quantity*1000))>1e-7)throw new Error('Количество должно быть положительным и содержать не больше 3 знаков после запятой. Для инвентаризации допустим ноль.');
  if(!Number.isFinite(item.cost)||item.cost<0)throw new Error('Укажите корректную закупочную цену.');
  return {productId:product.id,quantity:item.quantity,cost:item.cost,name:product.name,sku:product.sku,unit:product.unit,referencePrice:product.price};
 });
 const saved:StockDocument={id:doc.id,type:doc.type,productId:items[0].productId,quantity:Math.round(items.reduce((sum,item)=>sum+item.quantity,0)*1000)/1000,cost:items[0].cost,items,warehouse:doc.warehouse,target:doc.type==='Перемещение'?doc.target:'',date:doc.date,note:doc.note.trim(),supplier:purchaseDocument(doc.type)?doc.supplier?.trim()||'':'',status:'Черновик'};
 return {...state,documents:mode==='edit'?state.documents.map(row=>row.id===saved.id?saved:row):[saved,...state.documents]};
}
export function deleteDocumentDraft(state:InventoryState,id:string,permissions?:Partial<ActionPermissions>):InventoryState{
 requirePermission(permissions,'remove');
 const doc=state.documents.find(row=>row.id===id);
 if(!doc||doc.status!=='Черновик')throw new Error('Удалить можно только черновик. История проведённых документов сохраняется.');
 return {...state,documents:state.documents.filter(row=>row.id!==id)};
}
export function postStockDocument(state:InventoryState,id:string,permissions?:Partial<ActionPermissions>):InventoryState{
 requirePermission(permissions,'inventory');
 const doc=state.documents.find(row=>row.id===id);
 if(!doc||doc.status!=='Черновик')throw new Error('Документ уже проведён или недоступен.');
 // Freeze product names, reference prices and the pre-posting count in the document, never in catalog data.
 const items:DocumentItem[]=documentItems(doc).map(item=>{const product=state.products.find(product=>product.id===item.productId);return {...item,name:product?.name||item.name,sku:product?.sku||item.sku,unit:product?.unit||item.unit,referencePrice:product?.price??item.referencePrice,stockBefore:product?.stocks[doc.warehouse]||0}});
 return postDocument({...state,documents:state.documents.map(row=>row.id===id?{...row,items}:row)},id);
}
export function cancelStockDocument(state:InventoryState,id:string,permissions?:Partial<ActionPermissions>):InventoryState{
 requirePermission(permissions,'inventory');return cancelDocument(state,id);
}
export function filterStockDocuments(state:InventoryState,filters:DocumentFilters){
 const query=filters.query.trim().toLocaleLowerCase();
 return state.documents.filter(doc=>(!filters.type||doc.type===filters.type)&&(!filters.status||doc.status===filters.status)&&(!filters.warehouse||doc.warehouse===filters.warehouse||(doc.type==='Перемещение'&&doc.target===filters.warehouse))&&(!filters.from||doc.date>=filters.from)&&(!filters.to||doc.date<=filters.to)&&(!query||[doc.id,doc.type,doc.note,doc.supplier,...documentItems(doc).flatMap(item=>{const product=state.products.find(product=>product.id===item.productId);return [item.name,item.sku,product?.name,product?.sku,product?.barcode]})].join(' ').toLocaleLowerCase().includes(query)));
}
