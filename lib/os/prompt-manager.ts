import type {Entity} from './data.ts';
import {messageDirection,messageText,type ChatMessage} from './conversations.ts';

export type PromptFilters={pipelines:('Продажи'|'Повторные продажи')[];includeStages:string[];excludeStages:string[];includeSources:string[];excludeSources:string[];purchase:'all'|'bought'|'not-bought'};
export type PromptAnswers={business:string;goal:string;tone:string;boundaries:string};
export type PromptSuggestion={id:string;title:string;reason:string;text:string};
export type AgentPromptSettings=Record<string,Record<string,string>>;
export const initialPromptFilters:PromptFilters={pipelines:['Продажи','Повторные продажи'],includeStages:[],excludeStages:[],includeSources:[],excludeSources:[],purchase:'all'};
export const emptyPromptAnswers:PromptAnswers={business:'',goal:'',tone:'',boundaries:''};
export const promptQuestions:{key:keyof PromptAnswers;title:string;question:string;placeholder:string}[]=[
 {key:'business',title:'Ваш бизнес',question:'Что вы продаёте и кому помогаете? Расскажите о продукте и клиентах.',placeholder:'Например: косметика для чувствительной кожи, клиенты из Бишкека…'},
 {key:'goal',title:'Задача агента',question:'К какому результату агент должен приводить разговор?',placeholder:'Например: уточнить потребность, подобрать уход и согласовать заказ…'},
 {key:'tone',title:'Стиль общения',question:'Как агенту общаться с клиентами? Укажите язык, тон и длину ответов.',placeholder:'Например: по-русски, тепло, коротко, без навязчивости…'},
 {key:'boundaries',title:'Правила',question:'Что агенту нужно проверять и когда передавать разговор сотруднику?',placeholder:'Например: проверять наличие, не обещать скидки, жалобы передавать менеджеру…'},
];

export function isPromptPurchase(deal:Entity){return deal.pipeline==='Успешно'||deal.status==='Успешно'}
export function promptDealPipeline(deal:Entity):'Продажи'|'Повторные продажи'{
 if(deal.pipeline==='Успешно'||deal.pipeline==='Неуспешно'||deal.status==='Успешно'||deal.status==='Неуспешно')return deal.previousPipeline||'Продажи';
 return deal.pipeline==='Повторные продажи'?'Повторные продажи':'Продажи';
}
export function filterPromptDeals(deals:Entity[],filters:PromptFilters){return deals.filter(deal=>
 filters.pipelines.includes(promptDealPipeline(deal))&&
 (!filters.includeStages.length||filters.includeStages.includes(deal.status))&&!filters.excludeStages.includes(deal.status)&&
 (!filters.includeSources.length||filters.includeSources.includes(deal.channel))&&!filters.excludeSources.includes(deal.channel)&&
 (filters.purchase==='all'||(filters.purchase==='bought'?isPromptPurchase(deal):!isPromptPurchase(deal)))
)}

const topics=[
 {id:'price',label:'Цена и скидки',pattern:/цен[аыуе]|стоимост|сколько стоит|скидк|дорого|бюджет/i,text:'Когда клиент спрашивает цену, называй её только по актуальному каталогу. Уточняй бюджет; согласовывай скидку с сотрудником.'},
 {id:'stock',label:'Наличие',pattern:/наличи|остат[окки]|есть ли|законч[иы]/i,text:'Перед предложением товара проверяй актуальное наличие. Если данных нет, предложи уточнить их у сотрудника.'},
 {id:'delivery',label:'Доставка',pattern:/достав|самовывоз|привез|отправк/i,text:'При вопросе о доставке уточни город и способ получения. Стоимость и срок подтверждай по действующим условиям.'},
 {id:'concern',label:'Возражения и жалобы',pattern:/возврат|жалоб|не подош|не помог|аллерг|раздражен/i,text:'При жалобе или нежелательной реакции уточни ситуацию и передай разговор сотруднику. Не обещай возврат и не давай медицинских рекомендаций.'},
];
export function analyzePromptSlice(deals:Entity[],messages:Record<string,ChatMessage[]>){
 let savedMessages=0,incoming=0,outgoing=0,withMessages=0,unanswered=0;
 const topicCounts=topics.map(topic=>({...topic,count:0}));
 for(const deal of deals){
  const thread=messages[deal.id]||[];
  if(thread.length)withMessages++;
  savedMessages+=thread.length;
  if(thread.length&&messageDirection(thread[thread.length-1])==='incoming')unanswered++;
  for(const message of thread){
   if(messageDirection(message)==='incoming'){incoming++;for(const topic of topicCounts)if(topic.pattern.test(messageText(message)))topic.count++}
   else outgoing++;
  }
 }
 return {deals:deals.length,bought:deals.filter(isPromptPurchase).length,withMessages,savedMessages,incoming,outgoing,unanswered,sources:[...new Set(deals.map(deal=>deal.channel))],topics:topicCounts.filter(topic=>topic.count>0).map(({id,label,count,text})=>({id,label,count,text}))};
}
export type PromptAnalysis=ReturnType<typeof analyzePromptSlice>;

export function buildPromptSuggestions(answers:PromptAnswers,filters:PromptFilters,analysis:PromptAnalysis):PromptSuggestion[]{
 const suggestions:PromptSuggestion[]=[
  {id:'context',title:'Контекст и задача',reason:'Из ваших ответов о бизнесе и результате разговора.',text:`Контекст бизнеса: ${answers.business.trim()}\nЗадача агента: ${answers.goal.trim()}`},
  {id:'tone',title:'Манера общения',reason:'Из выбранного вами стиля общения.',text:`Стиль общения: ${answers.tone.trim()}`},
  {id:'boundaries',title:'Проверки и передача сотруднику',reason:'Из ваших правил работы агента.',text:`Правила и передача сотруднику: ${answers.boundaries.trim()}`},
 ];
 if(analysis.unanswered>0)suggestions.push({id:'unanswered',title:'Вернуться к вопросу клиента',reason:`В ${analysis.unanswered} диалогах последнее сохранённое сообщение — входящее.`,text:'Перед ответом прочитай последний вопрос клиента. Сначала ответь на него, затем согласуй следующий шаг. Не отправляй повторное сообщение без разрешённого сценария.'});
 for(const topic of analysis.topics)suggestions.push({id:topic.id,title:topic.label,reason:`Найдено входящих сообщений по ключевым словам: ${topic.count}. Проверьте контекст перед применением.`,text:topic.text});
 if(filters.purchase==='bought'&&analysis.bought>0)suggestions.push({id:'repeat',title:'Учитывать предыдущую покупку',reason:`В выборке ${analysis.bought} сделок с исходом «Успешно».`,text:'Если в карточке подтверждена предыдущая покупка, уточни опыт использования и текущую потребность, прежде чем предлагать повторный заказ.'});
 return suggestions;
}

const blockStart='[Начало настроек Prompt Manager]';
const blockEnd='[Конец настроек Prompt Manager]';
export function composeManagedPrompt(existing:string,suggestions:PromptSuggestion[]){
 if(!suggestions.length)return existing;
 const block=blockStart+'\n'+suggestions.map(suggestion=>suggestion.text.trim()).filter(Boolean).join('\n\n')+'\n'+blockEnd;
 const start=existing.indexOf(blockStart),end=start<0?-1:existing.indexOf(blockEnd,start);
 if(start>=0&&end>=start)return existing.slice(0,start)+block+existing.slice(end+blockEnd.length);
 return existing+(existing.endsWith('\n\n')||!existing?'':existing.endsWith('\n')?'\n':'\n\n')+block;
}
export function applyPromptToSettings(settings:AgentPromptSettings,agentId:string,prompt:string):AgentPromptSettings{
 return {...settings,[agentId]:{...settings[agentId],prompt}};
}

export type PromptDiffLine={kind:'context'|'removed'|'added';text:string;before?:number;after?:number};
export function promptDiff(before:string,after:string):PromptDiffLine[]{
 if(before===after)return [];
 const oldLines=before?before.split('\n'):[],newLines=after?after.split('\n'):[];
 let prefix=0,suffix=0;
 while(prefix<oldLines.length&&prefix<newLines.length&&oldLines[prefix]===newLines[prefix])prefix++;
 while(suffix<oldLines.length-prefix&&suffix<newLines.length-prefix&&oldLines[oldLines.length-1-suffix]===newLines[newLines.length-1-suffix])suffix++;
 return [
  ...oldLines.slice(Math.max(0,prefix-2),prefix).map((text,index)=>({kind:'context' as const,text,before:Math.max(0,prefix-2)+index+1,after:Math.max(0,prefix-2)+index+1})),
  ...oldLines.slice(prefix,oldLines.length-suffix).map((text,index)=>({kind:'removed' as const,text,before:prefix+index+1})),
  ...newLines.slice(prefix,newLines.length-suffix).map((text,index)=>({kind:'added' as const,text,after:prefix+index+1})),
  ...oldLines.slice(oldLines.length-suffix,oldLines.length-suffix+Math.min(2,suffix)).map((text,index)=>({kind:'context' as const,text,before:oldLines.length-suffix+index+1,after:newLines.length-suffix+index+1})),
 ];
}
