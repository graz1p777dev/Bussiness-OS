import type {Entity} from './data.ts';

export type CustomerDeal=Entity;
export type Customer=Entity&{customerId:string;dealIds:string[]};
export function customerIdForDeal(deal:CustomerDeal){return deal.customerId?.trim()||deal.id}
export function normalizeCustomerPhone(phone:string){return phone.replace(/\D/g,'')}

/** CRM is the source of truth. Only explicit IDs join records; contact text never merges people. */
export function normalizeCustomers(deals:CustomerDeal[]):Customer[]{
 const customers=new Map<string,Customer>();
 for(const deal of deals){
  const id=customerIdForDeal(deal),existing=customers.get(id);
  if(existing){if(!existing.dealIds.includes(deal.id))existing.dealIds.push(deal.id)}
  else customers.set(id,{...deal,id,customerId:id,dealIds:[deal.id]});
 }
 return [...customers.values()];
}

export function searchCustomers(customers:Customer[],query:string){
 const text=query.trim().toLocaleLowerCase(),phone=/^[+\d() .-]+$/.test(text)?normalizeCustomerPhone(text):'';
 return customers.filter(customer=>!text||customer.name.toLocaleLowerCase().includes(text)||Boolean(phone&&normalizeCustomerPhone(customer.phone||'').includes(phone)));
}

export function createCustomerDeal(deals:CustomerDeal[],input:{name:string;phone:string;owner?:string;stage?:string},id:string,now:string):CustomerDeal{
 const name=input.name.trim(),phone=input.phone.trim(),digits=normalizeCustomerPhone(phone);
 if(name.length<2)throw new Error('Укажите имя клиента — минимум 2 символа.');
 if(phone&&(!/^[+\d() .-]+$/.test(phone)||digits.length<7||digits.length>15))throw new Error('Проверьте номер телефона с кодом страны.');
 if(!id.trim()||deals.some(deal=>deal.id===id||customerIdForDeal(deal)===id))throw new Error('Клиент с этим ID уже существует.');
 if(digits&&deals.some(deal=>normalizeCustomerPhone(deal.phone||'')===digits))throw new Error('Клиент с таким номером уже есть в CRM. Найдите его по телефону.');
 return {id,customerId:id,name,phone,value:0,status:input.stage||'Неразобранное',pipeline:'Продажи',channel:'Касса',owner:input.owner||'',note:'Создан в кассе',createdAt:now,updatedAt:now};
}

/** Contact changes follow customer identity; amounts, stages and notes remain per deal. */
export function updateCustomerContact(deals:CustomerDeal[],customerId:string,contact:Pick<Entity,'name'|'phone'|'username'|'city'|'customFields'>):CustomerDeal[]{
 return deals.map(deal=>customerIdForDeal(deal)===customerId?{...deal,...contact}:deal);
}
