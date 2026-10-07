'use client';
import {useState} from 'react';
import {Barcode} from 'lucide-react';
import {generateProductBarcode} from '../../lib/os/product-options';
import type {Product} from '../../lib/os/inventory-model';
import './ProductDetailsFields.css';

export default function ProductBarcodeField({product,products}:{product:Product|null;products:Product[]}){
 const [barcode,setBarcode]=useState(product?.barcode||'');
 return <label>Штрихкод<span className="product-barcode-field"><input name="barcode" value={barcode} onChange={event=>setBarcode(event.target.value)} autoComplete="off"/><button type="button" title="Создать уникальный штрихкод EAN-13" onClick={()=>setBarcode(generateProductBarcode([...products.map(item=>item.barcode),barcode]))}><Barcode size={16}/>Создать</button></span><small>Можно ввести свой или создать EAN-13.</small></label>;
}
