export type ProductKind='product'|'service'|'kit';

export function productKind(product:{productType?:string}|null|undefined):ProductKind{
 const kind=product?.productType;
 if(kind==='service'||kind==='Услуга')return 'service';
 if(kind==='kit'||kind==='Комплект')return 'kit';
 return 'product';
}
export const productKindLabels:Record<ProductKind,string>={product:'Товар',service:'Услуга',kit:'Комплект'};
export function isStockTrackedProduct(product:{productType?:string}|null|undefined){return productKind(product)!=='service'}

export function generateProductBarcode(existing:Iterable<string>=[]):string{
 const used=new Set(existing);
 const start=Math.floor(Math.random()*1_000_000_000);
 for(let offset=0;offset<=used.size;offset++){
  const body='200'+String((start+offset)%1_000_000_000).padStart(9,'0');
  const sum=[...body].reduce((total,digit,index)=>total+Number(digit)*(index%2===0?1:3),0);
  const barcode=body+String((10-sum%10)%10);
  if(!used.has(barcode))return barcode;
 }
 throw new Error('Не удалось подобрать свободный штрихкод.');
}
