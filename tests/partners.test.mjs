import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPartners,filterPartners,savePartner,setPartnerStatus,savePartnerType,removePartnerType} from '../lib/os/partners.ts';

const date='2026-10-07T05:00:00.000Z';
const input={name:'  Новый партнёр  ',type:'Косметолог',terms:'  Комиссия по договорённости  ',contact:'  @contact  ',status:'active'};
test('partners preserve identity and creation date through editing and pause/resume',()=>{
 const created=savePartner(initialPartners,input,'test',date,'create',{create:true});
 assert.equal(initialPartners.partners.length,3);
 assert.equal(created.partners.at(-1).name,'Новый партнёр');
 const updated=savePartner(created,{...input,name:'Партнёр после правки'},'test','2026-10-08T05:00:00.000Z','edit',{edit:true});
 const paused=setPartnerStatus(updated,'test','inactive',date,{edit:true});
 assert.equal(paused.partners.find(row=>row.id==='test').createdAt,date);
 assert.equal(paused.partners.find(row=>row.id==='test').contact,'@contact');
 assert.equal(paused.partners.find(row=>row.id==='test').status,'inactive');
 assert.equal(setPartnerStatus(paused,'test','active',date,{edit:true}).partners.length,4);
 assert.throws(()=>savePartner(created,input,'test',date,'create'),/идентификатором/);
 assert.throws(()=>savePartner(created,input,'missing',date,'edit'),/больше не доступен/);
});
test('partner filters combine text, historical type and status without changing source order',()=>{
 const snapshot=JSON.stringify(initialPartners);
 assert.equal(filterPartners(initialPartners,{query:'форма',type:'Фитнес',status:'active'}).length,0);
 assert.equal(filterPartners(initialPartners,{query:'FORMA',type:'Фитнес',status:'active'}).length,1);
 assert.equal(filterPartners(initialPartners,{query:'events@example',type:'',status:'inactive'}).length,1);
 assert.equal(filterPartners(initialPartners,{query:'сезонных',type:'Другое',status:'active'}).length,0);
 assert.equal(JSON.stringify(initialPartners),snapshot);
});
test('custom type rename updates assignments; removal preserves partner history and supports later edits',()=>{
 const added=savePartnerType(initialPartners,'Салон','salon','create',{create:true});
 const partner=savePartner(added,{...input,type:'Салон'},'salon-partner',date,'create');
 const renamed=savePartnerType(partner,'Салон красоты','salon','edit',{edit:true});
 assert.equal(renamed.partners.find(row=>row.id==='salon-partner').type,'Салон красоты');
 assert.equal(partner.partners.find(row=>row.id==='salon-partner').type,'Салон');
 const removed=removePartnerType(renamed,'salon',{remove:true});
 assert.equal(removed.partners.find(row=>row.id==='salon-partner').type,'Салон красоты');
 assert.equal(filterPartners(removed,{query:'',type:'Салон красоты',status:''}).length,1);
 assert.doesNotThrow(()=>savePartner(removed,{...input,type:'Салон красоты',contact:'Другой контакт'},'salon-partner',date,'edit'));
 assert.throws(()=>savePartner(removed,{...input,type:'Салон красоты'},'new-after-removal',date,'create'),/справочника/);
});
test('partner mutations reject missing permissions, invalid names/types/statuses and protected type changes',()=>{
 assert.throws(()=>savePartner(initialPartners,input,'test',date,'create',{}),/прав/);
 assert.throws(()=>setPartnerStatus(initialPartners,initialPartners.partners[0].id,'inactive',date,{create:true}),/прав/);
 assert.throws(()=>savePartnerType(initialPartners,'Салон','salon','create',{edit:true}),/прав/);
 assert.throws(()=>removePartnerType(initialPartners,'other',{edit:true}),/прав/);
 assert.throws(()=>savePartner(initialPartners,{...input,name:'  '},'test',date,'create'),/название/);
 assert.throws(()=>savePartner(initialPartners,{...input,type:'Неизвестный'},'test',date,'create'),/справочника/);
 assert.throws(()=>savePartner(initialPartners,{...input,status:'deleted'},'test',date,'create'),/статус/);
 assert.throws(()=>savePartnerType(initialPartners,' косметолог ','duplicate','create'),/уже есть/);
 assert.throws(()=>savePartnerType(initialPartners,'Иное','other','edit'),/Базовый/);
 assert.throws(()=>removePartnerType(initialPartners,'other'),/Базовый/);
});
