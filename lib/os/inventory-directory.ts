import type {InventoryState} from './inventory-model.ts';
export type InventoryDirectoryRow={id:string;name:string;detail:string;extra:string;fields?:Record<string,string>};
export type InventoryDirectories=Record<string,InventoryDirectoryRow[]>;
function parentId(row:InventoryDirectoryRow,rows:InventoryDirectoryRow[]){return row.fields?.parentId||rows.find(parent=>parent.name===row.extra)?.id||''}
export function categoryParentOptions(rows:InventoryDirectoryRow[],categoryId?:string){
 const excluded=new Set(categoryId?[categoryId]:[]);let changed=true;
 while(changed){changed=false;for(const row of rows)if(excluded.has(parentId(row,rows))&&!excluded.has(row.id)){excluded.add(row.id);changed=true}}
 return rows.filter(row=>!excluded.has(row.id));
}
export function renameCategoryReferences(state:InventoryState,directories:InventoryDirectories,id:string,name:string){
 const previous=directories.Категории?.find(row=>row.id===id);if(!previous||previous.name===name)return {state,directories};
 return {state:{...state,products:state.products.map(product=>product.category===previous.name?{...product,category:name}:product)},directories:{...directories,Категории:directories.Категории.map(row=>parentId(row,directories.Категории)===id?{...row,extra:name,fields:{...row.fields,parentId:id,extra:name}}:row)}};
}
export function categoryRemovalReason(state:InventoryState,rows:InventoryDirectoryRow[],id:string){
 const category=rows.find(row=>row.id===id);if(!category)return '';
 if(state.products.some(product=>product.category===category.name))return 'Категория используется товарами, включая корзину. Сначала измените категории товаров.';
 if(rows.some(row=>parentId(row,rows)===id))return 'У категории есть дочерние категории. Сначала измените их родителя.';
 return '';
}
