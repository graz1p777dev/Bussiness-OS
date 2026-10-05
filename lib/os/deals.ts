import {type Entity,stages} from './data';
export const pipelines=['Продажи','Повторные продажи','Успешно','Неуспешно'] as const;
export type Pipeline=typeof pipelines[number];
export function dealPipeline(deal:Entity):Pipeline{if(deal.status==='Успешно'||deal.status==='Неуспешно')return deal.status;return deal.pipeline||'Продажи'}
export function closeDeal(deal:Entity,outcome:'Успешно'|'Неуспешно'):Entity{return {...deal,pipeline:outcome,status:stages.includes(deal.status)?deal.status:'Оплата',closedAt:new Date().toISOString(),previousPipeline:dealPipeline(deal)==='Повторные продажи'?'Повторные продажи':'Продажи'}}
