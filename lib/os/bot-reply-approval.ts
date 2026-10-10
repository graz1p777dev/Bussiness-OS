import type {Entity} from './data.ts';
import {hasDemoConversation,messageDirection,messageText,type ChatMessage} from './conversations.ts';

export type BotReplySettings={approvalEnabled:boolean;strictTraining:boolean};
export const initialBotReplySettings:BotReplySettings={approvalEnabled:true,strictTraining:false};
export const initialBotReplyConfig={prompt:'Ты консультант магазина косметики. Уточни потребности, проверь наличие и предложи следующий шаг. Не подтверждай оплату без проверки.',storeMemory:'DemiResults. Доставка по Бишкеку. Каталог: SPF, очищение и уход.',clientMemory:'Чувствительная кожа, нужен мягкий уход.',model:'Chat Model',provider:'OpenAI',mode:'С подтверждением',stopWords:'спам\nреклама',temperature:.4,rate:0,manager:'Айым',strictTraining:false};
export function botReplySettings(config:{mode:string;strictTraining?:boolean}):BotReplySettings{return {approvalEnabled:config.mode==='С подтверждением',strictTraining:Boolean(config.strictTraining)}}
export type AgentPromptSettings=Record<string,Record<string,string>>;
import {knowledgeInstructions,knowledgeReplySources,type AgentKnowledge} from './agent-knowledge.ts';
export type BotReplyContext={customerId:string;customerName:string;pipeline:string;stage:string;agentId:string;agentName:string;prompt:string;request:string;messageKey:string;customerDetails:string;knowledge?:AgentKnowledge};
export type BotReplyDraft={id:string;customerId:string;agentId:string;context:BotReplyContext;contextKey:string;text:string;originalText:string;status:'pending'|'approved'|'rejected';createdAt:string;updatedAt:string;edits:{instruction:string;at:string}[];feedbackDraft?:{liked:string;disliked:string};instructionDraft?:string};
export type BotReplyFeedback={id:string;draftId:string;agentId:string;customerId:string;request:string;stage:string;replyText:string;liked:string;disliked:string;createdAt:string;appliedRevisionId?:string};
export type BotPromptRevision={id:string;agentId:string;agentName:string;basePrompt:string;addition:string;feedbackIds:string[];createdAt:string;appliedAt?:string};

export function getBotReplyContext(customer:Entity,messages:ChatMessage[],agents:Entity[],settings:AgentPromptSettings={},knowledgeByAgent:(id:string)=>AgentKnowledge|undefined=()=>undefined):BotReplyContext|null{
 if(customer.closedAt||['Успешно','Неуспешно'].includes(customer.pipeline||'')||['Успешно','Неуспешно'].includes(customer.status))return null;
 const agent=customer.agentId!==undefined?agents.find(item=>item.id===customer.agentId):agents.find(item=>item.name===customer.owner);
 if(!agent||agent.status!=='Активен')return null;
 const last=messages.at(-1);
 if(last!==undefined&&messageDirection(last)!=='incoming')return null;
 if(last===undefined&&!hasDemoConversation(customer.id))return null;
 const request=last===undefined?'Да, немного сухая. Ещё нужен SPF.':messageText(last);
 if(!request.trim())return null;
 const knowledge=knowledgeByAgent(agent.id);
 return {...(knowledge?.spaces.length?{knowledge}:{}),customerId:customer.id,customerName:customer.name,pipeline:customer.pipeline||'Продажи',stage:customer.status,agentId:agent.id,agentName:agent.name,prompt:settings[agent.id]?.prompt??agent.note,request,messageKey:typeof last==='object'?JSON.stringify([last.id,last.sentAt||'',messages.length]):'demo-last-incoming',customerDetails:JSON.stringify([customer.channel,customer.city||'',customer.note,customer.value,customer.customFields||{}])};
}
export function botReplyContextKey(context:BotReplyContext){return JSON.stringify(context)}
export function isBotReplyStale(draft:BotReplyDraft,context:BotReplyContext|null){return !context||draft.contextKey!==botReplyContextKey(context)}
export function isBotReplyReady(draft:BotReplyDraft|undefined,context:BotReplyContext|null,settings:BotReplySettings,human=false){return Boolean(settings.approvalEnabled&&!human&&draft?.status==='pending'&&draft.text.trim()&&!isBotReplyStale(draft,context))}

export function generateBotReplyText(context:BotReplyContext){
 const name=context.customerName.trim().split(/\s+/)[0];
 const request=context.request.toLocaleLowerCase('ru');
 const topic=/достав/.test(request)?'условия доставки':/цен|стоим|сколько/.test(request)?'стоимость':/spf|кож|уход/.test(request)?'мягкий уход и SPF':'детали вашего запроса';
 const next=/оплат/i.test(context.stage)?'Проверю данные заказа и уточню следующий шаг по оплате.':/достав|комплект/i.test(context.stage)?'Проверю статус заказа и уточню следующий шаг.':`Уточню ${topic} и предложу следующий шаг.`;
 const sources=context.knowledge?knowledgeReplySources(context.knowledge,context.request):[];
 const grounding=sources.length?' По материалам «'+sources[0].name+'»: '+sources[0].quote:'';
 return applyLocalReplyInstructions(`${name}, спасибо за сообщение! Вы написали: «${context.request.trim().slice(0,220)}». ${next}${grounding}`,context.prompt+'\n'+(context.knowledge?knowledgeInstructions(context.knowledge):'')).text;
}
export function createBotReplyDraft(context:BotReplyContext,id:string,now:string):BotReplyDraft{
 const text=generateBotReplyText(context);
 return {id,customerId:context.customerId,agentId:context.agentId,context,contextKey:botReplyContextKey(context),text,originalText:text,status:'pending',createdAt:now,updatedAt:now,edits:[]};
}
// Keep pending edits for explicit refresh. Completed decisions do not regenerate for the same input.
export function reconcileBotReplyDrafts(drafts:Record<string,BotReplyDraft>,contexts:BotReplyContext[],now:string){
 let next=drafts;
 for(const context of contexts){
  const previous=drafts[context.customerId];
  if(previous&&(previous.status==='pending'||!isBotReplyStale(previous,context)))continue;
  if(next===drafts)next={...drafts};
  next[context.customerId]=createBotReplyDraft(context,`${context.customerId}:${now}`,now);
 }
 return next;
}
export function decideBotReply(draft:BotReplyDraft,context:BotReplyContext|null,decision:'approved'|'rejected',now:string):BotReplyDraft|null{
 if(draft.status!=='pending'||(decision==='approved'&&(isBotReplyStale(draft,context)||!draft.text.trim())))return null;
 return {...draft,text:draft.text.trim(),status:decision,updatedAt:now};
}
export function editBotReply(draft:BotReplyDraft,text:string,now:string):BotReplyDraft{
 return draft.status==='pending'?{...draft,text,updatedAt:now}:draft;
}
function applyLocalReplyInstructions(original:string,instruction:string){
 const command=instruction.toLocaleLowerCase('ru');
 let text=original;
 const replacement=instruction.match(/замени\s+[«"](.+?)[»"]\s+на\s+[«"](.+?)[»"]/i);
 let applied=false;
 if(replacement&&text.includes(replacement[1])){text=text.replaceAll(replacement[1],replacement[2]);applied=true}
 if(/кратк|коротк|сократ|не повтор|не цитир/.test(command)){text=text.replace(/Вы написали: «[\s\S]*?»\.\s*/,'');applied=true}
 if(/дружелюб|теплее|забот/.test(command)){text=text.replace(/спасибо за сообщение!/i,'спасибо, что поделились! Буду рад помочь.');applied=true}
 if(/официальн|делов/.test(command)){text=text.replace(/спасибо за сообщение!/i,'благодарю за обращение.').replace(/спасибо, что поделились! Буду рад помочь\./i,'благодарю за обращение.');applied=true}
 const budgetQuestion=' Подскажите, на какой бюджет вы ориентируетесь?';
 if(/не [^.!?\n]{0,35}бюджет|без [^.!?\n]{0,25}бюджет/.test(command)){text=text.replace(budgetQuestion,'');applied=true}
 else if(/бюджет/.test(command)){if(!/бюджет/i.test(text))text+=budgetQuestion;applied=true}
 const callQuestion=' В какое время вам удобно обсудить детали по телефону?';
 if(/не [^.!?\n]{0,35}(?:звон|созвон)/.test(command)){text=text.replace(callQuestion,'');applied=true}
 else if(/звон|созвон/.test(command)){if(!/созвон|телефон|звон/i.test(text))text+=callQuestion;applied=true}
 return {text,applied};
}
export function rewriteBotReply(draft:BotReplyDraft,instruction:string,now:string):{draft:BotReplyDraft;applied:boolean}{
 if(draft.status!=='pending'||!instruction.trim())return {draft,applied:false};
 const result=applyLocalReplyInstructions(draft.text,instruction);
 if(!result.applied)return {draft,applied:false};
 return {draft:{...draft,text:result.text,instructionDraft:'',updatedAt:now,edits:[...draft.edits,{instruction:instruction.trim(),at:now}]},applied:true};
}
export function createBotReplyFeedback(draft:BotReplyDraft,liked:string,disliked:string,id:string,now:string):BotReplyFeedback|null{
 if(!liked.trim()&&!disliked.trim())return null;
 return {id,draftId:draft.id,agentId:draft.agentId,customerId:draft.customerId,request:draft.context.request,stage:draft.context.stage,replyText:draft.text,liked:liked.trim(),disliked:disliked.trim(),createdAt:now};
}
export function createBotPromptRevision(agent:Entity,settings:AgentPromptSettings,feedback:BotReplyFeedback[],id:string,now:string):BotPromptRevision|null{
 const selected=feedback.filter(item=>item.agentId===agent.id&&!item.appliedRevisionId);
 const liked=[...new Set(selected.map(item=>item.liked.trim()).filter(Boolean))];
 const disliked=[...new Set(selected.map(item=>item.disliked.trim()).filter(Boolean))];
 if(!liked.length&&!disliked.length)return null;
 const addition=['Уточнения по обратной связи оператора:',...liked.map(value=>`Сохраняй удачный подход: ${value}`),...disliked.map(value=>`Исправь в следующих ответах: ${value}`)].join('\n');
 return {id,agentId:agent.id,agentName:agent.name,basePrompt:settings[agent.id]?.prompt??agent.note,addition,feedbackIds:selected.map(item=>item.id),createdAt:now};
}
export function applyBotPromptRevision(settings:AgentPromptSettings,agents:Entity[],revision:BotPromptRevision):{ok:true;settings:AgentPromptSettings}|{ok:false;reason:string}{
 const agent=agents.find(item=>item.id===revision.agentId);
 if(!agent)return {ok:false,reason:'Агент удалён. Выберите действующего агента.'};
 if(revision.appliedAt)return {ok:false,reason:'Эта версия уже применена.'};
 if((settings[agent.id]?.prompt??agent.note)!==revision.basePrompt)return {ok:false,reason:'Промпт агента изменился. Соберите новую версию перед применением.'};
 if(!revision.addition.trim())return {ok:false,reason:'Добавьте уточнения к промпту.'};
 return {ok:true,settings:{...settings,[agent.id]:{...settings[agent.id],prompt:revision.basePrompt+(revision.basePrompt?'\n\n':'')+revision.addition.trim()}}};
}
