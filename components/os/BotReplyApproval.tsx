'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,Check,GraduationCap,Pencil,RefreshCw,ShieldCheck,Sparkles,ThumbsDown,ThumbsUp,X} from 'lucide-react';
import {useStored} from '../../lib/os/storage';
import {initialAgents,type Entity} from '../../lib/os/data';
import type {ChatMessage} from '../../lib/os/conversations';
import {applyBotPromptRevision,botReplySettings,createBotPromptRevision,createBotReplyDraft,createBotReplyFeedback,decideBotReply,editBotReply,getBotReplyContext,initialBotReplyConfig,isBotReplyReady,isBotReplyStale,reconcileBotReplyDrafts,rewriteBotReply,type AgentPromptSettings,type BotPromptRevision,type BotReplyDraft,type BotReplyFeedback} from '../../lib/os/bot-reply-approval';
import Select from './Select';
import './BotReplyApproval.css';

const emptyDrafts:Record<string,BotReplyDraft>={},emptySettings:AgentPromptSettings={},emptyHumanModes:Record<string,boolean>={};
const emptyFeedback:BotReplyFeedback[]=[],emptyRevisions:BotPromptRevision[]=[];

export function useBotReplyApproval(deals:Entity[],agents:Entity[],messages:Record<string,ChatMessage[]>,{canEdit=false,humanByChat=emptyHumanModes}:{canEdit?:boolean;humanByChat?:Record<string,boolean>}={}){
 const [config]=useStored('bot-config-v2',initialBotReplyConfig);
 const [agentSettings]=useStored<AgentPromptSettings>('agent-settings',emptySettings);
 const [drafts,setDrafts]=useStored('bot-reply-drafts-v1',emptyDrafts);
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{let mounted=true;queueMicrotask(()=>{if(mounted)setHydrated(true)});return()=>{mounted=false}},[]);
 const settings=botReplySettings(config);
 const contexts=useMemo(()=>deals.filter(deal=>!humanByChat[deal.id]).map(deal=>getBotReplyContext(deal,messages[deal.id]||[],agents,agentSettings)).filter(context=>context!==null),[deals,messages,agents,agentSettings,humanByChat]);
 useEffect(()=>{
  if(!hydrated||!canEdit||!settings.approvalEnabled)return;
  const now=new Date().toISOString();
  setDrafts(current=>reconcileBotReplyDrafts(current,contexts,now));
 },[hydrated,canEdit,settings.approvalEnabled,contexts,setDrafts]);
 const readyIds=contexts.filter(context=>isBotReplyReady(drafts[context.customerId],context,settings)).map(context=>context.customerId);
 return {settings,drafts,readyIds};
}

export function BotReplyApprovalCard({customer,messages,canEdit,onSend,notify,human=false}:{customer:Entity;messages:ChatMessage[];canEdit:boolean;onSend:(text:string)=>void|boolean;notify?:(text:string)=>void;human?:boolean}){
 const [config]=useStored('bot-config-v2',initialBotReplyConfig),[agents]=useStored('agents',initialAgents);
 const [agentSettings]=useStored<AgentPromptSettings>('agent-settings',emptySettings);
 const [drafts,setDrafts]=useStored('bot-reply-drafts-v1',emptyDrafts);
 const [feedback,setFeedback]=useStored('bot-reply-feedback-v1',emptyFeedback);
 const [editing,setEditing]=useState(false),[notice,setNotice]=useState('');
 const confirmed=useRef(new Set<string>());
 const settings=botReplySettings(config),draft=drafts[customer.id];
 const context=getBotReplyContext(customer,messages,agents,agentSettings);
 const stale=Boolean(draft&&isBotReplyStale(draft,context));
 const pending=draft?.status==='pending';
 const ready=isBotReplyReady(draft,context,settings,human);
 function announce(text:string){setNotice(text);notify?.(text)}
 function updateDraft(update:(draft:BotReplyDraft)=>BotReplyDraft){if(!canEdit||!draft)return;setDrafts(rows=>rows[customer.id]?.id===draft.id?{...rows,[customer.id]:update(rows[customer.id])}:rows)}
 function refresh(){
  if(!canEdit||human||!context)return;
  const next=createBotReplyDraft(context,crypto.randomUUID(),new Date().toISOString());
  setDrafts(rows=>({...rows,[customer.id]:next}));setEditing(false);announce('Подготовлен черновик по текущему сообщению и этапу');
 }
 function confirm(){
  if(!canEdit||!ready||!draft||confirmed.current.has(draft.id))return;
  const next=decideBotReply(draft,context,'approved',new Date().toISOString());
  if(!next)return;
  confirmed.current.add(draft.id);
  try{
   if(onSend(next.text)===false){confirmed.current.delete(draft.id);announce('Ответ не добавлен. Проверьте доступ к диалогу.');return}
   updateDraft(()=>next);setEditing(false);announce('Подтверждённый ответ добавлен в локальный диалог');
  }catch{confirmed.current.delete(draft.id);announce('Не удалось добавить ответ. Черновик сохранён для повторной попытки.')}
 }
 function saveFeedback(){
  if(!canEdit||!draft||!settings.strictTraining)return;
  const next=createBotReplyFeedback(draft,draft.feedbackDraft?.liked||'',draft.feedbackDraft?.disliked||'',crypto.randomUUID(),new Date().toISOString());
  if(!next)return;
  setFeedback(rows=>[...rows,next]);updateDraft(current=>({...current,feedbackDraft:{liked:'',disliked:''}}));announce('Разбор сохранён для '+draft.context.agentName);
 }
 if(!settings.approvalEnabled)return null;
 if(!draft)return <section className="bot-reply-approval bot-reply-empty"><header><ShieldCheck size={17}/><h3>Подтверждение ответов</h3></header><p>{human?'Диалог ведёт сотрудник. Подготовка ответов бота приостановлена.':context?'Бот может подготовить ответ на последнее сообщение клиента.':'Черновик появится после входящего сообщения у клиента с активным ответственным агентом.'}</p>{context&&!human&&<button type="button" disabled={!canEdit} data-permission="ai" onClick={refresh}><Sparkles size={14}/>Подготовить ответ</button>}</section>;
 return <section className="bot-reply-approval" aria-label="Ответ бота на подтверждение">
  <header><div><Bot size={18}/><h3>{pending?(stale?'Черновик устарел':human?'Черновик приостановлен':'AI ответ готов'):draft.status==='approved'?'Ответ подтверждён':'Ответ отклонён'}</h3></div><span className="bot-reply-status">{draft.context.agentName}</span></header>
  <p className="bot-reply-context">Этап: {draft.context.stage} · На сообщение: «{draft.context.request}»</p>
  {pending&&stale&&<p className="bot-reply-warning" role="status">Контекст изменился: сообщение, этап, агент или его инструкции. Обновите черновик перед подтверждением.</p>}
  {pending&&human&&<p className="bot-reply-warning">Диалог ведёт сотрудник. Подтверждение ответа бота приостановлено.</p>}
  {editing&&pending?<label>Подготовленный ответ<textarea aria-label="Редактировать подготовленный ответ" rows={4} disabled={!canEdit} value={draft.text} onChange={event=>updateDraft(current=>editBotReply(current,event.target.value,new Date().toISOString()))}/><small>Изменения сохраняются в черновике.</small></label>:<blockquote>{draft.text||'Черновик пуст — добавьте текст ответа.'}</blockquote>}
  {pending&&<div className="bot-reply-actions">
   <button type="button" className="primary" disabled={!canEdit||!ready} data-permission="edit" onClick={confirm}><Check size={14}/>Подтвердить</button>
   <button type="button" disabled={!canEdit} data-permission="edit" onClick={()=>{if(!canEdit)return;const next=decideBotReply(draft,context,'rejected',new Date().toISOString());if(next){updateDraft(()=>next);setEditing(false);announce('Ответ отклонён. Сообщение не отправлено.')}}}><X size={14}/>Отклонить</button>
   <button type="button" disabled={!canEdit} data-permission="edit" aria-pressed={editing} onClick={()=>{if(canEdit)setEditing(!editing)}}><Pencil size={14}/>{editing?'Готово':'Редактировать'}</button>
   {stale&&<button type="button" disabled={!canEdit||!context||human} data-permission="ai" onClick={refresh}><RefreshCw size={14}/>Обновить черновик</button>}
  </div>}
  {pending&&<details className="bot-reply-rewrite"><summary><Sparkles size={14}/>Редактировать с помощью ИИ</summary><label>Инструкция для правки<textarea rows={2} disabled={!canEdit||stale||human} value={draft.instructionDraft||''} onChange={event=>updateDraft(current=>({...current,instructionDraft:event.target.value}))} placeholder="Сократи ответ, сделай тон деловым, уточни бюджет…"/></label><button type="button" disabled={!canEdit||stale||human||!draft.instructionDraft?.trim()} data-permission="ai" onClick={()=>{if(!canEdit||stale||human)return;const result=rewriteBotReply(draft,draft.instructionDraft||'',new Date().toISOString());if(result.applied){updateDraft(()=>result.draft);announce('Правка применена к черновику. Проверьте результат.')}else announce('Локальная правка поддерживает краткость, деловой или дружелюбный тон, бюджет, созвон и команду «замени "текст" на "новый текст"».')}}><Sparkles size={14}/>Применить инструкцию</button>{draft.edits.length>0&&<small>Сохранено правок: {draft.edits.length}. Последняя: {draft.edits.at(-1)?.instruction}</small>}</details>}
  {draft.status==='rejected'&&context&&!human&&<button type="button" disabled={!canEdit} data-permission="ai" onClick={refresh}><RefreshCw size={14}/>Подготовить заново</button>}
  {settings.strictTraining&&<details className="bot-reply-training"><summary><GraduationCap size={15}/>Оспорить ответ · строгое обучение{feedback.some(item=>item.draftId===draft.id)?' · есть отзывы':''}</summary><p>Опишите, что сохранить и что исправить. Отзывы относятся к агенту {draft.context.agentName}.</p><div className="bot-feedback-fields"><label><span><ThumbsUp size={14}/>Что понравилось</span><textarea rows={2} disabled={!canEdit} value={draft.feedbackDraft?.liked||''} onChange={event=>updateDraft(current=>({...current,feedbackDraft:{liked:event.target.value,disliked:current.feedbackDraft?.disliked||''}}))}/></label><label><span><ThumbsDown size={14}/>Что не понравилось</span><textarea rows={2} disabled={!canEdit} value={draft.feedbackDraft?.disliked||''} onChange={event=>updateDraft(current=>({...current,feedbackDraft:{liked:current.feedbackDraft?.liked||'',disliked:event.target.value}}))}/></label></div><button type="button" disabled={!canEdit||(!draft.feedbackDraft?.liked.trim()&&!draft.feedbackDraft?.disliked.trim())} data-permission="edit" onClick={saveFeedback}>Сохранить разбор</button><small>Собрать и проверить изменения промпта можно в настройках ИИ и ботов.</small></details>}
  <footer><small>Локальный прототип · модель не подключена. Подтверждение добавляет текст в этот диалог.</small>{notice&&<span role="status">{notice}</span>}</footer>
 </section>;
}

export function BotReplyApprovalSettings({canEdit,notify}:{canEdit:boolean;notify?:(text:string)=>void}){
 const [config,setConfig]=useStored('bot-config-v2',initialBotReplyConfig),[agents]=useStored('agents',initialAgents);
 const [agentSettings,setAgentSettings]=useStored<AgentPromptSettings>('agent-settings',emptySettings);
 const [feedback,setFeedback]=useStored('bot-reply-feedback-v1',emptyFeedback),[revisions,setRevisions]=useStored('bot-prompt-revisions-v1',emptyRevisions);
 const [selectedAgent,setSelectedAgent]=useState(''),[notice,setNotice]=useState('');
 const agent=agents.find(item=>item.id===selectedAgent)||agents[0];
 const settings=botReplySettings(config);
 const agentFeedback=feedback.filter(item=>item.agentId===agent?.id);
 const unusedFeedback=agentFeedback.filter(item=>!item.appliedRevisionId);
 const revision=revisions.find(item=>item.agentId===agent?.id&&!item.appliedAt);
 const currentPrompt=agent?(agentSettings[agent.id]?.prompt??agent.note):'';
 const conflict=Boolean(revision&&revision.basePrompt!==currentPrompt);
 function announce(text:string){setNotice(text);notify?.(text)}
 function buildRevision(){
  if(!canEdit||!agent)return;
  const next=createBotPromptRevision(agent,agentSettings,feedback,crypto.randomUUID(),new Date().toISOString());
  if(!next)return;
  setRevisions(rows=>[next,...rows.filter(item=>item.agentId!==agent.id||item.appliedAt)]);announce('Предложение готово. Проверьте дополнение к действующему промпту.');
 }
 function applyRevision(){
  if(!canEdit||!revision)return;
  let latest=agentSettings;
  try{const raw=localStorage.getItem('life-agent-settings');if(raw)latest=JSON.parse(raw) as AgentPromptSettings}catch{announce('Не удалось проверить текущий промпт. Повторите после обновления страницы.');return}
  const result=applyBotPromptRevision(latest,agents,revision);
  if(!result.ok){announce(result.reason);return}
  const now=new Date().toISOString();
  setAgentSettings(result.settings);
  setRevisions(rows=>rows.map(item=>item.id===revision.id?{...item,appliedAt:now}:item));
  setFeedback(rows=>rows.map(item=>revision.feedbackIds.includes(item.id)?{...item,appliedRevisionId:revision.id}:item));
  announce('Уточнения добавлены в промпт агента '+revision.agentName+'. Исходный промпт сохранён в истории.');
 }
 return <section className="bot-approval-settings">
  <header><ShieldCheck size={19}/><div><h3>Подтверждение ответов и обучение</h3><p>Готовый ответ появляется в диалоге, а карточка клиента получает отметку «ИИ ответ готов».</p></div></header>
  <div className="bot-approval-mode"><label>Режим бота<Select disabled={!canEdit} value={config.mode} onChange={event=>{if(canEdit)setConfig(current=>({...current,mode:event.target.value}))}}>{['С подтверждением','Автоматический','Только оператор'].map(mode=><option key={mode}>{mode}</option>)}</Select><small>Общий режим с лабораторией AI.</small></label><label className="bot-training-toggle"><input type="checkbox" disabled={!canEdit||!settings.approvalEnabled} checked={settings.strictTraining} onChange={event=>{if(canEdit)setConfig(current=>({...current,strictTraining:event.target.checked}))}}/><span>Строгое обучение<small>Собирать разборы «понравилось / не понравилось» для промпта ответственного агента.</small></span></label></div>
  <p className="bot-approval-local">Черновики и правки формируются локально. Внешняя модель и отправка в каналы пока не подключены.</p>
  <div className="bot-prompt-training"><div className="bot-training-heading"><div><h4>Обратная связь по агенту</h4><p>Соберите отзывы в дополнение, проверьте текст и примените его отдельным действием.</p></div><GraduationCap size={22}/></div>
   <label>Агент для обучения<Select value={agent?.id||''} disabled={!agents.length} onChange={event=>setSelectedAgent(event.target.value)}>{!agents.length&&<option value="">Нет агентов</option>}{agents.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
   <div className="bot-training-toolbar"><small>Отзывов: {agentFeedback.length} · Новых: {unusedFeedback.length}</small><button type="button" disabled={!canEdit||!unusedFeedback.length||!agent} data-permission="edit" onClick={buildRevision}><Sparkles size={14}/>{revision?'Пересобрать предложение':'Собрать улучшение промпта'}</button></div>
   {agentFeedback.length>0&&<details className="bot-training-history"><summary>Посмотреть отзывы</summary>{agentFeedback.slice().reverse().map(item=><article key={item.id}><small>{item.stage} · {item.appliedRevisionId?'Учтён в промпте':'Новый отзыв'}</small><p>Клиент: {item.request}</p><blockquote>{item.replyText}</blockquote>{item.liked&&<p><ThumbsUp size={12}/>{item.liked}</p>}{item.disliked&&<p><ThumbsDown size={12}/>{item.disliked}</p>}</article>)}</details>}
   {!agentFeedback.length&&<p className="bot-training-empty">Включите строгое обучение и сохраните первый разбор ответа в диалоге.</p>}
   {revision&&<div className="bot-prompt-revision"><h4>Проверка изменений · {revision.agentName}</h4><small>Использовано отзывов: {revision.feedbackIds.length}</small>{conflict&&<p className="bot-reply-warning" role="alert">Промпт уже изменился. Пересоберите предложение, чтобы сохранить новые инструкции.</p>}<details><summary>Исходный промпт — сохраняется целиком</summary><pre>{revision.basePrompt||'Промпт пуст'}</pre></details><label>Будет добавлено к промпту<textarea rows={7} disabled={!canEdit} value={revision.addition} onChange={event=>{if(canEdit)setRevisions(rows=>rows.map(item=>item.id===revision.id?{...item,addition:event.target.value}:item))}}/></label><button type="button" className="primary" disabled={!canEdit||conflict||!revision.addition.trim()} data-permission="edit" onClick={applyRevision}><Check size={14}/>Применить к агенту {revision.agentName}</button></div>}
   {revisions.some(item=>item.agentId===agent?.id&&item.appliedAt)&&<details className="bot-training-history"><summary>История применённых изменений</summary>{revisions.filter(item=>item.agentId===agent?.id&&item.appliedAt).map(item=><article key={item.id}><small>{new Date(item.appliedAt!).toLocaleString('ru-RU')}</small><pre>{item.addition}</pre><details><summary>Промпт до изменения</summary><pre>{item.basePrompt||'Промпт пуст'}</pre></details></article>)}</details>}
  </div>{notice&&<p className="bot-settings-notice" role="status">{notice}</p>}
 </section>;
}
