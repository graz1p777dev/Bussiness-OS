'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,Check,CheckCheck,Code2,GitCompareArrows,MessageSquare,Send,Settings2,SlidersHorizontal,Sparkles} from 'lucide-react';
import {Modal} from '../components/os/ui';
import Select from '../components/os/Select';
import {useStored} from '../lib/os/storage';
import {initialAgents,initialDeals} from '../lib/os/data';
import type {ChatMessage} from '../lib/os/conversations';
import {initialStageConfig} from '../lib/os/stage-config';
import {analyzePromptSlice,applyPromptToSettings,buildPromptSuggestions,composeManagedPrompt,emptyPromptAnswers,filterPromptDeals,initialPromptFilters,promptDealPipeline,promptDiff,promptQuestions,type AgentPromptSettings,type PromptAnalysis,type PromptFilters,type PromptSuggestion} from '../lib/os/prompt-manager';
import './PromptManager.css';

type Review={agentId:string;agentName:string;basePrompt:string;suggestions:PromptSuggestion[];analysis:PromptAnalysis};
type Props={close:()=>void;notify?:(message:string)=>void;canEdit?:boolean};
const phases=['Знакомство','Выбор данных','Проверка изменений'];
export default function PromptManager({close,notify,canEdit=true}:Props){
 const [deals]=useStored('deals',initialDeals),[messages]=useStored<Record<string,ChatMessage[]>>('messages',{}),[agents]=useStored('agents',initialAgents);
 const [settings,setSettings]=useStored<AgentPromptSettings>('agent-settings',{}),[stages]=useStored('stage-config-v3',initialStageConfig);
 const [phase,setPhase]=useState(0),[question,setQuestion]=useState(0),[answers,setAnswers]=useState(emptyPromptAnswers),[input,setInput]=useState('');
 const [filters,setFilters]=useState(initialPromptFilters),[agentId,setAgentId]=useState(''),[review,setReview]=useState<Review|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState('');
 const composer=useRef<HTMLTextAreaElement>(null),conversationEnd=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null);
 const agent=agents.find(item=>item.id===agentId)||agents[0];
 const chosenDeals=filterPromptDeals(deals,filters),analysis=analyzePromptSlice(chosenDeals,messages);
 const funnelDeals=deals.filter(deal=>filters.pipelines.includes(promptDealPipeline(deal)));
 const stageOptions=[...new Set([...filters.pipelines.flatMap(pipeline=>(pipeline==='Продажи'?stages.sales:stages.repeat).map(stage=>stage.name)),...funnelDeals.map(deal=>deal.status),...filters.includeStages,...filters.excludeStages])];
 const sourceOptions=[...new Set([...deals.map(deal=>deal.channel),...filters.includeSources,...filters.excludeSources])];
 const approvedSuggestions=review?.suggestions.filter(suggestion=>selected.includes(suggestion.id))||[];
 const nextPrompt=review?composeManagedPrompt(review.basePrompt,approvedSuggestions):'';
 const diff=review?promptDiff(review.basePrompt,nextPrompt):[];
 const currentAgent=review?agents.find(item=>item.id===review.agentId):undefined;
 const stale=Boolean(review&&(!currentAgent||(settings[review.agentId]?.prompt??currentAgent.note)!==review.basePrompt));
 useEffect(()=>{root.current?.closest('.modal')?.scrollTo({top:0});if(phase===0){composer.current?.focus();conversationEnd.current?.scrollIntoView({block:'nearest'})}},[phase,question]);

 function submitAnswer(){
  const value=input.trim();if(!value)return;
  const next={...answers,[promptQuestions[question].key]:value};setAnswers(next);setError('');
  if(question<promptQuestions.length-1){setQuestion(question+1);setInput(next[promptQuestions[question+1].key])}
  else {setPhase(1);setInput('')}
 }
 function editAnswer(index:number){setQuestion(index);setInput(answers[promptQuestions[index].key]);setPhase(0);setError('')}
 function chooseFilter(kind:'Stages'|'Sources',value:string,mode:'all'|'include'|'exclude'){
  const includeKey=kind==='Stages'?'includeStages':'includeSources',excludeKey=kind==='Stages'?'excludeStages':'excludeSources';
  setFilters(current=>({...current,[includeKey]:[...current[includeKey].filter(item=>item!==value),...(mode==='include'?[value]:[])],[excludeKey]:[...current[excludeKey].filter(item=>item!==value),...(mode==='exclude'?[value]:[])]}));
 }
 function prepareReview(){
  if(!agent||!chosenDeals.length)return;
  const suggestions=buildPromptSuggestions(answers,filters,analysis);
  setReview({agentId:agent.id,agentName:agent.name,basePrompt:settings[agent.id]?.prompt??agent.note,suggestions,analysis});
  setSelected(suggestions.map(suggestion=>suggestion.id));setPhase(2);setError('');
 }
 function apply(){
  if(!canEdit||!review||!approvedSuggestions.length||stale)return;
  try{
   const stored=localStorage.getItem('life-agent-settings');
   const latest:AgentPromptSettings=stored?JSON.parse(stored):settings;
   if(!latest||typeof latest!=='object'||Array.isArray(latest))throw new Error('Не удалось прочитать настройки агентов. Закройте окно и проверьте настройки.');
   if((latest[review.agentId]?.prompt??currentAgent?.note)!==review.basePrompt){setError('Промпт изменился после проверки. Вернитесь к выбору данных и подготовьте изменения заново.');return}
   const updated=applyPromptToSettings(latest,review.agentId,nextPrompt);
   localStorage.setItem('life-agent-settings',JSON.stringify(updated));
   setSettings(updated);window.dispatchEvent(new CustomEvent('storage-custom',{detail:{key:'life-agent-settings'}}));
   setPhase(3);notify?.('Промпт агента '+review.agentName+' обновлён');
  }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось сохранить промпт. Проверьте доступ к локальному хранилищу.')}
 }
 function filterRows(kind:'Stages'|'Sources',options:string[]){
  const included=kind==='Stages'?filters.includeStages:filters.includeSources,excluded=kind==='Stages'?filters.excludeStages:filters.excludeSources;
  return <div className="pm-filter-rows">{options.map(value=>{const mode=excluded.includes(value)?'exclude':included.includes(value)?'include':'all';return <div className="pm-filter-row" key={value}><span>{value||'Без источника'}</span><div role="group" aria-label={value||'Без источника'}>{(['all','include','exclude'] as const).map((choice,index)=><button type="button" key={choice} className={mode===choice?'selected '+choice:''} aria-pressed={mode===choice} aria-label={['Любое: ','Учитывать: ','Исключить: '][index]+value} onClick={()=>chooseFilter(kind,value,choice)}>{['Любое','Учитывать','Исключить'][index]}</button>)}</div></div>})}</div>;
 }

 return <Modal title="Prompt — автонастройка агента" close={close} wide><div className="prompt-manager" ref={root}>
  <div className="pm-status"><span><span className="pm-local-dot"/>Локальный помощник настройки</span><span>Модель не подключена</span></div>
  {phase<3&&<ol className="pm-phases">{phases.map((title,index)=><li key={title} className={phase===index?'current':phase>index?'complete':''}><button type="button" disabled={index>phase} aria-current={phase===index?'step':undefined} onClick={()=>{if(index===0)editAnswer(question);else {setPhase(index);setError('')}}}><span>{phase>index?<Check size={13}/>:index+1}</span>{title}</button></li>)}</ol>}
  {phase===0&&<div className="pm-interview">
   <section className="pm-chat">
    <div className="pm-intro"><div className="pm-assistant-icon"><Sparkles size={20}/></div><div><h3>Настроим агента под ваш бизнес</h3><p>Четыре вопроса, выбор диалогов и проверка промпта перед сохранением.</p></div></div>
    <div className="pm-conversation" aria-live="polite">{promptQuestions.slice(0,question+1).map((item,index)=><div className="pm-exchange" key={item.key}><div className="pm-question"><span>Prompt</span><p>{item.question}</p></div>{index<question&&<div className="pm-answer"><p>{answers[item.key]}</p><button type="button" onClick={()=>editAnswer(index)}>Изменить ответ</button></div>}</div>)}<div ref={conversationEnd}/></div>
    <form className="pm-composer" onSubmit={event=>{event.preventDefault();submitAnswer()}}><label htmlFor="pm-answer-input">{promptQuestions[question].title}<span>{question+1} из {promptQuestions.length}</span></label><textarea id="pm-answer-input" ref={composer} rows={3} value={input} maxLength={3000} placeholder={promptQuestions[question].placeholder} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();submitAnswer()}}}/><div><small>Enter — отправить · Shift + Enter — новая строка</small><button className="primary" disabled={!input.trim()} type="submit" aria-label="Отправить ответ"><Send size={15}/>Отправить</button></div></form>
   </section>
   <aside className="pm-interview-aside"><Code2 size={25}/><h3>От задачи к инструкции</h3><p>Ваши ответы станут основой промпта. Затем помощник проверит выбранные сделки и сохранённые сообщения.</p><ul>{promptQuestions.map((item,index)=><li key={item.key} className={answers[item.key]?'done':question===index?'active':''}>{answers[item.key]?<Check size={15}/>:<span className="pm-question-dot"/>}{item.title}</li>)}</ul><div className="pm-aside-note">Вы сами выберете предложения, которые попадут в настройки агента.</div></aside>
  </div>}
  {phase===1&&<div className="pm-audience">
   <div className="pm-audience-main"><div className="pm-section-heading"><SlidersHorizontal size={21}/><div><h3>Какие диалоги разобрать?</h3><p>Условия пересекаются. Исключения имеют приоритет.</p></div></div>
    <label className="pm-agent-field">Агент для настройки<Select value={agent?.id||''} onChange={event=>setAgentId(event.target.value)} aria-label="Агент для настройки">{!agents.length&&<option value="">Нет агентов</option>}{agents.map(item=><option key={item.id} value={item.id}>{item.name}{item.status==='Активен'?'':' · '+item.status}</option>)}</Select></label>
    <fieldset className="pm-fieldset"><legend>Воронки</legend><div className="pm-funnels">{(['Продажи','Повторные продажи'] as const).map(pipeline=><button type="button" key={pipeline} aria-pressed={filters.pipelines.includes(pipeline)} className={filters.pipelines.includes(pipeline)?'selected':''} onClick={()=>setFilters(current=>({...current,pipelines:current.pipelines.includes(pipeline)?current.pipelines.filter(value=>value!==pipeline):[...current.pipelines,pipeline]}))}><span className="pm-check">{filters.pipelines.includes(pipeline)&&<Check size={13}/>}</span><span>{pipeline}<small>{deals.filter(deal=>promptDealPipeline(deal)===pipeline).length} сделок</small></span></button>)}</div><small>Закрытые сделки учитываются по исходной воронке; если она не указана — «Продажи».</small></fieldset>
    <label className="pm-agent-field">Результат сделки<Select aria-label="Результат сделки" value={filters.purchase} onChange={event=>setFilters(current=>({...current,purchase:event.target.value as PromptFilters['purchase']}))}><option value="all">Все клиенты</option><option value="bought">Купили — успешная сделка</option><option value="not-bought">Не купили — нет успешной сделки</option></Select><small>«Не купили» включает открытые и неуспешные сделки. Статус оплаты по переписке не угадывается.</small></label>
    <details className="pm-filter-section" open><summary>Источники <span>{filters.includeSources.length+filters.excludeSources.length?`${filters.includeSources.length} включено, ${filters.excludeSources.length} исключено`:'Все источники'}</span></summary>{filterRows('Sources',sourceOptions)}</details>
    <details className="pm-filter-section"><summary>Этапы <span>{filters.includeStages.length+filters.excludeStages.length?`${filters.includeStages.length} включено, ${filters.excludeStages.length} исключено`:'Все этапы'}</span></summary>{filterRows('Stages',stageOptions)}</details>
    <p className="pm-filter-help">«Учитывать» сужает выборку до отмеченных значений. Если ничего не отмечено, учитываются все значения кроме исключённых.</p>
   </div>
   <aside className="pm-evidence"><header><MessageSquare size={17}/><h3>В выбранных данных</h3></header><div className="pm-evidence-count"><strong>{analysis.deals}</strong><span>сделок из {deals.length}</span></div><dl><div><dt>С сохранённой перепиской</dt><dd>{analysis.withMessages}</dd></div><div><dt>Сообщений</dt><dd>{analysis.savedMessages}</dd></div><div><dt>Входящих / исходящих</dt><dd>{analysis.incoming} / {analysis.outgoing}</dd></div><div><dt>Последнее — от клиента</dt><dd>{analysis.unanswered}</dd></div><div><dt>Успешных сделок</dt><dd>{analysis.bought}</dd></div></dl>{analysis.deals===0?<p className="pm-empty">Нет подходящих сделок. Измените условия, чтобы продолжить.</p>:!analysis.savedMessages?<p className="pm-evidence-note">Сохранённых сообщений нет. Предложения будут основаны на ваших ответах и карточках сделок.</p>:<p className="pm-evidence-note">Разбор использует текст сохранённых сообщений. Демо-реплики на экране диалога не считаются перепиской.</p>}{analysis.topics.length>0&&<div className="pm-topic-list"><h4>Темы по ключевым словам</h4>{analysis.topics.map(topic=><div key={topic.id}><span>{topic.label}</span><b>{topic.count}</b></div>)}</div>}<button type="button" className="pm-reset" onClick={()=>setFilters(initialPromptFilters)}>Сбросить фильтры</button></aside>
   <footer className="pm-footer"><button type="button" onClick={()=>editAnswer(3)}><ArrowLeft size={15}/>К ответам</button><button type="button" className="primary" disabled={!analysis.deals||!agent} onClick={prepareReview}>Подготовить изменения<ArrowRight size={15}/></button></footer>
  </div>}
  {phase===2&&review&&<div className="pm-review"><div className="pm-review-heading"><div className="pm-section-heading"><GitCompareArrows size={22}/><div><h3>Проверьте изменения для {review.agentName}</h3><p>Основа: ваши ответы, {review.analysis.deals} сделок и {review.analysis.savedMessages} сохранённых сообщений.</p></div></div><span>{approvedSuggestions.length} из {review.suggestions.length} выбрано</span></div>
   <div className="pm-review-grid"><section className="pm-suggestions" aria-label="Предложения для промпта">{review.suggestions.map(suggestion=><article key={suggestion.id} className={selected.includes(suggestion.id)?'included':''}><label><input type="checkbox" checked={selected.includes(suggestion.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,suggestion.id]:current.filter(id=>id!==suggestion.id))}/><strong>{suggestion.title}</strong></label><p>{suggestion.reason}</p><details><summary>Изменить текст</summary><textarea aria-label={'Текст предложения: '+suggestion.title} value={suggestion.text} onChange={event=>setReview(current=>current?{...current,suggestions:current.suggestions.map(item=>item.id===suggestion.id?{...item,text:event.target.value}:item)}:current)}/></details></article>)}</section>
    <section className="pm-diff" aria-label="Изменения промпта"><header><Code2 size={15}/><span>{review.agentName} / System Prompt</span><b>+{diff.filter(line=>line.kind==='added').length} <em>−{diff.filter(line=>line.kind==='removed').length}</em></b></header><div className="pm-diff-body" key={selected.join(',')}>{diff.length?diff.map((line,index)=><div key={index} className={'pm-diff-line '+line.kind} style={{'--pm-line-delay':Math.min(index*22,480)+'ms'} as CSSProperties}><span aria-hidden="true">{line.after??line.before}</span><i aria-hidden="true">{line.kind==='added'?'+':line.kind==='removed'?'−':' '}</i><code>{line.text||' '}</code></div>):<p>Выберите хотя бы одно предложение, чтобы увидеть изменения.</p>}</div><details className="pm-full-prompt"><summary>Полный промпт после сохранения</summary><pre>{nextPrompt}</pre></details></section>
   </div>
   <p className="pm-review-note">Предложения собраны локальными правилами. Сохранение обновит System Prompt выбранного агента. Сообщения клиентам не отправляются.</p>
   {(error||stale)&&<p role="alert" className="pm-error">{error||'Промпт или агент изменился после проверки. Вернитесь к выбору данных и подготовьте изменения заново.'}</p>}
   {!canEdit&&<p className="pm-error">Для сохранения нужны права на редактирование агентов.</p>}
   <footer className="pm-footer"><button type="button" onClick={()=>{setPhase(1);setError('')}}><ArrowLeft size={15}/>Изменить выборку</button><button type="button" className="primary" data-permission="edit" disabled={!canEdit||stale||!diff.length||approvedSuggestions.some(suggestion=>!suggestion.text.trim())} onClick={apply}><CheckCheck size={16}/>Применить к агенту</button></footer>
  </div>}
  {phase===3&&review&&<section className="pm-success"><span><CheckCheck size={30}/></span><h3>Промпт сохранён</h3><p>В настройках {review.agentName} обновлён System Prompt. Добавлено правил: {approvedSuggestions.length}.</p><div><Settings2 size={16}/>Остальные параметры агента сохранены.</div><p className="pm-success-note">Настройка действует в локальном демо. Для ответов модели необходимо её подключение.</p><button type="button" className="primary" onClick={close}>Готово</button></section>}
 </div></Modal>;
}
