import type {Entity} from './data.ts';
import type {Sale} from './inventory-model.ts';
export type CustomerCoupon={id:string;customerId:string;code:string;kind:'percent'|'fixed';value:number;expiresAt:string;active:boolean};
export function couponDiscount(coupon:CustomerCoupon,subtotal:number,customerId:string,date:string){
 if(!coupon.active||coupon.customerId!==customerId)throw new Error('Купон недоступен этому клиенту.');
 if(coupon.expiresAt&&coupon.expiresAt<date.slice(0,10))throw new Error('Срок купона истёк.');
 if(!Number.isFinite(coupon.value)||coupon.value<=0||(coupon.kind==='percent'&&coupon.value>100))throw new Error('Некорректная скидка купона.');
 if(!Number.isFinite(subtotal)||subtotal<0)throw new Error('Некорректная сумма покупки.');
 return Math.round(Math.min(subtotal,coupon.kind==='percent'?subtotal*coupon.value/100:coupon.value)*100)/100;
}
export function customerSales(sales:Sale[],customerId:string){return sales.filter(sale=>sale.customerId===customerId)}
export function customerPurchaseSummary(sales:Sale[],customerId:string){const purchases=customerSales(sales,customerId);return {count:purchases.length,spent:purchases.reduce((total,sale)=>total+sale.total-sale.refunds,0),products:[...new Set(purchases.flatMap(sale=>sale.items.filter(item=>item.quantity>item.returned).map(item=>item.productId)))]}}
export function customerDealIds(deals:Entity[],customerId:string){return deals.filter(deal=>(deal.customerId||deal.id)===customerId).map(deal=>deal.id)}
