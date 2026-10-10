import type {BotReplyDraft,BotReplyFeedback} from './bot-reply-approval.ts';

export function customerAIEvents(customerId:string,dealIds:string[],drafts:Record<string,BotReplyDraft>,feedback:BotReplyFeedback[],canRead:boolean){
 if(!canRead)return [];
 const ids=new Set([customerId,...dealIds]);
 return [...Object.values(drafts).filter(draft=>ids.has(draft.customerId)).map(draft=>({id:'draft:'+draft.id,at:draft.updatedAt,agent:draft.context.agentName,type:({pending:'Ответ ожидает проверки',approved:'Ответ подтверждён',rejected:'Ответ отклонён'})[draft.status],text:draft.text,dealId:draft.customerId})),...feedback.filter(item=>ids.has(item.customerId)).map(item=>({id:'feedback:'+item.id,at:item.createdAt,agent:Object.values(drafts).find(draft=>draft.agentId===item.agentId)?.context.agentName||item.agentId,type:'Обратная связь по ответу',text:[item.liked&&'Понравилось: '+item.liked,item.disliked&&'Изменить: '+item.disliked].filter(Boolean).join('\n'),dealId:item.customerId}))].sort((a,b)=>b.at.localeCompare(a.at));
}
