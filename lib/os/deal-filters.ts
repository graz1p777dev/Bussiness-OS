import type {Entity} from './data';
export type DealFilters={assignment:string;employee:string;stage:string;tag:string;source:string;attention:string;deadline:string;taskMode:string;city:string;createdFrom:string;createdTo:string;min:string;max:string;reply:string;sort:string};
export const initialDealFilters:DealFilters={assignment:'Все',employee:'Все',stage:'Все',tag:'Все',source:'Все',attention:'Все',deadline:'Все',taskMode:'Все',city:'Все',createdFrom:'',createdTo:'',min:'',max:'',reply:'Все',sort:'updated-desc'};
export const activeDealFilters=(filters:DealFilters)=>Object.entries(filters).filter(([key,value])=>key!=='sort'&&value!==initialDealFilters[key as keyof DealFilters]);
const time=(value?:string)=>value?Date.parse(value.length===10?value+'T23:59:59+06:00':value):NaN;
export function filterDeals(deals:Entity[],filters:DealFilters,search:string,unanswered:string[],viewer:string,now=Date.now()){
 const q=search.trim().toLocaleLowerCase('ru'),digits=q.replace(/\D/g,'');
 const valid=(!filters.min||!filters.max||Number(filters.min)<=Number(filters.max))&&(!filters.createdFrom||!filters.createdTo||filters.createdFrom<=filters.createdTo);
 if(!valid)return [];
 const rows=deals.filter(d=>{
  if(filters.assignment==='Мои'&&d.owner!==viewer&&d.owner!==viewer.trim().split(/\s+/)[0])return false;
  if(filters.assignment==='Без ответственного'&&d.owner.trim())return false;
  if(filters.employee!=='Все'&&d.owner!==filters.employee)return false;
  if(filters.stage!=='Все'&&d.status!==filters.stage)return false;
  if(filters.tag!=='Все'&&!d.tags?.includes(filters.tag))return false;
  if(filters.source!=='Все'&&d.channel!==filters.source)return false;
  if(filters.city!=='Все'&&d.city!==filters.city)return false;
  if(filters.attention==='Срочные'&&!d.urgent)return false;
  if(filters.attention==='Требуют внимания'&&!(time(d.slaDueAt)<now))return false;
  const overdue=time(d.nextTaskAt)<now;
  if(filters.deadline==='Просроченные'&&!overdue)return false;
  if(filters.deadline==='Непросроченные'&&overdue)return false;
  if(filters.taskMode==='С задачами'&&!d.hasOpenTasks)return false;
  if(filters.taskMode==='Без задач'&&d.hasOpenTasks)return false;
  if(filters.taskMode==='Без следующей задачи'&&d.nextTaskAt)return false;
  if(filters.reply==='Без ответа'&&!unanswered.includes(d.id))return false;
  if(filters.reply==='Ответ отправлен'&&unanswered.includes(d.id))return false;
  if(filters.createdFrom&&(!d.createdAt||d.createdAt.slice(0,10)<filters.createdFrom))return false;
  if(filters.createdTo&&(!d.createdAt||d.createdAt.slice(0,10)>filters.createdTo))return false;
  if(filters.min&&d.value<Number(filters.min)||filters.max&&d.value>Number(filters.max))return false;
  const text=[d.id,d.name,d.owner,d.note,d.city,d.phone,d.username,...(d.tags||[])].filter(Boolean).join(' ').toLocaleLowerCase('ru');
  return !q||text.includes(q)||Boolean(digits&&d.phone?.replace(/\D/g,'').includes(digits));
 });
 return rows.sort((a,b)=>filters.sort==='amount-desc'?b.value-a.value:filters.sort==='amount-asc'?a.value-b.value:filters.sort==='task-asc'?(time(a.nextTaskAt)||Infinity)-(time(b.nextTaskAt)||Infinity):filters.sort==='created-desc'?(time(b.createdAt)||0)-(time(a.createdAt)||0):(time(b.updatedAt)||0)-(time(a.updatedAt)||0));
}
