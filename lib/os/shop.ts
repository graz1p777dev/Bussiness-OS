import {stockTotal,type Product} from './inventory-model.ts';
import {validCalendarDate,validCalendarTime} from './calendar.ts';

export const initialStorefront={published:false,title:'DemiResults · Каталог',description:'Уход и косметика с заботой о вас'};
export const shopStatuses={new:'Новый',confirmed:'Подтверждён',completed:'Выполнен',cancelled:'Отменён'};
export const shopDeliveries={pickup:'Самовывоз',yandex:'Yandex Delivery',manager:'Согласовать с менеджером'};
export const shopPayments={mbank_qr:'MBANK QR',manager:'Согласовать с менеджером'};
export type ShopCart=Record<string,number>;
export type ShopCheckout={customerName:string;phone:string;address:string;comment:string;deliveryMethod:keyof typeof shopDeliveries;paymentMethod:keyof typeof shopPayments};
export type ShopOrder=ShopCheckout&{id:string;number:number;date:string;status:keyof typeof shopStatuses;items:{productId:string;name:string;quantity:number;unitPrice:number;total:number}[];total:number};
export const emptyCheckout:ShopCheckout={customerName:'',phone:'',address:'',comment:'',deliveryMethod:'pickup',paymentMethod:'manager'};
export function shopPrice(product:Product){return Math.round(product.price*(1-Math.min(100,Math.max(0,product.discount||0))/100)*100)/100}
export function shopProducts(products:Product[]){return products.filter(product=>!product.deleted&&!['service','Услуга'].includes(product.productType||''))}
export function shopAvailable(product:Product){return Math.max(0,Math.floor(stockTotal(product)))}
export function shopRecommendations(products:Product[],request:string){
 const text=request.toLocaleLowerCase();
 const groups=[{request:/spf|солн|защит/,catalogue:/spf|sun|солн/},{request:/очищ|умыва|clean/,catalogue:/clean|очищ|умыва/},{request:/увлаж|сух|крем|cream/,catalogue:/cream|крем|увлаж|toner|тонер/},{request:/сывор|serum|essence/,catalogue:/serum|essence|сывор/}].filter(group=>group.request.test(text));
 return shopProducts(products).filter(product=>shopAvailable(product)>0&&groups.some(group=>group.catalogue.test([product.name,product.category,product.description].join(' ').toLocaleLowerCase()))).slice(0,3);
}
export function createShopOrder(orders:ShopOrder[],products:Product[],cart:ShopCart,checkout:ShopCheckout,id:string,date:string):ShopOrder[]{
 if(orders.some(order=>order.id===id))throw new Error('Этот заказ уже оформлен.');
 const customerName=checkout.customerName.trim(),phone=checkout.phone.trim(),address=checkout.address.trim(),comment=checkout.comment.trim();
 if(customerName.length<2||customerName.length>120)throw new Error('Укажите имя от 2 до 120 символов.');
 if(phone.replace(/\D/g,'').length<9||phone.length>30)throw new Error('Укажите номер телефона с кодом страны.');
 if(!(checkout.deliveryMethod in shopDeliveries)||!(checkout.paymentMethod in shopPayments))throw new Error('Выберите получение и оплату.');
 if(checkout.deliveryMethod==='yandex'&&address.length<5)throw new Error('Укажите адрес доставки.');
 if(address.length>300||comment.length>500)throw new Error('Сократите адрес или комментарий.');
 const entries=Object.entries(cart).filter(([,quantity])=>quantity!==0);
 if(!entries.length||entries.length>50)throw new Error('Добавьте от 1 до 50 товаров.');
 const catalogue=shopProducts(products);
 const items=entries.map(([productId,quantity])=>{
  const product=catalogue.find(product=>product.id===productId);
  if(!product)throw new Error('Товар больше недоступен. Удалите его из корзины.');
  if(!Number.isInteger(quantity)||quantity<1||quantity>99||quantity>shopAvailable(product))throw new Error('Проверьте количество: '+product.name);
  const unitPrice=shopPrice(product);
  if(!Number.isFinite(unitPrice)||unitPrice<0)throw new Error('Цена товара недоступна: '+product.name);
  return {productId,name:product.name,quantity,unitPrice,total:Math.round(unitPrice*quantity*100)/100};
 });
 const order:ShopOrder={...checkout,customerName,phone,address,comment,id,date,number:Math.max(1000,...orders.map(order=>order.number))+1,status:'new',items,total:items.reduce((sum,item)=>sum+Math.round(item.total*100),0)/100};
 return [order,...orders];
}
export function changeShopOrderStatus(orders:ShopOrder[],id:string,status:ShopOrder['status']){
 if(!(status in shopStatuses)||!orders.some(order=>order.id===id))throw new Error('Заказ или статус не найден.');
 return orders.map(order=>order.id===id?{...order,status}:order);
}
export function shopConsultation(fields:{client:string;phone:string;date:string;time:string;format:string;concern:string},id:string,today:string){
 if(fields.client.trim().length<2||fields.client.length>120||fields.phone.replace(/\D/g,'').length<9||fields.phone.length>30)throw new Error('Укажите имя и телефон для связи.');
 if(!validCalendarDate(fields.date)||fields.date<today||!validCalendarTime(fields.time))throw new Error('Выберите дату и время будущей консультации.');
 if(!['Онлайн','Офлайн'].includes(fields.format)||fields.concern.trim().length<5||fields.concern.length>800)throw new Error('Выберите формат и опишите ваш вопрос (от 5 символов).');
 return {id,client:fields.client.trim(),employee:'',date:fields.date,time:fields.time,status:'Новая',note:[fields.format,fields.phone.trim(),fields.concern.trim(),'Заявка с витрины'].join('\n')};
}
