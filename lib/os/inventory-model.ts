import {isStockTrackedProduct} from './product-options.ts';
export type Product={id:string;name:string;sku:string;barcode:string;category:string;price:number;cost:number;unit:string;minimum:number;stocks:Record<string,number>;deleted:boolean;image?:string;productType?:string;isFreePrice?:boolean;code?:string;gtin?:string;country?:string;description?:string;height?:number;width?:number;depth?:number;weight?:number;markup?:number;discount?:number;weighted?:boolean;taxIncluded?:boolean};
export type Warehouse={id:string;name:string;address:string};
export type StockDocument={id:string;type:string;productId:string;warehouse:string;target:string;quantity:number;cost:number;date:string;note:string;status:'Черновик'|'Проведён'|'Отменён';supplier?:string;items?:{productId:string;quantity:number;cost:number}[];deltas?:{productId?:string;warehouse:string;quantity:number}[]};
export type SaleLine={productId:string;name:string;quantity:number;price:number;cost:number;returned:number;tracksStock?:boolean};
export type CartLine={productId:string;quantity:number;price?:number};
export type SaleRefund={id:string;date:string;shiftId:string;cashier:string;reason:string;amount:number;payments:Record<string,number>;quantities:Record<string,number>};
export type Sale={id:string;date:string;shiftId:string;warehouse:string;items:SaleLine[];discount:number;total:number;payments:Record<string,number>;refunds:number;status:string;refundHistory?:SaleRefund[]};
export type Shift={id:string;register:string;warehouse:string;cashier:string;opening:number;opened:string;closed:string;actual:number|null;expected?:number};
export type InventoryState={products:Product[];warehouses:Warehouse[];documents:StockDocument[];sales:Sale[];shifts:Shift[]};
export const initialInventory:InventoryState={products:['Beauty of Joseon SPF 50','COSRX Snail Essence','Anua Heartleaf Toner','Round Lab Cleanser','Skin1004 Centella','Medicube Collagen Cream'].map((name,i)=>({id:'SKU-'+(100+i),name,sku:'SKU-'+(100+i),barcode:'996000000'+String(100+i),category:['SPF','Уход','Тонеры','Очищение','Уход','Кремы'][i],price:1800+i*350,cost:950+i*180,unit:'шт.',minimum:5,stocks:{main:[4,6,32,48,25,18][i],reserve:0},deleted:false})),warehouses:[{id:'main',name:'Основной склад',address:'Бишкек'},{id:'reserve',name:'Резервный склад',address:'Онлайн-магазин'}],documents:[],sales:[],shifts:[]};
export const documentTypes=['Приход','Расход','Перемещение','Инвентаризация','Списание','Возврат поставщику','Возврат от клиента'];
const finite=(n:number)=>Number.isFinite(n)&&n>=0;
export function stockTotal(p:Product){return Object.values(p.stocks).reduce((a,b)=>a+b,0)}
export function postDocument(state:InventoryState,id:string):InventoryState{
 const doc=state.documents.find(d=>d.id===id);
 if(!doc||doc.status!=='Черновик')throw new Error('Документ уже проведён или недоступен.');
 if(!documentTypes.includes(doc.type))throw new Error('Неизвестный тип документа.');
 if(!state.warehouses.some(w=>w.id===doc.warehouse))throw new Error('Склад не найден.');
 if(doc.type==='Перемещение'&&(doc.target===doc.warehouse||!state.warehouses.some(w=>w.id===doc.target)))throw new Error('Выберите другой склад назначения.');
 const items=doc.items||[{productId:doc.productId,quantity:doc.quantity,cost:doc.cost}];
 if(!items.length||new Set(items.map(i=>i.productId)).size!==items.length)throw new Error('Добавьте уникальные позиции документа.');
 const deltas:{productId:string;warehouse:string;quantity:number}[]=[];
 const updated=new Map<string,Product>();
 for(const item of items){
  const p=state.products.find(p=>p.id===item.productId&&!p.deleted);
  if(!p)throw new Error('Выберите существующий товар.');
  if(!isStockTrackedProduct(p))throw new Error('Услуга не участвует в складских документах: '+p.name);
  if(!finite(item.quantity)||(doc.type!=='Инвентаризация'&&item.quantity===0))throw new Error('Укажите корректное количество.');
  if(!finite(item.cost))throw new Error('Укажите корректную себестоимость.');
  let quantity=item.quantity;
  if(['Расход','Списание','Возврат поставщику','Перемещение'].includes(doc.type))quantity=-quantity;
  if(doc.type==='Инвентаризация')quantity=item.quantity-(p.stocks[doc.warehouse]||0);
  const movement=[{productId:p.id,warehouse:doc.warehouse,quantity}];
  if(doc.type==='Перемещение')movement.push({productId:p.id,warehouse:doc.target,quantity:item.quantity});
  const stocks={...p.stocks};
  for(const d of movement){stocks[d.warehouse]=Math.round(((stocks[d.warehouse]||0)+d.quantity)*1000)/1000;if(stocks[d.warehouse]<0)throw new Error('Недостаточно товара: '+p.name)}
  const oldTotal=stockTotal(p),newTotal=Object.values(stocks).reduce((a,b)=>a+b,0);
  const cost=doc.type==='Приход'&&newTotal>0?(oldTotal*p.cost+item.quantity*item.cost)/newTotal:p.cost;
  updated.set(p.id,{...p,stocks,cost});deltas.push(...movement);
 }
 return {...state,products:state.products.map(p=>updated.get(p.id)||p),documents:state.documents.map(x=>x.id===id?{...x,status:'Проведён',deltas}:x)};
}
export function cancelDocument(state:InventoryState,id:string):InventoryState{
 const doc=state.documents.find(d=>d.id===id);
 if(!doc||doc.status!=='Проведён'||!doc.deltas)throw new Error('Документ нельзя отменить.');
 if(doc.type==='Приход')throw new Error('Для отмены прихода оформите возврат поставщику.');
 const stocksByProduct=new Map<string,Record<string,number>>();
 for(const d of doc.deltas){const productId=d.productId||doc.productId;const p=state.products.find(p=>p.id===productId)!;const stocks=stocksByProduct.get(productId)||{...p.stocks};stocks[d.warehouse]=Math.round(((stocks[d.warehouse]||0)-d.quantity)*1000)/1000;if(stocks[d.warehouse]<0)throw new Error('Отмена приведёт к отрицательному остатку.');stocksByProduct.set(productId,stocks)}
 return {...state,products:state.products.map(p=>stocksByProduct.has(p.id)?{...p,stocks:stocksByProduct.get(p.id)!}:p),documents:state.documents.map(x=>x.id===id?{...x,status:'Отменён'}:x)};
}
export function completeSale(state:InventoryState,lines:CartLine[],discount:number,payments:Record<string,number>,id:string,date:string):InventoryState{
 const shift=state.shifts.find(s=>!s.closed);if(!shift)throw new Error('Сначала откройте смену.');
 if(!lines.length)throw new Error('Добавьте товары в чек.');
 if(new Set(lines.map(l=>l.productId)).size!==lines.length)throw new Error('Товар повторяется в чеке.');
 const items=lines.map(line=>{
  const p=state.products.find(p=>p.id===line.productId&&!p.deleted);
  if(!p||!finite(line.quantity)||!line.quantity)throw new Error('Проверьте товары и количество.');
  const tracksStock=isStockTrackedProduct(p);
  if(tracksStock&&line.quantity>(p.stocks[shift.warehouse]||0))throw new Error('Недостаточно товара: '+p.name);
  if(line.price!==undefined&&line.price!==p.price&&!p.isFreePrice)throw new Error('Для изменения цены включите свободную цену в карточке товара.');
  const price=line.price??p.price;
  if(!finite(price)||Math.abs(price*100-Math.round(price*100))>.000001)throw new Error('Укажите цену с точностью до двух знаков после запятой.');
  return {productId:p.id,name:p.name,quantity:line.quantity,price,cost:p.cost,returned:0,tracksStock};
 });
 const subtotal=items.reduce((s,l)=>s+l.price*l.quantity,0);
 if(!finite(discount)||discount>subtotal)throw new Error('Скидка превышает сумму чека.');
 const total=Math.round((subtotal-discount)*100)/100;
 const paid=Object.values(payments).reduce((a,b)=>a+b,0);
 if(Object.values(payments).some(n=>!finite(n))||Math.abs(paid-total)>.009)throw new Error('Сумма оплат должна совпадать с итогом чека.');
 if(state.sales.some(s=>s.id===id))throw new Error('Этот чек уже сохранён.');
 return {...state,products:state.products.map(p=>{
  const item=items.find(i=>i.productId===p.id);
  return item?.tracksStock?{...p,stocks:{...p.stocks,[shift.warehouse]:Math.round(((p.stocks[shift.warehouse]||0)-item.quantity)*1000)/1000}}:p;
 }),sales:[{id,date,shiftId:shift.id,warehouse:shift.warehouse,items,discount,total,payments,refunds:0,status:'Оплачен'},...state.sales]};
}
function refundPayments(sale:Sale,amount:number){
 const entries=Object.entries(sale.payments).filter(([,value])=>value>0);const total=entries.reduce((sum,[,value])=>sum+value,0);let remaining=Math.round(amount*100);
 return Object.fromEntries(entries.map(([method,value],index)=>{const cents=index===entries.length-1?remaining:Math.min(remaining,Math.round(amount*100*value/total));remaining-=cents;return [method,cents/100]}));
}
export function paymentTotals(state:InventoryState,shiftId?:string){
 const totals:Record<string,number>={Наличные:0,Карта:0,QR:0};
 const add=(payments:Record<string,number>,sign:number)=>{for(const [method,value] of Object.entries(payments))totals[method]=(totals[method]||0)+sign*value};
 for(const sale of state.sales){
  if(!shiftId||sale.shiftId===shiftId)add(sale.payments,1);
  for(const refund of sale.refundHistory||[])if(!shiftId||refund.shiftId===shiftId)add(refund.payments,-1);
  const legacy=Math.max(0,sale.refunds-(sale.refundHistory||[]).reduce((sum,refund)=>sum+refund.amount,0));
  if(legacy&&(!shiftId||sale.shiftId===shiftId))add(refundPayments(sale,legacy),-1);
 }
 return Object.fromEntries(Object.entries(totals).map(([method,value])=>[method,Math.round(value*100)/100]));
}
export function openShift(state:InventoryState,shift:Shift):InventoryState{
 if(state.shifts.some(existing=>!existing.closed))throw new Error('Смена уже открыта.');
 if(!shift.register.trim()||!shift.cashier.trim())throw new Error('Выберите кассу и кассира.');
 if(!state.warehouses.some(warehouse=>warehouse.id===shift.warehouse))throw new Error('Склад не найден.');
 if(!finite(shift.opening))throw new Error('Укажите корректные начальные наличные.');
 if(state.shifts.some(existing=>existing.id===shift.id))throw new Error('Эта смена уже сохранена.');
 return {...state,shifts:[{...shift,closed:'',actual:null},...state.shifts]};
}
export function closeShift(state:InventoryState,id:string,actual:number,date:string):InventoryState{
 const shift=state.shifts.find(existing=>existing.id===id&&!existing.closed);if(!shift)throw new Error('Смена уже закрыта или недоступна.');
 if(!finite(actual))throw new Error('Укажите корректные фактические наличные.');
 const expected=Math.round((shift.opening+(paymentTotals(state,id).Наличные||0))*100)/100;
 return {...state,shifts:state.shifts.map(existing=>existing.id===id?{...existing,actual,expected,closed:date}:existing)};
}
export function refundSale(state:InventoryState,id:string,quantities:Record<string,number>,details?:{id:string;date:string;reason:string}):InventoryState{
 const shift=state.shifts.find(existing=>!existing.closed);if(!shift)throw new Error('Откройте смену перед возвратом.');
 const sale=state.sales.find(existing=>existing.id===id);if(!sale)throw new Error('Чек не найден.');
 if(details&&!details.reason.trim())throw new Error('Укажите причину возврата.');
 if(details&&state.sales.some(existing=>existing.refundHistory?.some(refund=>refund.id===details.id)))throw new Error('Этот возврат уже сохранён.');
 if(Object.entries(quantities).some(([productId,quantity])=>quantity!==0&&!sale.items.some(item=>item.productId===productId)))throw new Error('Позиция не принадлежит выбранной продаже.');
 const items=sale.items.map(item=>{const quantity=quantities[item.productId]??0;if(!finite(quantity)||Math.round(quantity*1000)>Math.round((item.quantity-item.returned)*1000))throw new Error('Количество возврата превышает остаток позиции.');return {...item,returned:Math.round((item.returned+quantity)*1000)/1000}});
 const subtotal=sale.items.reduce((sum,item)=>sum+item.price*item.quantity,0);
 const refundedValue=items.reduce((sum,item)=>sum+item.returned*item.price,0);
 const refunds=Math.round(refundedValue*(subtotal?sale.total/subtotal:0)*100)/100;const amount=Math.round((refunds-sale.refunds)*100)/100;
 if(!items.some((item,index)=>item.returned>sale.items[index].returned))throw new Error('Укажите количество для возврата.');
 const history:SaleRefund={id:details?.id||id+'-refund-'+((sale.refundHistory?.length||0)+1),date:details?.date||new Date().toISOString(),shiftId:shift.id,cashier:shift.cashier,reason:details?.reason.trim()||'Возврат товара',amount,payments:{Наличные:amount},quantities:{...quantities}};
 return {...state,products:state.products.map(product=>quantities[product.id]&&sale.items.find(item=>item.productId===product.id)?.tracksStock!==false?{...product,stocks:{...product.stocks,[sale.warehouse]:Math.round(((product.stocks[sale.warehouse]||0)+quantities[product.id])*1000)/1000}}:product),sales:state.sales.map(existing=>existing.id===id?{...existing,items,refunds,refundHistory:[...(existing.refundHistory||[]),history],status:items.every(item=>item.returned===item.quantity)?'Возвращён':'Частичный возврат'}:existing)};
}
