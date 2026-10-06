'use client';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useStored} from '../../lib/os/storage';
import {inventoryDirectories} from './InventoryDirectory';
import Select from '../../components/os/Select';
import {Modal} from '../../components/os/ui';
export default function SupplierField(){const [directory,setDirectory]=useStored('inventory-directories-v2',inventoryDirectories);const [value,setValue]=useState('');const [open,setOpen]=useState(false);return <><label>Поставщик<Select name="supplier" value={value} onChange={e=>setValue(e.target.value)}><option value="">Без поставщика</option>{(directory.Поставщики||[]).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</Select></label><button type="button" onClick={()=>setOpen(true)}>Добавить поставщика</button>{open&&createPortal(<Modal title="Новый поставщик" close={()=>setOpen(false)}><form data-permission="create" onSubmit={e=>{e.preventDefault();e.stopPropagation();const f=new FormData(e.currentTarget);const supplier={id:crypto.randomUUID(),name:String(f.get('name')).trim(),detail:String(f.get('phone')),extra:String(f.get('contact'))};setDirectory(v=>({...v,Поставщики:[...(v.Поставщики||[]),supplier]}));setValue(supplier.name);setOpen(false)}}><label>Название<input name="name" required/></label><label>Контактное лицо<input name="contact"/></label><label>Телефон<input name="phone" type="tel"/></label><button className="primary">Создать поставщика</button></form></Modal>,document.body)}</>}
