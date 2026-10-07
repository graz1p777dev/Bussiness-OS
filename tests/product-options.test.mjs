import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productKind,isStockTrackedProduct,generateProductBarcode} from '../lib/os/product-options.ts';
import {initialInventory,completeSale,refundSale,postDocument} from '../lib/os/inventory-model.ts';

const stateWithProduct=overrides=>{
 const state=structuredClone(initialInventory);
 state.products[0]={...state.products[0],...overrides};
 state.shifts=[{id:'shift',register:'Касса',warehouse:'main',cashier:'Кассир',opening:1000,opened:'2026-10-06',closed:'',actual:null}];
 return state;
};
const line=(quantity,price)=>({productId:'SKU-100',quantity,...(price===undefined?{}:{price})});
const sell=(state,lines,total)=>completeSale(state,lines,0,{Наличные:total},'sale','2026-10-06');

test('canonical and legacy product types preserve stocked catalog data',()=>{
 assert.equal(productKind(undefined),'product');
 assert.equal(productKind({productType:'Товар'}),'product');
 for(const productType of ['Услуга','service'])assert.equal(isStockTrackedProduct({productType}),false);
 for(const productType of ['Комплект','kit']){assert.equal(productKind({productType}),'kit');assert.equal(isStockTrackedProduct({productType}),true)}
});
test('barcode generator creates unique internal EAN-13 with valid checksum',context=>{
 context.mock.method(Math,'random',()=>.123456789);
 const first=generateProductBarcode();
 const second=generateProductBarcode([first]);
 assert.notEqual(first,second);
 for(const barcode of [first,second]){
  assert.match(barcode,/^200\d{10}$/);
  const sum=[...barcode].reduce((sum,digit,index)=>sum+Number(digit)*(index%2===0?1:3),0);
  assert.equal(sum%10,0);
 }
});
test('zero-stock services can be sold and fully refunded without creating stock',()=>{
 const state=stateWithProduct({productType:'service',stocks:{main:0,reserve:0},price:100});
 const sold=sell(state,[line(20)],2000);
 assert.deepEqual(sold.products[0].stocks,{main:0,reserve:0});
 assert.equal(sold.sales[0].items[0].tracksStock,false);
 const partial=refundSale(sold,'sale',{'SKU-100':5});
 assert.equal(partial.sales[0].refunds,500);
 assert.deepEqual(partial.products[0].stocks,{main:0,reserve:0});
 // A receipt keeps its accounting semantics even if external catalog data changes later.
 partial.products[0].productType='product';
 const returned=refundSale(partial,'sale',{'SKU-100':15});
 assert.equal(returned.sales[0].refunds,2000);
 assert.equal(returned.sales[0].status,'Возвращён');
 assert.deepEqual(returned.products[0].stocks,{main:0,reserve:0});
 assert.throws(()=>refundSale(returned,'sale',{'SKU-100':1}),/превышает/);
});
test('kits require stock, support receipts and restore their own stock on refund',()=>{
 const state=stateWithProduct({productType:'kit',price:100,stocks:{main:0,reserve:0}});
 assert.throws(()=>sell(state,[line(1)],100),/Недостаточно/);
 state.documents=[{id:'receipt',type:'Приход',productId:'SKU-100',quantity:3,cost:50,warehouse:'main',target:'',date:'2026-10-06',note:'',status:'Черновик'}];
 const received=postDocument(state,'receipt');
 const sold=sell(received,[line(2)],200);
 assert.equal(sold.products[0].stocks.main,1);
 assert.equal(sold.sales[0].items[0].tracksStock,true);
 const returned=refundSale(sold,'sale',{'SKU-100':2});
 assert.equal(returned.products[0].stocks.main,3);
 assert.equal(returned.sales[0].refunds,200);
 assert.equal(state.products[0].stocks.main,0);
});
test('warehouse documents reject a service atomically',()=>{
 const state=stateWithProduct({productType:'service',stocks:{main:0,reserve:0}});
 state.documents=[{id:'receipt',type:'Приход',productId:'SKU-100',quantity:3,cost:50,warehouse:'main',target:'',date:'2026-10-06',note:'',status:'Черновик'}];
 assert.throws(()=>postDocument(state,'receipt'),/Услуга не участвует/);
 assert.equal(state.products[0].stocks.main,0);
 assert.equal(state.documents[0].status,'Черновик');
});
test('free price is scoped to this sale and discounted refunds retain the chosen price',()=>{
 const state=stateWithProduct({isFreePrice:true,price:100});
 const sold=completeSale(state,[line(2,80)],20,{Наличные:140},'sale','2026-10-06');
 assert.equal(sold.products[0].price,100);
 assert.equal(sold.sales[0].items[0].price,80);
 assert.equal(sold.sales[0].total,140);
 sold.products[0].price=999;
 const partial=refundSale(sold,'sale',{'SKU-100':1});
 assert.equal(partial.sales[0].refunds,70);
 const returned=refundSale(partial,'sale',{'SKU-100':1});
 assert.equal(returned.sales[0].refunds,140);
 assert.equal(returned.products[0].stocks.main,4);
});
test('fixed-price overrides and invalid free prices fail before accounting changes',()=>{
 const fixed=stateWithProduct({price:100});
 assert.throws(()=>sell(fixed,[line(1,80)],80),/свободную цену/);
 assert.equal(sell(fixed,[line(1,100)],100).sales[0].total,100);
 const free=stateWithProduct({isFreePrice:true,price:100});
 for(const price of [-1,NaN,Infinity,1.001])assert.throws(()=>sell(free,[line(1,price)],price),/точностью/);
 assert.equal(free.products[0].stocks.main,4);
 assert.equal(free.sales.length,0);
});
test('a mixed receipt handles free-price services and stocked products independently',()=>{
 const state=stateWithProduct({productType:'service',isFreePrice:true,price:100,stocks:{main:0,reserve:0}});
 const sold=sell(state,[line(2,75),{productId:'SKU-101',quantity:1}],2300);
 assert.equal(sold.products[0].stocks.main,0);
 assert.equal(sold.products[1].stocks.main,5);
 const returned=refundSale(sold,'sale',{'SKU-100':2,'SKU-101':1});
 assert.equal(returned.products[0].stocks.main,0);
 assert.equal(returned.products[1].stocks.main,6);
 assert.equal(returned.sales[0].refunds,2300);
});
