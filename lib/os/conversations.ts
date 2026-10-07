import {initialDeals,type Entity} from './data.ts';
export type ChatMessage=string|{id:string;text:string;direction:'incoming'|'outgoing';employeeId?:string;sentAt?:string};
// Existing stored strings are replies sent by the operator. The demo thread ends with a client message.
export function messageDirection(message:ChatMessage){return typeof message==='string'?'outgoing':message.direction}
export function messageText(message:ChatMessage){return typeof message==='string'?message:message.text}
export function needsReply(messages:ChatMessage[],initialLastDirection:'incoming'|'outgoing'|null='incoming'){const last=messages.at(-1);return (last===undefined?initialLastDirection:messageDirection(last))==='incoming'}

export function hasDemoConversation(id:string|undefined){return initialDeals.some(d=>d.id===id)}
export function customerNeedsReply(id:string,messages:ChatMessage[]){return needsReply(messages,hasDemoConversation(id)?'incoming':null)}

export function selectedConversation(deals:Entity[],id:string){return deals.find(deal=>deal.id===id)||deals[0]}
export function conversationTime(id:string,messages:ChatMessage[]){const last=messages.at(-1);if(!last)return hasDemoConversation(id)?'12:40':'—';if(typeof last==='string'||!last.sentAt)return '—';const date=new Date(last.sentAt);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bishkek'}).format(date):'—'}
