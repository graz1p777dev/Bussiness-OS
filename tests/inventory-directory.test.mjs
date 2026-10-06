import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryParentOptions,renameCategoryReferences,categoryRemovalReason} from '../lib/os/inventory-directory.ts';
import {initialInventory} from '../lib/os/inventory-model.ts';
const categories=[{id:'care',name:'Уход',detail:'',extra:''},{id:'face',name:'Лицо',detail:'',extra:'Уход'},{id:'cream',name:'Кремы',detail:'',extra:'',fields:{parentId:'face'}},{id:'spf',name:'SPF',detail:'',extra:''}];
test('category parents exclude self and descendants, including legacy name references',()=>{
 assert.deepEqual(categoryParentOptions(categories,'care').map(row=>row.id),['spf']);
 assert.equal(categoryParentOptions(categories).length,4);
 assert.deepEqual(categoryParentOptions([{id:'a',name:'A',extra:'',fields:{parentId:'b'}},{id:'b',name:'B',extra:'',fields:{parentId:'a'}}],'a'),[]);
});
test('renaming a category updates product assignments and child labels without mutating the source',()=>{
 const directory={Категории:categories};const renamed=renameCategoryReferences(initialInventory,directory,'care','Уход за кожей');
 assert.equal(renamed.state.products.find(product=>product.id==='SKU-101').category,'Уход за кожей');
 assert.equal(renamed.directories.Категории[1].extra,'Уход за кожей');
 assert.equal(renamed.directories.Категории[1].fields.parentId,'care');
 assert.equal(initialInventory.products[1].category,'Уход');assert.equal(categories[1].extra,'Уход');
});
test('category deletion protects catalog, trash and children while allowing unused categories',()=>{
 assert.match(categoryRemovalReason(initialInventory,categories,'care'),/товарами/);
 assert.match(categoryRemovalReason({...initialInventory,products:[]},categories,'care'),/дочерние/);
 assert.match(categoryRemovalReason({...initialInventory,products:initialInventory.products.map(product=>({...product,deleted:true}))},categories,'spf'),/товарами/);
 assert.equal(categoryRemovalReason({...initialInventory,products:[]},categories,'spf'),'');
});
