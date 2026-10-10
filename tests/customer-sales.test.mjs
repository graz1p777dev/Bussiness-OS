import test from 'node:test';
import assert from 'node:assert/strict';
import {customerIdForDeal,normalizeCustomers,searchCustomers,createCustomerDeal,updateCustomerContact} from '../lib/os/customers.ts';
import {initialInventory,completeSale,refundSale} from '../lib/os/inventory-model.ts';
import {couponDiscount} from '../lib/os/customer-relations.ts';
const first={id:'d1',name:'Айжан Токтосунова',phone:'+996 (555) 123-456',value:1200,status:'Неразобранное',channel:'WhatsApp',owner:'Айым',note:'Не звонить утром',customFields:{email:'client@example.test'},tags:['SPF'],createdAt:'2026-10-01'};
const withShift=()=>({...structuredClone(initialInventory),shifts:[{id:'shift',register:'Основная касса',warehouse:'main',cashier:'Айым',opening:0,opened:'2026-10-07',closed:'',actual:null}]});
const lines=[{productId:'SKU-100',quantity:2}];

test('customer identity survives contact edits and joins only explicit customer IDs',()=>{
 const renamed={...first,name:'Другое имя',phone:'+996 700 987654'};
 assert.equal(customerIdForDeal(first),customerIdForDeal(renamed));
 const repeated={...first,id:'d2',customerId:'d1',note:'Другая сделка'};
 const sameContact={...first,id:'d3'};
 const source=[first,repeated,sameContact];
 const original=structuredClone(source),customers=normalizeCustomers(source);
 assert.equal(customers.length,2);
 assert.equal(customers[0].id,'d1');
 assert.deepEqual(customers[0].dealIds,['d1','d2']);
 assert.equal(customers[0].note,first.note);
 assert.deepEqual(customers[0].customFields,first.customFields);
 assert.deepEqual(customers[0].tags,first.tags);
 assert.deepEqual(source,original);
 assert.deepEqual(normalizeCustomers([renamed,repeated])[0].dealIds,['d1','d2']);
});

test('customer lookup supports case-insensitive names and formatted phone fragments',()=>{
 const customers=normalizeCustomers([first,{...first,id:'other',name:'Медина',phone:'+996 700 987654'}]);
 assert.deepEqual(searchCustomers(customers,'айЖАН').map(customer=>customer.id),['d1']);
 assert.deepEqual(searchCustomers(customers,'+996 (555)').map(customer=>customer.id),['d1']);
 assert.deepEqual(searchCustomers(customers,'123-456').map(customer=>customer.id),['d1']);
 assert.equal(searchCustomers(customers,'неизвестный').length,0);
 assert.equal(searchCustomers(customers,'').length,2);
});

test('POS creation produces a shared CRM record and rejects duplicate phone or ID without mutation',()=>{
 const source=[first],before=structuredClone(source);
 const customer=createCustomerDeal(source,{name:'  Новый клиент  ',phone:'+996 700 765432',owner:'Айым',stage:'Консультация'},'new','2026-10-07');
 assert.equal(customer.name,'Новый клиент');
 assert.equal(customer.customerId,customer.id);
 assert.equal(customer.value,0);
 assert.equal(customer.channel,'Касса');
 assert.equal(customer.status,'Консультация');
 assert.equal(normalizeCustomers([customer,...source])[0].id,'new');
 assert.deepEqual(source,before);
 assert.throws(()=>createCustomerDeal(source,{name:'Другой',phone:'996555123456'},'new','date'),/уже есть в CRM/);
 assert.throws(()=>createCustomerDeal(source,{name:'Другой',phone:''},'d1','date'),/ID уже существует/);
 assert.throws(()=>createCustomerDeal(source,{name:'А',phone:''},'new','date'),/имя/);
 assert.throws(()=>createCustomerDeal(source,{name:'Другой',phone:'abc123'},'new','date'),/номер/);
});

test('sale captures customer and coupon snapshots, while refunds retain the same relation',()=>{
 const source=withShift(),customer={customerId:'d1',customerName:first.name,customerPhone:first.phone,couponId:'coupon',couponCode:'AJAN10'};
 const coupon={id:'coupon',customerId:'d1',code:'AJAN10',kind:'percent',value:10,expiresAt:'2026-10-08',active:true};
 const discount=couponDiscount(coupon,3600,'d1','2026-10-07');
 const sold=completeSale(source,lines,discount,{Наличные:3240},'sale','2026-10-07',customer);
 assert.equal(sold.sales[0].customerId,'d1');
 assert.equal(sold.sales[0].customerName,first.name);
 assert.equal(sold.sales[0].customerPhone,first.phone);
 assert.equal(sold.sales[0].couponId,'coupon');
 assert.equal(sold.sales[0].couponCode,'AJAN10');
 customer.customerName='Переименован';
 assert.equal(sold.sales[0].customerName,first.name);
 const returned=refundSale(sold,'sale',{'SKU-100':1});
 assert.equal(returned.sales[0].customerId,'d1');
 assert.equal(returned.sales[0].customerName,first.name);
 assert.equal(returned.sales[0].refunds,1620);
 assert.equal(source.products[0].stocks.main,4);
 assert.equal(source.sales.length,0);
});

test('legacy anonymous sales remain anonymous and incomplete links reject the whole sale',()=>{
 const source=withShift(),anonymous=completeSale(source,lines,0,{Наличные:3600},'anonymous','date');
 assert.equal(Object.hasOwn(anonymous.sales[0],'customerId'),false);
 assert.equal(Object.hasOwn(anonymous.sales[0],'couponId'),false);
 for(const customer of [{customerId:'',customerName:'Айжан'},{customerId:'d1',customerName:' '}])assert.throws(()=>completeSale(source,lines,0,{Наличные:3600},'invalid','date',customer),/Выберите существующего клиента/);
 assert.equal(source.products[0].stocks.main,4);
 assert.deepEqual(source.sales,[]);
});

test('contact editing updates linked deals without changing commercial fields or unrelated customers',()=>{
 const linked={...first,id:'d2',customerId:'d1',value:600,status:'Оплата',note:'Другая покупка'},other={...first,id:'d3'};
 const source=[first,linked,other],before=structuredClone(source);
 const result=updateCustomerContact(source,'d1',{name:'Новое имя',phone:'+996700123456',username:'new',city:'Бишкек',customFields:{email:'new@example.test'}});
 assert.equal(result[0].name,'Новое имя');assert.equal(result[1].name,'Новое имя');
 assert.equal(result[1].value,600);assert.equal(result[1].status,'Оплата');assert.equal(result[1].note,'Другая покупка');
 assert.deepEqual(result[2],other);assert.deepEqual(source,before);
});
