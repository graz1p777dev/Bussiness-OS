import test from 'node:test';
import assert from 'node:assert/strict';
import {initialEmployees} from '../lib/os/team.ts';
import {initialInventory,openShift,completeSale} from '../lib/os/inventory-model.ts';
import {posRecords,assertPosOperation,posOpeningCashier} from '../lib/os/pos-access.ts';
const employees=structuredClone(initialEmployees),actor=employees.find(employee=>employee.id==='aiym');
const scope={actorId:actor.id,ownOnly:true,canReadCompanyFinance:false,canViewCustomers:false};
const shift=(id,cashierId,cashier,closed='2026-10-10T10:00:00Z')=>({id,cashierId,cashier,closed,opened:'2026-10-10T00:00:00Z',opening:0,actual:0,register:'Касса',warehouse:'main'});
const sale=(id,shiftId,total)=>({id,shiftId,total,date:'2026-10-10T01:00:00Z',warehouse:'main',items:[],discount:0,payments:{Наличные:total},refunds:0,status:'Оплачен',customerId:'private',customerName:'Личный клиент',customerPhone:'+996 555',couponId:'personal',couponCode:'PRIVATE'});
const state={...structuredClone(initialInventory),shifts:[shift('own',actor.id,actor.name),shift('other','medina','Медина Осмонова')],sales:[sale('own-check','own',400),sale('other-check','other',900)]};

test('no company finance access keeps own receipts and shifts without exposing client identity or coupons',()=>{
 const result=posRecords(state,employees,scope);
 assert.deepEqual(result.shifts.map(item=>item.id),['own']);
 assert.deepEqual(result.sales.map(item=>item.id),['own-check']);
 assert.equal(result.sales[0].total,400);assert.equal(result.canReadCompanyFinance,false);
 for(const key of ['customerId','customerName','customerPhone','couponId','couponCode'])assert.equal(Object.hasOwn(result.sales[0],key),false);
 assert.equal(state.sales[0].customerName,'Личный клиент');
 assert.deepEqual(posRecords(state,employees,{...scope,ownOnly:false}).sales.map(item=>item.id),['own-check']);
});
test('company reports and customer identity are independent grants; own scope remains narrower',()=>{
 const owner={...scope,actorId:'owner-user',ownOnly:false,canReadCompanyFinance:true};
 const all=posRecords(state,employees,owner);assert.equal(all.sales.length,2);assert.equal(all.canReadCompanyFinance,true);assert.equal(all.sales[0].customerId,undefined);
 assert.equal(posRecords(state,employees,{...scope,canViewCustomers:true}).sales[0].customerId,'private');
 assert.equal(posRecords(state,employees,{...scope,canReadCompanyFinance:true}).sales.length,1);
 const blocked=employees.map(employee=>employee.id===actor.id?{...employee,status:'Заблокирован'}:employee);
 assert.deepEqual(posRecords(state,blocked,scope).sales,[]);
 assert.equal(posRecords(state,blocked,{...scope,canReadCompanyFinance:true}).canReadCompanyFinance,false);
});
test('shift identity survives rename and refuses ambiguous or conflicting legacy names',()=>{
 assert.equal(posRecords(state,employees.map(employee=>employee.id===actor.id?{...employee,name:'Новое имя'}:employee),scope).sales.length,1);
 const legacy={...state,shifts:[{...state.shifts[0],cashierId:undefined,cashier:'Айым'}]};
 assert.equal(posRecords(legacy,employees,scope).sales.length,1);
 assert.equal(posRecords(legacy,[...employees,{...actor,id:'same-name',name:'Айым Другой'}],scope).sales.length,0);
 assert.equal(posRecords({...state,shifts:[{...state.shifts[0],cashierId:'medina'}]},employees,scope).sales.length,0);
});
test('financial mutations require own active shift and an accessible receipt, even if IDs are forged',()=>{
 const ownOpen={...state,shifts:state.shifts.map(item=>item.id==='own'?{...item,closed:''}:item)};
 assert.equal(assertPosOperation(ownOpen,employees,scope,true,'own-check').id,'own');
 assert.throws(()=>assertPosOperation(ownOpen,employees,scope,false,'own-check'),/запрещены/);
 assert.throws(()=>assertPosOperation(ownOpen,employees,scope,true,'other-check'),/недоступен/);
 const otherOpen={...state,shifts:state.shifts.map(item=>item.id==='other'?{...item,closed:''}:item)};
 assert.throws(()=>assertPosOperation(otherOpen,employees,scope,true),/ваша открытая/);
 assert.throws(()=>assertPosOperation(state,employees,scope,true),/ваша открытая/);
});
test('cashiers open only their own shift with stable identity and retain ordinary sale functionality',()=>{
 assert.throws(()=>posOpeningCashier(employees,scope,'medina',true),/только на своё имя/);
 assert.throws(()=>posOpeningCashier(employees,scope,actor.id,false),/запрещены/);
 const cashier=posOpeningCashier(employees,scope,actor.id,true);
 let next=openShift(state,shift('new-own',cashier.id,cashier.name,''));
 assert.equal(next.shifts[0].cashierId,actor.id);
 assertPosOperation(next,employees,scope,true);
 const product=next.products.find(item=>!item.deleted&&item.price>0&&item.stocks.main>0);
 next=completeSale(next,[{productId:product.id,quantity:1}],0,{Наличные:product.price},'new-sale','2026-10-10T13:00:00Z');
 assert.equal(posRecords(next,employees,scope).sales[0].id,'new-sale');
 assert.equal(posRecords(next,employees,scope).sales.some(item=>item.id==='other-check'),false);
});
