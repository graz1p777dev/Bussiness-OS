import type {ActionPermissions} from './team.ts';

export type PartnerStatus='active'|'inactive';
export type Partner={id:string;name:string;type:string;terms:string;contact:string;status:PartnerStatus;createdAt:string;updatedAt:string};
export type PartnerType={id:string;name:string;system:boolean};
export type PartnersState={partners:Partner[];types:PartnerType[]};
export type PartnerInput=Pick<Partner,'name'|'type'|'terms'|'contact'|'status'>;
export type PartnerFilters={query:string;type:string;status:''|PartnerStatus};
export const initialPartners:PartnersState={
 types:[{id:'cosmetologist',name:'Косметолог',system:true},{id:'dermatologist',name:'Дерматолог',system:true},{id:'fitness',name:'Фитнес',system:true},{id:'other',name:'Другое',system:true}],
 partners:[
  {id:'partner-demo-care',name:'Кабинет «Бережный уход»',type:'Косметолог',terms:'Рекомендации домашнего ухода после консультации. Условия каждого направления согласуем заранее.',contact:'Аида · +996 555 303 010',status:'active',createdAt:'2026-10-01T04:00:00.000Z',updatedAt:'2026-10-01T04:00:00.000Z'},
  {id:'partner-demo-fit',name:'Студия Forma',type:'Фитнес',terms:'Совместные дни заботы о себе и рекомендации для участников студии.',contact:'Координатор студии · @forma_demo',status:'active',createdAt:'2026-10-02T04:00:00.000Z',updatedAt:'2026-10-02T04:00:00.000Z'},
  {id:'partner-demo-event',name:'Городские встречи',type:'Другое',terms:'Участие в сезонных мероприятиях. Сотрудничество приостановлено до следующего сезона.',contact:'Отдел мероприятий · events@example.com',status:'inactive',createdAt:'2026-10-03T04:00:00.000Z',updatedAt:'2026-10-03T04:00:00.000Z'},
 ],
};
export const emptyPartner:PartnerInput={name:'',type:'Другое',terms:'',contact:'',status:'active'};
const normalized=(value:string)=>value.trim().toLocaleLowerCase('ru-RU');
function requirePermission(permissions:Partial<ActionPermissions>|undefined,action:keyof ActionPermissions){if(permissions&&permissions[action]!==true)throw new Error('Недостаточно прав для этого действия.')}

export function filterPartners(state:PartnersState,filters:PartnerFilters):Partner[]{
 const query=normalized(filters.query);
 return state.partners.filter(partner=>(!filters.type||partner.type===filters.type)&&(!filters.status||partner.status===filters.status)&&(!query||[partner.name,partner.type,partner.terms,partner.contact].some(value=>normalized(value).includes(query))))
  .sort((a,b)=>(a.status===b.status?0:a.status==='active'?-1:1)||a.name.localeCompare(b.name,'ru-RU'));
}

export function savePartner(state:PartnersState,input:PartnerInput,id:string,date:string,mode:'create'|'edit',permissions?:Partial<ActionPermissions>):PartnersState{
 requirePermission(permissions,mode);
 const previous=state.partners.find(partner=>partner.id===id);
 if(mode==='edit'&&!previous)throw new Error('Партнёр больше не доступен. Обновите справочник.');
 if(mode==='create'&&previous)throw new Error('Партнёр с таким идентификатором уже существует.');
 const name=input.name.trim(),type=input.type.trim();
 if(!name)throw new Error('Укажите название партнёра.');
 // A removed custom type remains a readable historical label on existing partners.
 if(!state.types.some(item=>item.name===type)&&!(previous&&previous.type===type))throw new Error('Выберите тип из справочника или добавьте новый.');
 if(!['active','inactive'].includes(input.status))throw new Error('Выберите статус партнёра.');
 const partner:Partner={id,name,type,terms:input.terms.trim(),contact:input.contact.trim(),status:input.status,createdAt:previous?.createdAt||date,updatedAt:date};
 return {...state,partners:previous?state.partners.map(item=>item.id===id?partner:item):[...state.partners,partner]};
}

export function setPartnerStatus(state:PartnersState,id:string,status:PartnerStatus,date:string,permissions?:Partial<ActionPermissions>):PartnersState{
 requirePermission(permissions,'edit');
 const partner=state.partners.find(item=>item.id===id);
 if(!partner)throw new Error('Партнёр больше не доступен. Обновите справочник.');
 return savePartner(state,{...partner,status},id,date,'edit',permissions);
}

export function savePartnerType(state:PartnersState,name:string,id:string,mode:'create'|'edit',permissions?:Partial<ActionPermissions>):PartnersState{
 requirePermission(permissions,mode);
 const previous=state.types.find(type=>type.id===id),trimmed=name.trim();
 if(!trimmed)throw new Error('Укажите название типа.');
 if(mode==='edit'&&!previous)throw new Error('Тип уже удалён. Обновите справочник.');
 if(mode==='create'&&previous)throw new Error('Тип с таким идентификатором уже существует.');
 if(previous?.system)throw new Error('Базовый тип нельзя переименовать. Создайте свой тип.');
 if(state.types.some(type=>type.id!==id&&normalized(type.name)===normalized(trimmed)))throw new Error('Такой тип уже есть в справочнике.');
 const next:PartnerType={id,name:trimmed,system:false};
 return {...state,types:previous?state.types.map(type=>type.id===id?next:type):[...state.types,next],partners:previous?state.partners.map(partner=>partner.type===previous.name?{...partner,type:trimmed}:partner):state.partners};
}

export function removePartnerType(state:PartnersState,id:string,permissions?:Partial<ActionPermissions>):PartnersState{
 requirePermission(permissions,'remove');
 const type=state.types.find(item=>item.id===id);
 if(!type)throw new Error('Тип уже удалён. Обновите справочник.');
 if(type.system)throw new Error('Базовый тип нельзя удалить.');
 return {...state,types:state.types.filter(item=>item.id!==id)};
}
