import type {InventoryState,Product} from './inventory-model.ts';
type Entry={row:number;action:'create'|'update';product:Product};
export type ProductImportPlan={entries:Entry[];errors:{row:number;message:string}[]};
export function prepareProductImport(rows:string[][],state:InventoryState,update=true):ProductImportPlan{
 const plan:ProductImportPlan={entries:[],errors:[]};if(!rows.length)return plan;
 const headers=rows[0].map(value=>value.trim().toLowerCase());
 const column=(...names:string[])=>headers.findIndex(header=>names.includes(header));
 const columns={name:column('name','название','товар'),sku:column('sku','артикул'),barcode:column('barcode','штрихкод'),category:column('category','category_name','категория'),price:column('price','sale_price','цена','цена продажи','продажа'),cost:column('cost','purchase_price','себестоимость','цена закупки','закупка'),unit:column('unit','единица','ед.'),minimum:column('minimum','минимальный остаток'),description:column('description','описание')};
 if(columns.name<0||columns.sku<0||columns.price<0){plan.errors.push({row:1,message:'Нужны колонки name/название, sku/артикул и price/цена.'});return plan}
 const seen=new Set<string>();const existingBySku=new Map(state.products.map(product=>[product.sku,product]));
 rows.slice(1).forEach((cells,index)=>{
  if(!cells.some(cell=>cell.trim()))return;
  const row=index+2;const text=(key:keyof typeof columns,fallback='')=>columns[key]<0?fallback:(cells[columns[key]]||'').trim();
  const sku=text('sku'),name=text('name'),existing=existingBySku.get(sku);
  const fail=(message:string)=>plan.errors.push({row,message});
  if(!name||!sku){fail('Укажите название и артикул.');return}
  if(seen.has(sku)){fail('Артикул повторяется в файле: '+sku);return}seen.add(sku);
  if(existing?.deleted){fail('Товар в корзине: '+sku+'. Сначала восстановите его.');return}
  if(existing&&!update){fail('Артикул уже существует: '+sku);return}
  const numeric=(key:'price'|'cost'|'minimum',fallback:number)=>{const raw=text(key,String(fallback));return raw?Number(raw.replace(/\s/g,'').replace(',','.')):NaN};
  const price=numeric('price',existing?.price||0),cost=numeric('cost',existing?.cost||0),minimum=numeric('minimum',existing?.minimum??5);
  if([price,cost,minimum].some(value=>!Number.isFinite(value)||value<0)){fail('Проверьте цены и минимальный остаток: значения должны быть числом от нуля.');return}
  const rawUnit=text('unit',existing?.unit||'шт.');const unit=rawUnit==='piece'?'шт.':rawUnit==='ml'?'мл':rawUnit==='g'?'г':rawUnit;
  if(!['шт.','мл','г','кг','л','уп'].includes(unit)){fail('Неизвестная единица: '+unit);return}
  plan.entries.push({row,action:existing?'update':'create',product:{...existing,id:existing?.id||'import-row-'+row,name,sku,barcode:text('barcode',existing?.barcode),category:text('category',existing?.category||'Без категории')||'Без категории',price,cost,minimum,unit,description:text('description',existing?.description),stocks:existing?.stocks||Object.fromEntries(state.warehouses.map(warehouse=>[warehouse.id,0])),deleted:false}});
 });
 const updatedIds=new Set(plan.entries.filter(entry=>entry.action==='update').map(entry=>entry.product.id));
 const finalProducts=[...state.products.filter(product=>!updatedIds.has(product.id)),...plan.entries.map(entry=>entry.product)];
 const barcodeCounts=new Map<string,number>();for(const product of finalProducts)if(product.barcode)barcodeCounts.set(product.barcode,(barcodeCounts.get(product.barcode)||0)+1);
 for(const entry of plan.entries)if(entry.product.barcode&&(barcodeCounts.get(entry.product.barcode)||0)>1)plan.errors.push({row:entry.row,message:'Штрихкод уже используется: '+entry.product.barcode});
 return plan;
}
export function applyProductImport(state:InventoryState,rows:string[][],update=true):InventoryState{
 const plan=prepareProductImport(rows,state,update);if(plan.errors.length)throw new Error('Строка '+plan.errors[0].row+': '+plan.errors[0].message);if(!plan.entries.length)throw new Error('В файле нет товаров.');
 const changes=new Map(plan.entries.filter(entry=>entry.action==='update').map(entry=>[entry.product.id,entry.product]));
 return {...state,products:[...state.products.map(product=>changes.get(product.id)||product),...plan.entries.filter(entry=>entry.action==='create').map(entry=>({...entry.product,id:crypto.randomUUID()}))]};
}
