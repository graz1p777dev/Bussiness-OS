export type Product={id:string;name:string;sku:string;barcode:string;category:string;price:number;cost:number;unit:string;minimum:number;stocks:Record<string,number>;deleted:boolean;image?:string};
export type Warehouse={id:string;name:string;address:string};
export type StockDocument={id:string;type:string;productId:string;warehouse:string;target:string;quantity:number;cost:number;date:string;note:string;status:'Черновик'|'Проведён'|'Отменён';items?:{productId:string;quantity:number;cost:number}[];deltas?:{productId?:string;warehouse:string;quantity:number}[]};
export type SaleLine={productId:string;name:string;quantity:number;price:number;cost:number;returned:number};
export type Sale={id:string;date:string;shiftId:string;warehouse:string;items:SaleLine[];discount:number;total:number;payments:Record<string,number>;refunds:number;status:string};
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
export function completeSale(state:InventoryState,lines:{productId:string;quantity:number}[],discount:number,payments:Record<string,number>,id:string,date:string):InventoryState{const shift=state.shifts.find(s=>!s.closed);if(!shift)throw new Error('Сначала откройте смену.');if(!lines.length)throw new Error('Добавьте товары в чек.');if(new Set(lines.map(l=>l.productId)).size!==lines.length)throw new Error('Товар повторяется в чеке.');const items=lines.map(line=>{const p=state.products.find(p=>p.id===line.productId&&!p.deleted);if(!p||!finite(line.quantity)||!line.quantity)throw new Error('Проверьте товары и количество.');if(line.quantity>(p.stocks[shift.warehouse]||0))throw new Error('Недостаточно товара: '+p.name);return {productId:p.id,name:p.name,quantity:line.quantity,price:p.price,cost:p.cost,returned:0}});const subtotal=items.reduce((s,l)=>s+l.price*l.quantity,0);if(!finite(discount)||discount>subtotal)throw new Error('Скидка превышает сумму чека.');const total=Math.round((subtotal-discount)*100)/100;const paid=Object.values(payments).reduce((a,b)=>a+b,0);if(Object.values(payments).some(n=>!finite(n))||Math.abs(paid-total)>.009)throw new Error('Сумма оплат должна совпадать с итогом чека.');if(state.sales.some(s=>s.id===id))throw new Error('Этот чек уже сохранён.');return {...state,products:state.products.map(p=>{const item=items.find(i=>i.productId===p.id);return item?{...p,stocks:{...p.stocks,[shift.warehouse]:p.stocks[shift.warehouse]-item.quantity}}:p}),sales:[{id,date,shiftId:shift.id,warehouse:shift.warehouse,items,discount,total,payments,refunds:0,status:'Оплачен'},...state.sales]}}
export function refundSale(state:InventoryState,id:string,quantities:Record<string,number>):InventoryState{const sale=state.sales.find(s=>s.id===id);if(!sale)throw new Error('Чек не найден.');const items=sale.items.map(item=>{const qty=quantities[item.productId]||0;if(!finite(qty)||qty>item.quantity-item.returned)throw new Error('Количество возврата превышает остаток позиции.');return {...item,returned:item.returned+qty}});const returnedSum=sale.items.reduce((s,item)=>s+(quantities[item.productId]||0)*item.price,0);if(!returnedSum)throw new Error('Укажите количество для возврата.');const subtotal=sale.items.reduce((s,i)=>s+i.price*i.quantity,0);const refunds=sale.refunds+returnedSum*(subtotal?sale.total/subtotal:0);return {...state,products:state.products.map(p=>quantities[p.id]?{...p,stocks:{...p.stocks,[sale.warehouse]:(p.stocks[sale.warehouse]||0)+quantities[p.id]}}:p),sales:state.sales.map(s=>s.id===id?{...s,items,refunds:Math.round(refunds*100)/100,status:items.every(i=>i.returned===i.quantity)?'Возвращён':'Частичный возврат'}:s)}}
