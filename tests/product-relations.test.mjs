import test from 'node:test';
import assert from 'node:assert/strict';
import {productRelations} from '../lib/os/product-relations.ts';
test('product joins use IDs and allocate receipt discount after partial return',()=>{
 const sales=[{id:'s1',customerId:'c1',total:270,items:[{productId:'p1',price:100,quantity:2,returned:1},{productId:'p2',price:100,quantity:1,returned:0}]},{id:'s2',customerId:'c1',total:50,items:[{productId:'p1',price:50,quantity:1,returned:0}]}];
 const documents=[{id:'d1',productId:'other',items:[{productId:'p1'}]},{id:'d2',productId:'p1'},{id:'d3',productId:'other'}];
 const source=structuredClone(sales),result=productRelations('p1',sales,documents);
 assert.equal(result.sold,3);assert.equal(result.returned,1);assert.equal(result.revenue,140);assert.deepEqual(result.customerIds,['c1']);assert.equal(result.movements.length,2);assert.deepEqual(sales,source);
});
test('zero-paid receipt and unknown products produce finite zero revenue',()=>{
 const sales=[{id:'free',total:0,items:[{productId:'p',price:0,quantity:2,returned:0}]}];
 assert.equal(productRelations('p',sales,[]).revenue,0);assert.deepEqual(productRelations('unknown',sales,[]).customerIds,[]);
});
