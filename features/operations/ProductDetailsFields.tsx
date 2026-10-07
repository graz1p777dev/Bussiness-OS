'use client';
import {useState} from 'react';
import Select from '../../components/os/Select';
import type {Product,Warehouse} from '../../lib/os/inventory-model';
import {productKind,productKindLabels,type ProductKind} from '../../lib/os/product-options';

const typeDescriptions:Record<ProductKind,string>={product:'Остаток учитывается на складе и пополняется приходом.',service:'Продаётся без складского остатка. Возврат вернёт оплату, не создавая остаток.',kit:'Учитывается как отдельная складская позиция. Остаток комплекта пополняется приходом.'};

export default function ProductDetailsFields({product,warehouses,canSetInitialStock=true}:{product:Product|null;warehouses:Warehouse[];canSetInitialStock?:boolean}){
 const [initial,setInitial]=useState(false);
 const [kind,setKind]=useState<ProductKind>(productKind(product));
 return <>
  <h3>Параметры товара</h3>
  <label>Тип продукта<Select aria-label="Тип продукта" name="productType" value={kind} onChange={event=>setKind(event.target.value as ProductKind)}>{Object.entries(productKindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><small>{typeDescriptions[kind]}</small></label>
  <label className="switch-label"><input name="isFreePrice" type="checkbox" defaultChecked={product?.isFreePrice}/>Свободная цена</label><p className="field-hint">Кассир сможет изменить цену этой позиции в чеке. Цена в каталоге останется прежней.</p>
  <div className="form-grid">
   <label>Код товара<input name="code" defaultValue={product?.code||''}/></label><label>GTIN<input name="gtin" defaultValue={product?.gtin||''}/></label><label>Страна<input name="country" defaultValue={product?.country||''}/></label>
   {(['height','width','depth','weight'] as const).map((key,index)=><label key={key}>{['Высота, см','Ширина, см','Глубина, см','Фактический вес, кг'][index]}<input name={key} type="number" min={0} step="0.001" defaultValue={product?.[key]||0}/></label>)}
   <label>Наценка, %<input name="markup" type="number" min={0} step="0.01" defaultValue={product?.cost?Math.round((product.price/product.cost-1)*10000)/100:0} onChange={event=>{const form=event.currentTarget.form;if(!form)return;const cost=Number((form.elements.namedItem('cost') as HTMLInputElement)?.value||0);(form.elements.namedItem('price') as HTMLInputElement).value=String(Math.round(cost*(1+Number(event.target.value)/100)*100)/100)}}/></label>
   <label>Скидка, %<input name="discount" type="number" min={0} max={100} step="0.01" defaultValue={product?.discount||0}/></label><label className="switch-label"><input name="weighted" type="checkbox" defaultChecked={product?.weighted}/>Весовой товар</label><label className="switch-label"><input name="taxIncluded" type="checkbox" defaultChecked={product?.taxIncluded}/>Налог включён в цену</label>
  </div>
  <label>Описание<textarea name="description" defaultValue={product?.description||''}/></label>
  {!product&&kind==='product'&&<section className="panel"><label className="switch-label"><input type="checkbox" disabled={!canSetInitialStock} checked={initial&&canSetInitialStock} onChange={event=>{if(canSetInitialStock)setInitial(event.target.checked)}}/>Начальный остаток</label>{!canSetInitialStock&&<p>Для начального остатка нужно право на проведение складских документов.</p>}{initial&&canSetInitialStock&&<><p>При сохранении будет проведён отдельный приход.</p><div className="form-grid"><label>Количество<input name="initialQuantity" type="number" min={0} step="0.001" defaultValue={0}/></label><label>Склад<Select aria-label="Склад начального остатка" name="initialWarehouse">{warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select></label></div></>}</section>}
 </>;
}
