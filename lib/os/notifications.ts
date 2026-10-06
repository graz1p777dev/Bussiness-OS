import {customerNeedsReply,type ChatMessage} from './conversations.ts';
import {type Entity} from './data.ts';
import {stockTotal,type InventoryState} from './inventory-model.ts';
export type Notice={id:string;category:string;title:string;description:string;date?:string;route:string;clientId?:string};
export function workspaceNotices(deals:Entity[],messages:Record<string,ChatMessage[]>,tasks:Entity[],inventory:InventoryState){
 const notices:Notice[]=[];
 for(const deal of deals){
  const thread=messages[deal.id]||[];
  if(!customerNeedsReply(deal.id,thread))continue;
  const last=thread.at(-1);
  notices.push({id:'reply:'+deal.id+':'+(typeof last==='object'?last.id:thread.length),category:'Срочное',title:deal.name+' ждёт ответа',description:deal.channel+' · '+deal.status+(deal.owner?' · '+deal.owner:' · Ответственный не назначен'),date:typeof last==='object'?last.sentAt:undefined,route:'conversations',clientId:deal.id});
 }
 for(const product of inventory.products){
  const stock=stockTotal(product);
  if(product.deleted||stock>=product.minimum)continue;
  notices.push({id:'stock:'+product.id+':'+stock+':'+product.minimum,category:'Склад',title:product.name+': осталось '+stock+' '+product.unit,description:'Минимальный остаток — '+product.minimum+'. Откройте каталог, чтобы проверить остатки по складам.',route:'inventory'});
 }
 for(const task of tasks){
  if(['Done','Готово','Завершено'].includes(task.status)||!task.urgent)continue;
  notices.push({id:'task:'+task.id+':'+task.status,category:'Предупреждение',title:'Важная задача: '+task.name,description:task.status+(task.owner?' · '+task.owner:'')+' · '+task.note,date:task.updatedAt||task.createdAt,route:'tasks'});
 }
 return notices;
}
