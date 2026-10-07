import test from 'node:test';
import assert from 'node:assert/strict';
import {initialInventory} from '../lib/os/inventory-model.ts';
import {saveDocumentDraft,deleteDocumentDraft,postStockDocument,cancelStockDocument,documentItems,filterStockDocuments,emptyDocumentFilters} from '../lib/os/inventory-documents.ts';
const state=()=>structuredClone(initialInventory);
const draft=(overrides={})=>({id:'DOC-1',type:'Приход',productId:'SKU-100',warehouse:'main',target:'',quantity:2,cost:100,date:'2026-10-06',note:' Test ',supplier:'Beauty Distribution',status:'Черновик',items:[{productId:'SKU-100',quantity:2,cost:100},{productId:'SKU-101',quantity:1,cost:200}],...overrides});
test('draft create/edit/delete changes neither stock nor costs, normalizes totals and rejects posted edits',()=>{
 const original=state();let next=saveDocumentDraft(original,draft(),'create');
 assert.deepEqual(next.products,original.products);assert.equal(next.documents[0].quantity,3);assert.equal(next.documents[0].note,'Test');assert.equal(next.documents[0].items[0].name,original.products[0].name);
 next=saveDocumentDraft(next,draft({items:[{productId:'SKU-101',quantity:5,cost:300}]}),'edit');assert.equal(next.documents[0].quantity,5);assert.equal(next.documents[0].productId,'SKU-101');assert.deepEqual(next.products,original.products);
 assert.throws(()=>saveDocumentDraft(next,draft(),'create'),/существует/);
 assert.equal(deleteDocumentDraft(next,'DOC-1').documents.length,0);
 const posted=postStockDocument(next,'DOC-1');assert.throws(()=>saveDocumentDraft(posted,draft(),'edit'),/черновик/);assert.throws(()=>deleteDocumentDraft(posted,'DOC-1'),/черновик/);
 assert.deepEqual(original,state());
});
test('save and post is atomic for multiple lines, freezes count/reference price, supports transfer cancel',()=>{
 const original=state();const transfer=draft({type:'Перемещение',target:'reserve'});const next=postStockDocument(saveDocumentDraft(original,transfer,'create'),'DOC-1');
 assert.equal(next.products[0].stocks.main,2);assert.equal(next.products[0].stocks.reserve,2);assert.equal(documentItems(next.documents[0])[0].stockBefore,4);assert.equal(documentItems(next.documents[0])[0].referencePrice,1800);
 assert.deepEqual(cancelStockDocument(next,'DOC-1').products,original.products);
 const invalid=draft({type:'Списание',items:[{productId:'SKU-100',quantity:1,cost:100},{productId:'SKU-101',quantity:1000,cost:200}]});
 assert.throws(()=>postStockDocument(saveDocumentDraft(original,invalid,'create'),'DOC-1'),/Недостаточно/);assert.deepEqual(original,state());
 const counted=postStockDocument(saveDocumentDraft(original,draft({type:'Инвентаризация',items:[{productId:'SKU-100',quantity:0,cost:100}]}),'create'),'DOC-1');assert.equal(counted.products[0].stocks.main,0);assert.equal(counted.documents[0].deltas[0].quantity,-4);
});
test('documents validate actual dates, uniqueness, precision and separate editing/posting permissions',()=>{
 for(const changes of [{date:'2026-02-30'},{warehouse:'missing'},{type:'Перемещение',target:'main'},{items:[]},{items:[{productId:'SKU-100',quantity:1,cost:0},{productId:'SKU-100',quantity:1,cost:0}]},{items:[{productId:'SKU-100',quantity:.0004,cost:0}]},{items:[{productId:'SKU-100',quantity:1,cost:NaN}]}])assert.throws(()=>saveDocumentDraft(state(),draft(changes),'create'));
 assert.throws(()=>saveDocumentDraft(state(),draft(),'create',{create:false,inventory:true}),/прав/);
 const next=saveDocumentDraft(state(),draft(),'create',{create:true,inventory:false});assert.throws(()=>postStockDocument(next,'DOC-1',{create:true,inventory:false}),/прав/);assert.throws(()=>saveDocumentDraft(next,draft(),'edit',{create:true,edit:false}),/прав/);assert.throws(()=>deleteDocumentDraft(next,'DOC-1',{inventory:true,remove:false}),/прав/);
 const posted=postStockDocument(next,'DOC-1',{inventory:true,edit:false});assert.equal(posted.documents[0].status,'Проведён');assert.throws(()=>cancelStockDocument(posted,'DOC-1',{inventory:true}),/возврат поставщику/);
});
test('document filters search every item and include transfer destination without discarding legacy documents',()=>{
 let next=saveDocumentDraft(state(),draft({type:'Перемещение',target:'reserve'}),'create');next=saveDocumentDraft(next,draft({id:'DOC-2',date:'2026-10-07',supplier:'Other'}),'create');
 const filters={...emptyDocumentFilters,warehouse:'reserve',query:'sku-101',type:'Перемещение',status:'Черновик',from:'2026-10-06',to:'2026-10-06'};
 assert.deepEqual(filterStockDocuments(next,filters).map(doc=>doc.id),['DOC-1']);assert.equal(filterStockDocuments(next,{...filters,query:'missing'}).length,0);
 const legacy=draft();delete legacy.items;assert.equal(documentItems(legacy)[0].quantity,2);
});
