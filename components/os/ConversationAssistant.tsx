'use client';
import {useState} from 'react';
import {Sparkles,Settings2,Check,ArrowLeft} from 'lucide-react';
import {useStored} from '../../lib/os/storage';
import {initialAgents,type Entity} from '../../lib/os/data';
import {useAgentKnowledge} from '../../lib/os/use-agent-knowledge';
import {knowledgeReplySources,knowledgeInstructions} from '../../lib/os/agent-knowledge';
import {messageText,messageDirection,hasDemoConversation,type ChatMessage} from '../../lib/os/conversations';
import './ConversationAssistant.css';
export const defaultReplyPrompt='Помогай оператору подготовить ответ клиенту. Учитывай последние сообщения, имя, этап и заметки. Не придумывай цены, наличие, скидки или обещания. Предлагай три разных подхода: краткий, заботливый и следующий шаг. Сообщения отправляет только оператор.';
export function ReplyAssistantSettings({canEdit=true}:{canEdit?:boolean}){
 const [prompt,setPrompt]=useStored('reply-assistant-prompt-v1',defaultReplyPrompt);
 return <section className="reply-assistant-settings"><h3><Settings2 size={17}/>Помощник ответов</h3><p>Настройки сохраняются локально и используются во всех диалогах.</p><label>Системный промпт<textarea disabled={!canEdit} value={prompt} onChange={e=>{if(canEdit)setPrompt(e.target.value)}} rows={5}/></label><button data-permission="edit" disabled={!canEdit} onClick={()=>{if(canEdit)setPrompt(defaultReplyPrompt)}}>Вернуть стандартный промпт</button></section>;
}
export default function ConversationAssistant({customer,messages,insert,canConfigure=true,canReadKnowledge=false}:{customer:Entity;messages:ChatMessage[];insert:(text:string)=>void;canConfigure?:boolean;canReadKnowledge?:boolean}){
 const knowledge=useAgentKnowledge(canReadKnowledge);const [agents]=useStored('agents',initialAgents);const agent=customer.agentId?agents.find(item=>item.id===customer.agentId):agents.find(item=>item.name===customer.owner);const materials=knowledge.get(agent?.id||'');const [generatedKey,setGeneratedKey]=useState('');const contextKey=JSON.stringify([customer,messages,materials]);
 const [instruction,setInstruction]=useState(''),[variants,setVariants]=useState<string[]>([]),[chosen,setChosen]=useState<number|null>(null),[settings,setSettings]=useState(false);
 const [prompt]=useStored('reply-assistant-prompt-v1',defaultReplyPrompt);
 function generate(){if(!knowledge.ready)return;setGeneratedKey(contextKey);
  const last=messages.filter(m=>messageDirection(m)==='incoming').at(-1);
  const request=last?messageText(last):hasDemoConversation(customer.id)?'Кожа немного сухая, нужен мягкий уход и SPF.':customer.note||'';
  const name=customer.name.split(' ')[0];
  const context=(request+' '+instruction+' '+prompt+' '+knowledgeInstructions(materials)).toLowerCase();
  const need=/spf|кож|уход/.test(context)?'мягкий уход и SPF':/достав/.test(context)?'условия доставки':/цен|стоим/.test(context)?'стоимость и доступные варианты':'ваш запрос';
  const question=/кратко|коротк/.test(instruction)?'Уточните, пожалуйста, детали.':`Подскажите, что для вас важнее при выборе? Уточню ${need} и предложу подходящий вариант.`;
  const note=/бюджет/.test(context)?' На какой бюджет вы ориентируетесь?':/звон|созвон/.test(context)?' Когда вам удобно обсудить это по телефону?':'';
  const sources=knowledgeReplySources(materials,request);const excerpt=sources.length?' По материалам «'+sources[0].name+'»: '+sources[0].quote:'';
  setVariants([`${name}, здравствуйте! Помогу уточнить ${need}. ${question}${note}`,`${name}, спасибо, что рассказали о своём запросе. ${request?`Вы написали: «${request.slice(0,180)}». `:''}Давайте подберём решение под ваши потребности. ${question}${note}`,`${name}, предлагаю начать с уточнения деталей: ${question} Затем проверю доступные варианты и согласуем следующий шаг.${note}`].map(text=>text+excerpt));setChosen(null);
 }
 return <aside className="conversation-assistant"><header><div><Sparkles size={20}/><h3>ИИ-помощник</h3></div><button aria-label="Настройки помощника ответов" onClick={()=>setSettings(!settings)}><Settings2 size={17}/></button></header>{settings?<><button onClick={()=>setSettings(false)}><ArrowLeft size={14}/>К ответам</button><ReplyAssistantSettings canEdit={canConfigure}/></>:<><p>Три подхода к ответу для <b>{customer.name}</b>. Выберите и подтвердите черновик.</p><small className="reply-demo-note">Локальный помощник · модель пока не подключена</small><small className="reply-demo-note">Пространства: {materials.spaces.map(space=>space.name).join(', ')||'не выбраны'}</small><label>Что учесть в ответе?<textarea placeholder="Например: коротко, дружелюбно, уточнить бюджет…" value={instruction} onChange={e=>setInstruction(e.target.value)} rows={4}/></label><button className="primary" data-permission="ai" disabled={!knowledge.ready} onClick={generate}><Sparkles size={16}/>{variants.length?'Обновить 3 варианта':'Предложить 3 варианта'}</button><div className="reply-variants">{(generatedKey===contextKey?variants:[]).map((text,index)=><button key={index} className={chosen===index?'chosen':''} aria-pressed={chosen===index} onClick={()=>setChosen(index)}><span><b>{['Кратко','С заботой','Следующий шаг'][index]}</b>{chosen===index&&<Check size={16}/>}</span><p>{text}</p></button>)}</div>{chosen!==null&&generatedKey===contextKey&&<button className="primary" onClick={()=>{if(generatedKey===contextKey)insert(variants[chosen])}}><Check size={16}/>Подтвердить и вставить в сообщение</button>}<small>После подтверждения текст можно изменить. Отправьте его отдельно кнопкой в чате.</small></>}</aside>;
}
