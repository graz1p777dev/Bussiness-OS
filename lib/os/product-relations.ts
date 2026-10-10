import type {Sale,StockDocument} from './inventory-model.ts';
export function productRelations(productId:string,sales:Sale[],documents:StockDocument[]){
 const receipts=sales.filter(sale=>sale.items.some(line=>line.productId===productId));
 const movements=documents.filter(document=>(document.items||[{productId:document.productId}]).some(line=>line.productId===productId));
 let sold=0,returned=0,revenue=0;
 for(const sale of receipts){
  const subtotal=sale.items.reduce((sum,line)=>sum+line.price*line.quantity,0);
  const paidRatio=subtotal>0?sale.total/subtotal:0;
  for(const line of sale.items.filter(line=>line.productId===productId)){
   sold+=line.quantity;returned+=line.returned;
   revenue+=(line.quantity-line.returned)*line.price*paidRatio;
  }
 }
 return {receipts,movements,sold,returned,revenue:Math.round(revenue*100)/100,customerIds:[...new Set(receipts.flatMap(sale=>sale.customerId?[sale.customerId]:[]))]};
}
