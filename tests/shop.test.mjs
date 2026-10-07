import test from 'node:test';
import assert from 'node:assert/strict';
import {initialInventory} from '../lib/os/inventory-model.ts';
import {createShopOrder,changeShopOrderStatus,shopPrice,shopProducts,shopConsultation,emptyCheckout} from '../lib/os/shop.ts';
const buyer={...emptyCheckout,customerName:'Тест Клиент',phone:'+996 555 111 222'};
test('shop checks current stock and prices, snapshots lines and never mutates inventory',()=>{
 const state=structuredClone(initialInventory),p=state.products[0];p.price=100.10;p.discount=15;
 const before=structuredClone(state),orders=createShopOrder([],state.products,{[p.id]:2},buyer,'order1','2026-10-07T10:00:00Z');
 assert.equal(shopPrice(p),85.09);assert.equal(orders[0].total,170.18);assert.deepEqual(state,before);
 p.price=200;p.name='Новое название';assert.equal(orders[0].items[0].unitPrice,85.09);assert.equal(orders[0].items[0].name,before.products[0].name);
 for(const status of ['confirmed','completed','cancelled'])assert.equal(changeShopOrderStatus(orders,'order1',status)[0].status,status);
 assert.deepEqual(state.products[0].stocks,before.products[0].stocks);
 assert.throws(()=>createShopOrder(orders,state.products,{[p.id]:1},buyer,'order1','2026-10-07'),/уже/);
 assert.throws(()=>createShopOrder([],state.products,{[p.id]:5},buyer,'x','2026-10-07'),/количество/);
 assert.throws(()=>createShopOrder([],state.products,{[p.id]:.5},buyer,'x','2026-10-07'),/количество/);
});
test('shop rejects services, deleted products, invalid buyer and incomplete delivery',()=>{
 const products=structuredClone(initialInventory.products),p=products[0];
 p.productType='service';assert.equal(shopProducts(products).length,5);assert.throws(()=>createShopOrder([],products,{[p.id]:1},buyer,'x','2026-10-07'),/недоступен/);
 p.productType='kit';assert.equal(shopProducts(products).length,6);
 p.deleted=true;assert.throws(()=>createShopOrder([],products,{[p.id]:1},buyer,'x','2026-10-07'),/недоступен/);
 p.deleted=false;
 assert.throws(()=>createShopOrder([],products,{[p.id]:1},{...buyer,phone:'123'},'x','2026-10-07'),/телефона/);
 assert.throws(()=>createShopOrder([],products,{[p.id]:1},{...buyer,deliveryMethod:'yandex'},'x','2026-10-07'),/адрес/);
 assert.throws(()=>createShopOrder([],products,{},buyer,'x','2026-10-07'),/Добавьте/);
});
test('shop consultation enters the existing calendar schema and rejects impossible or past dates',()=>{
 const fields={client:'Тест Клиент',phone:buyer.phone,date:'2026-10-08',time:'14:30',format:'Онлайн',concern:'Подбор ухода'};
 const record=shopConsultation(fields,'consultation1','2026-10-07');assert.equal(record.client,fields.client);assert.equal(record.date,fields.date);assert.ok(record.note.includes(fields.phone));assert.equal(record.employee,'');
 for(const date of ['2026-10-06','2026-02-30',''])assert.throws(()=>shopConsultation({...fields,date},'x','2026-10-07'),/дату/);
 assert.throws(()=>shopConsultation({...fields,time:'25:00'},'x','2026-10-07'),/время/);
});
