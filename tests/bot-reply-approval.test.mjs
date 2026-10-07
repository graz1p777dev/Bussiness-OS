import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDeals} from '../lib/os/data.ts';
import {applyBotPromptRevision,botReplySettings,createBotPromptRevision,createBotReplyDraft,createBotReplyFeedback,decideBotReply,editBotReply,getBotReplyContext,initialBotReplySettings,isBotReplyReady,isBotReplyStale,reconcileBotReplyDrafts,rewriteBotReply} from '../lib/os/bot-reply-approval.ts';

const now='2026-10-07T10:00:00.000Z';
const agent={id:'sales',name:'Sales Agent',value:0,status:'Активен',channel:'Chat Model',owner:'',note:'Проверяй факты. Не обещай скидки.'};
const otherAgent={...agent,id:'support',name:'Support Agent'};
const customer={id:'new-client',name:'Айжан Токтосунова',value:6900,status:'Подбор решения',channel:'WhatsApp',owner:agent.name,agentId:agent.id,note:'Нужен SPF',pipeline:'Продажи'};
const incoming={id:'incoming-1',direction:'incoming',text:'Подскажите стоимость доставки?',sentAt:'2026-10-07T09:59:00Z'};
const outgoing={id:'outgoing-1',direction:'outgoing',text:'Уточню условия.',sentAt:now};
const context=getBotReplyContext(customer,[incoming],[agent,otherAgent]);
const draft=()=>createBotReplyDraft(context,'draft-1',now);

test('approval follows the existing bot mode and strict training has a compatible default',()=>{
 assert.deepEqual(botReplySettings({mode:'С подтверждением'}),initialBotReplySettings);
 assert.equal(botReplySettings({mode:'Автоматический',strictTraining:true}).approvalEnabled,false);
 assert.equal(botReplySettings({mode:'Только оператор'}).approvalEnabled,false);
 assert.equal(botReplySettings({mode:'С подтверждением',strictTraining:true}).strictTraining,true);
});

test('context uses actual latest incoming and active responsible agent, without inventing input for new clients',()=>{
 assert.equal(context.request,incoming.text);
 assert.equal(context.agentId,agent.id);
 assert.equal(context.stage,customer.status);
 assert.equal(getBotReplyContext(customer,[],[agent]),null);
 assert.equal(getBotReplyContext(customer,[incoming,outgoing],[agent]),null);
 assert.equal(getBotReplyContext(customer,['Legacy operator message'],[agent]),null);
 assert.equal(getBotReplyContext(customer,[incoming],[{...agent,status:'Пауза'}]),null);
 assert.equal(getBotReplyContext({...customer,agentId:'missing'},[incoming],[agent]),null);
 assert.equal(getBotReplyContext({...customer,agentId:''},[incoming],[agent]),null);
 assert.equal(getBotReplyContext({...customer,agentId:undefined},[incoming],[agent]).agentId,agent.id);
 assert.equal(getBotReplyContext({...customer,pipeline:'Успешно'},[incoming],[agent]),null);
 assert.equal(getBotReplyContext({...initialDeals[0],agentId:agent.id},[],[agent]).request,'Да, немного сухая. Ещё нужен SPF.');
});

test('draft output acknowledges the latest customer question and changes next step with the deal stage',()=>{
 assert.match(draft().text,/Подскажите стоимость доставки\?/);
 assert.match(draft().text,/условия доставки/);
 const payment=createBotReplyDraft({...context,stage:'Ожидает оплаты'},'payment',now);
 assert.match(payment.text,/следующий шаг по оплате/);
 assert.doesNotMatch(payment.text,/оплата подтверждена|в наличии|доставим завтра/);
});

test('local drafting uses the assigned agent prompt for tone, length and common follow-up instructions',()=>{
 const instructed=getBotReplyContext(customer,[incoming],[agent],{[agent.id]:{prompt:'Отвечай кратко, деловым тоном. Уточни бюджет.'}});
 const prepared=createBotReplyDraft(instructed,'instructed',now);
 assert.doesNotMatch(prepared.text,/Вы написали/);
 assert.match(prepared.text,/благодарю за обращение/);
 assert.match(prepared.text,/на какой бюджет/);
 const noBudget=createBotReplyDraft({...instructed,prompt:'Не повторяй вопрос клиента. Не спрашивай бюджет.'},'no-budget',now);
 assert.doesNotMatch(noBudget.text,/Вы написали|на какой бюджет/);
});

test('reply badge requires approval mode, pending text, current context and AI conversation mode',()=>{
 assert.equal(isBotReplyReady(draft(),context,initialBotReplySettings),true);
 assert.equal(isBotReplyReady(draft(),context,{approvalEnabled:false,strictTraining:false}),false);
 assert.equal(isBotReplyReady(draft(),context,initialBotReplySettings,true),false);
 assert.equal(isBotReplyReady({...draft(),text:' '},context,initialBotReplySettings),false);
 assert.equal(isBotReplyReady({...draft(),status:'rejected'},context,initialBotReplySettings),false);
 assert.equal(isBotReplyReady({...draft(),status:'approved'},context,initialBotReplySettings),false);
 assert.equal(isBotReplyReady(draft(),null,initialBotReplySettings),false);
});

test('new message, stage, assigned agent, prompt and card facts all invalidate confirmation',()=>{
 const changes=[
  getBotReplyContext(customer,[{...incoming,id:'incoming-2'}],[agent]),
  getBotReplyContext(customer,[{...incoming,text:'Теперь нужен самовывоз'}],[agent]),
  getBotReplyContext({...customer,status:'Оплата'},[incoming],[agent]),
  getBotReplyContext({...customer,agentId:otherAgent.id},[incoming],[agent,otherAgent]),
  getBotReplyContext(customer,[incoming],[agent],{[agent.id]:{prompt:'Новая инструкция'}}),
  getBotReplyContext({...customer,note:'Изменены условия'},[incoming],[agent]),
  getBotReplyContext(customer,[incoming,outgoing],[agent])
 ];
 for(const changed of changes){assert.equal(isBotReplyStale(draft(),changed),true);assert.equal(decideBotReply(draft(),changed,'approved',now),null)}
});

test('reconciliation preserves pending edits and completed decisions, generating again only for new input',()=>{
 const edited=editBotReply(draft(),'Проверю стоимость и отвечу.',now);
 const current={[customer.id]:edited};
 assert.equal(reconcileBotReplyDrafts(current,[context],now),current);
 assert.equal(reconcileBotReplyDrafts(current,[{...context,stage:'Оплата'}],now),current);
 for(const status of ['approved','rejected']){
  const completed={[customer.id]:{...edited,status}};
  assert.equal(reconcileBotReplyDrafts(completed,[context],now),completed);
  const fresh=reconcileBotReplyDrafts(completed,[{...context,messageKey:'new-message'}],'2026-10-07T11:00:00Z');
  assert.equal(fresh[customer.id].status,'pending');
  assert.notEqual(fresh[customer.id].id,edited.id);
 }
});

test('approval returns the edited text only once while rejection never becomes approvable',()=>{
 const edited=editBotReply(draft(),'  Мой проверенный ответ  ',now);
 const approved=decideBotReply(edited,context,'approved',now);
 assert.equal(approved.text,'Мой проверенный ответ');
 assert.equal(decideBotReply(approved,context,'approved',now),null);
 const rejected=decideBotReply(edited,null,'rejected',now);
 assert.equal(rejected.status,'rejected');
 assert.equal(decideBotReply(rejected,context,'approved',now),null);
 assert.equal(editBotReply(approved,'changed',now),approved);
});

test('instruction rewrite persists draft history, leaves unsupported instructions out of customer text',()=>{
 const original=draft();
 const short=rewriteBotReply(original,'Сократи ответ и уточни бюджет',now);
 assert.equal(short.applied,true);
 assert.doesNotMatch(short.draft.text,/Вы написали/);
 assert.match(short.draft.text,/на какой бюджет/);
 assert.equal(short.draft.edits[0].instruction,'Сократи ответ и уточни бюджет');
 const replace=rewriteBotReply(short.draft,'замени "бюджет" на "диапазон цен"',now);
 assert.match(replace.draft.text,/диапазон цен/);
 const unsupported=rewriteBotReply(original,'Выполни неизвестную операцию',now);
 assert.equal(unsupported.applied,false);assert.equal(unsupported.draft,original);
 const restored=JSON.parse(JSON.stringify(replace.draft));
 assert.equal(restored.text,replace.draft.text);assert.deepEqual(restored.edits,replace.draft.edits);
});

test('instruction rewrites do not repeat budget or call questions already present in an edited answer',()=>{
 const manual=editBotReply(draft(),'Айжан, уточните, пожалуйста, бюджет на мягкий уход и SPF.',now);
 assert.equal(rewriteBotReply(manual,'Сделай деловой тон и уточни бюджет',now).draft.text,manual.text);
 const call=editBotReply(draft(),'Когда вам будет удобно созвониться?',now);
 assert.equal(rewriteBotReply(call,'Предложи созвон',now).draft.text,call.text);
});

test('feedback captures the reviewed answer and its original agent and context',()=>{
 const edited=editBotReply(draft(),'Короткий проверенный ответ',now);
 const feedback=createBotReplyFeedback(edited,'  Вежливый тон  ','Нужна конкретика','feedback-1',now);
 assert.equal(feedback.replyText,edited.text);
 assert.equal(feedback.agentId,agent.id);
 assert.equal(feedback.request,incoming.text);
 assert.equal(feedback.liked,'Вежливый тон');
 assert.equal(createBotReplyFeedback(edited,' ','','empty',now),null);
});

test('training combines multiple unused reviews for one agent into a reviewable addition',()=>{
 const positive=createBotReplyFeedback(draft(),'Вежливый тон','','f1',now);
 const negative=createBotReplyFeedback(draft(),'','Не повторять вопрос клиента','f2',now);
 const settings={[agent.id]:{prompt:'Исходный промпт с важными правилами.',temperature:'0.4'}};
 const revision=createBotPromptRevision(agent,settings,[positive,negative,{...negative,id:'other',agentId:otherAgent.id,disliked:'Чужое правило'},{...negative,id:'used',disliked:'Уже применено',appliedRevisionId:'old'}],'revision',now);
 assert.deepEqual(revision.feedbackIds,['f1','f2']);
 assert.equal(revision.basePrompt,settings[agent.id].prompt);
 assert.match(revision.addition,/Вежливый тон/);assert.match(revision.addition,/Не повторять вопрос/);
 assert.doesNotMatch(revision.addition,/Чужое правило|Уже применено/);
 assert.equal(settings[agent.id].prompt,'Исходный промпт с важными правилами.');
});

test('applying a reviewed addition preserves all existing prompt text and unrelated agent settings',()=>{
 const settings={[agent.id]:{prompt:'Исходные правила.\nВторая строка.',temperature:'0.7',approval:'on',budget:'500'},[otherAgent.id]:{prompt:'Чужие инструкции',tokens:'1024'}};
 const feedback=createBotReplyFeedback(draft(),'Краткость','','f1',now);
 const revision=createBotPromptRevision(agent,settings,[feedback],'revision',now);
 const result=applyBotPromptRevision(settings,[agent,otherAgent],{...revision,addition:'Проверенное человеком уточнение.'});
 assert.equal(result.ok,true);
 assert.deepEqual(result.settings[agent.id],{...settings[agent.id],prompt:settings[agent.id].prompt+'\n\nПроверенное человеком уточнение.'});
 assert.equal(result.settings[otherAgent.id],settings[otherAgent.id]);
 assert.equal(settings[agent.id].prompt,'Исходные правила.\nВторая строка.');
});

test('prompt conflicts, deleted agents and repeated application are blocked without changing settings',()=>{
 const feedback=createBotReplyFeedback(draft(),'Краткость','','f1',now);
 const revision=createBotPromptRevision(agent,{},[feedback],'revision',now);
 assert.equal(applyBotPromptRevision({[agent.id]:{prompt:'Изменён после подготовки'}},[agent],revision).ok,false);
 assert.equal(applyBotPromptRevision({},[],revision).ok,false);
 assert.equal(applyBotPromptRevision({},[agent],{...revision,appliedAt:now}).ok,false);
 assert.equal(applyBotPromptRevision({},[agent],{...revision,addition:' '}).ok,false);
 assert.equal(applyBotPromptRevision({},[agent],revision).settings[agent.id].prompt,agent.note+'\n\n'+revision.addition);
});
