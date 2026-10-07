'use client';
import {useEffect,useState} from 'react';
import {Workflow,Plus,Play,Pause,Pencil,Trash2,ArrowUpRight,CheckCircle2,Clock,AlertCircle,Copy,Download,Search,ArrowRight} from 'lucide-react';
import {Modal,Drawer,Badge,SearchField} from '../components/os/ui';
import Select from '../components/os/Select';
import {useStored} from '../lib/os/storage';
import {initialDeals,initialTasks,initialAgents,type Entity} from '../lib/os/data';
import {initialInventory} from '../lib/os/inventory-model';
import {useDealStages,initialStageConfig} from '../lib/os/stage-config';
import {initialEmployees,type ActionPermissions} from '../lib/os/team';
import {runWorkflow,workflowClientChanges} from '../lib/os/workflow';
import {validateWorkflow} from '../lib/os/workflow-validation';
import {parseWorkflowImport} from '../lib/os/workflow-schema';
import {applyBlueprint} from '../lib/os/business-blueprint';
import {automationFingerprint,linkStarterAutomations,type AutomationRecord,type AutomationGraph} from '../lib/os/automations';
import {downloadText} from '../lib/os/export';
import './AutomationWorkspace.css';

type Props={initialData:Record<string,Entity[]>;search:string;setSearch:(value:string)=>void;notify:(message:string)=>void;audit:(message:string)=>void;go:(route:string)=>void;permissions?:ActionPermissions;createSignal?:number;canApplyClientChanges?:boolean};
type Run={id:string;automationId:string;automationName:string;workflowId:string;clientId:string;clientName:string;date:string;signature:string;approved:string[];result?:ReturnType<typeof runWorkflow>;error?:string;appliedAt?:string};
const events:Record<string,string>={'lead.created':'Новый лид','message.received':'Входящее сообщение','deal.updated':'Смена этапа','timer.24h':'Повторный контакт через 24 часа','order.paid':'Подтверждение оплаты','stock.low':'Проверка остатков','manual':'Ручной запуск'};
function read<T>(key:string,fallback:T):T{const raw=localStorage.getItem('life-'+key);return raw===null?fallback:JSON.parse(raw) as T}
function signal(keys:string[]){for(const key of keys)window.dispatchEvent(new CustomEvent('storage-custom',{detail:{key:'life-'+key}}))}
function status(run:Run){return run.error?'Ошибка':run.appliedAt?'Изменения применены':run.result?.waitingFor?'Ожидает решения':run.result?.journal.length===1&&run.result.journal[0].status==='skipped'?'Условие не совпало':'Тест завершён'}

export default function AutomationWorkspace(props:Props){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;Promise.resolve().then(()=>{
  const business={...props.initialData,...read<Record<string,Entity[]>>('business-modules-v1',props.initialData)};
  const library=read<AutomationGraph[]>('workflow-library-v1',[]);
  const config=read('stage-config-v3',initialStageConfig);
  const {records,library:linked}=linkStarterAutomations(business.automations,library,'Workspace',config.sales.map(stage=>stage.name));
  if(records.some((record,i)=>record!==business.automations[i])||linked.length!==library.length){applyBlueprint(localStorage,{'life-business-modules-v1':{...business,automations:records},'life-workflow-library-v1':linked});signal(['business-modules-v1','workflow-library-v1'])}
  if(active)setReady(true);
 }).catch(()=>{if(active)setError('Не удалось прочитать сохранённые сценарии. Данные сохранены без изменений.')});return()=>{active=false}},[props.initialData]);
 if(error)return <section className="panel empty" role="alert">{error}</section>;
 return ready?<AutomationContent {...props}/>:<section className="panel empty">Подготавливаем сценарии…</section>;
}

function AutomationContent({initialData,search,setSearch,notify,audit,go,permissions,createSignal=0,canApplyClientChanges=true}:Props){
 const canCreate=permissions?.create??true,canEdit=permissions?.edit??true,canRemove=permissions?.remove??true,canRun=permissions?.ai??true,canExport=permissions?.export??true;
 const [business,setBusiness]=useStored<Record<string,Entity[]>>('business-modules-v1',initialData);
 const records=(business.automations||[]) as AutomationRecord[];
 const [library]=useStored<AutomationGraph[]>('workflow-library-v1',[]);
 const [deals,setDeals]=useStored('deals',initialDeals),[tasks]=useStored('tasks',initialTasks),[inventory]=useStored('inventory-v2',initialInventory),[employees]=useStored('team-employees-v3',initialEmployees);
 const [agents]=useStored('agents',initialAgents);
 const [runs,setRuns]=useStored<Run[]>('automation-runs-v1',[]);
 const [filter,setFilter]=useState('Все'),[editing,setEditing]=useState<AutomationRecord|null>(null),[formOpen,setFormOpen]=useState(false),[deleteId,setDeleteId]=useState(''),[testId,setTestId]=useState(''),[clientId,setClientId]=useState(''),[opened,setOpened]=useState('');
 const selectedClient=deals.find(client=>client.id===(clientId||deals[0]?.id));
 const {config}=useDealStages();
 const stagesFor=(client:Entity)=>config[client.pipeline==='Повторные продажи'?'repeat':'sales'].map(stage=>stage.name);
 const contextFor=(client:Entity)=>({clients:deals,tasks,inventory,agents,stages:config[client.pipeline==='Повторные продажи'?'repeat':'sales']});
 const currentRun=runs.find(run=>run.id===opened);
 const currentRecord=currentRun?records.find(record=>record.id===currentRun.automationId):undefined;
 const currentFlow=currentRecord?library.find(flow=>flow.id===currentRecord.workflowId):undefined;
 const currentClient=currentRun?deals.find(client=>client.id===currentRun.clientId):undefined;
 const fresh=Boolean(currentRun&&currentFlow&&currentClient&&currentRun.workflowId===currentFlow.id&&currentRun.signature===automationFingerprint(currentFlow,currentClient,contextFor(currentClient),stagesFor(currentClient)));
 const changes=currentRun?.result&&currentClient?workflowClientChanges(currentClient,currentRun.result.updated):{};
 const pending=Object.keys(changes).length>0;
 const seenCreate=createSignal>0;
 const [handledCreate,setHandledCreate]=useState(0);
 useEffect(()=>{if(seenCreate&&createSignal!==handledCreate){queueMicrotask(()=>{setHandledCreate(createSignal);if(canCreate){setEditing(null);setFormOpen(true)}})}},[createSignal,handledCreate,seenCreate,canCreate]);
 const replace=(next:AutomationRecord[])=>setBusiness(value=>({...value,automations:next}));
 function add(){setEditing(null);setFormOpen(true)}
 function save(form:HTMLFormElement){
  if(editing?!canEdit:!canCreate)return;
  const data=new FormData(form),name=String(data.get('name')||'').trim(),workflowId=String(data.get('workflowId')||'');
  if(!name){notify('Укажите название автоматизации');return}
  if(!library.some(flow=>flow.id===workflowId)){notify('Выберите сохранённый сценарий');return}
  const record:AutomationRecord={...editing,id:editing?.id||crypto.randomUUID(),name,value:editing?.value||0,status:String(data.get('status')||'Пауза'),channel:String(data.get('channel')||'manual'),owner:String(data.get('owner')||'Ответственный за сделку'),note:String(data.get('note')||'').trim(),workflowId};
  replace(editing?records.map(item=>item.id===record.id?record:item):[record,...records]);setFormOpen(false);audit((editing?'Изменена':'Создана')+' автоматизация: '+name);notify('Автоматизация сохранена');
 }
 function openBuilder(record:AutomationRecord){
  if(!canEdit)return;
  const flow=library.find(item=>item.id===record.workflowId);if(!flow){notify('Сначала назначьте сохранённый сценарий');return}
  try{
   const graph=parseWorkflowImport(flow);
   const nodes=read<AutomationGraph['nodes']>('nodes',[]),edges=read<AutomationGraph['edges']>('edges',[]),versions=read<{nodes:AutomationGraph['nodes'];edges:AutomationGraph['edges']}[]>('workflow-versions',[]);
   applyBlueprint(localStorage,{'life-nodes':graph.nodes,'life-edges':graph.edges,'life-workflow-versions':nodes.length||edges.length?[...versions,{nodes,edges}].slice(-30):versions});signal(['nodes','edges','workflow-versions']);audit('В Builder открыта автоматизация: '+record.name);go('builder');notify('Сценарий открыт. Предыдущая схема сохранена в версиях.');
  }catch(error){notify(error instanceof Error?error.message:'Не удалось открыть сценарий')}
 }
 function execute(record:AutomationRecord,client:Entity,previous?:Run){
  if(!canRun)return;
  const flow=library.find(item=>item.id===record.workflowId);
  if(!flow){notify('У автоматизации нет сохранённого сценария');return}
  if(previous&&(!currentRun||!fresh)){notify('Данные или сценарий изменились. Запустите новый тест.');return}
  const approved=previous?.result?.waitingFor?[...previous.approved,previous.result.waitingFor]:[];
  let next:Run={id:previous?.id||crypto.randomUUID(),automationId:record.id,automationName:record.name,workflowId:flow.id,clientId:client.id,clientName:client.name,date:previous?.date||new Date().toISOString(),signature:automationFingerprint(flow,client,contextFor(client),stagesFor(client)),approved};
  try{const problems=validateWorkflow(flow.nodes,flow.edges,stagesFor(client));if(problems.length)throw new Error(problems.join('. '));next={...next,result:runWorkflow(flow.nodes,flow.edges,client,contextFor(client),{approvedNodes:approved,now:next.date})}}catch(error){next={...next,error:error instanceof Error?error.message:'Не удалось выполнить тест'}}
  setRuns(value=>[next,...value.filter(run=>run.id!==next.id)].slice(0,30));setTestId('');setOpened(next.id);audit('Локальный тест автоматизации: '+record.name+' · '+status(next));
 }
 function applyRun(){
  if(!canEdit||!canApplyClientChanges||!pending||!currentRun?.result||currentRun.result.waitingFor||currentRun.appliedAt)return;
  if(!fresh){notify('Данные или сценарий изменились. Запустите новый тест.');return}
  const updated=currentRun.result.updated;
  setDeals(value=>value.map(client=>client.id===updated.id?{...client,...changes,updatedAt:new Date().toISOString()}:client));
  setRuns(value=>value.map(run=>run.id===currentRun.id?{...run,appliedAt:new Date().toISOString()}:run));audit('Автоматизация обновила клиента: '+updated.name+' · '+updated.status+' · '+updated.owner);notify('Изменения клиента применены');
 }
 const visibleRuns=runs.filter(run=>(run.automationName+' '+run.clientName+' '+status(run)).toLowerCase().includes(search.toLowerCase()));
 const visible=records.filter(record=>(record.name+' '+record.note+' '+record.owner+' '+(events[record.channel]||record.channel)).toLowerCase().includes(search.toLowerCase())&&(filter==='Все'||filter==='Активные'&&record.status==='Активно'||filter==='Пауза'&&record.status!=='Активно'));
 return <div className="automation-workspace">
  <header className="automation-heading"><div><span className="automation-eyebrow"><Workflow size={16}/>Автоматизации</span><h2>Повторяющиеся задачи — по сценарию</h2><p>Выберите схему, проверьте её на клиенте и примените результат.</p></div><div className="row"><button onClick={()=>go('builder')}>Agent Builder <ArrowUpRight size={15}/></button><button data-permission="create" className="primary" disabled={!canCreate||!library.length} onClick={add}><Plus size={16}/>Новая автоматизация</button></div></header>
  <div className="automation-stats"><div><small>Сценариев</small><strong>{records.length}</strong></div><div><small>Включено</small><strong>{records.filter(record=>record.status==='Активно').length}</strong></div><div><small>Локальных тестов</small><strong>{runs.length}</strong></div><div><small>Ожидают решения</small><strong>{runs.filter(run=>run.result?.waitingFor).length}</strong></div></div>
  <div className="automation-local-note"><Clock size={17}/><span>Сейчас доступны ручные локальные тесты. Автоматический запуск по событиям и расписанию потребует подключения сервера. Сообщения сохраняются как черновики теста.</span></div>
  <div className="toolbar"><div className="tabs">{['Все','Активные','Пауза','История'].map(name=><button key={name} className={filter===name?'selected':''} onClick={()=>setFilter(name)}>{name}</button>)}</div><SearchField value={search} set={setSearch} placeholder={filter==='История'?'Поиск запуска':'Поиск автоматизации'}/></div>
  {filter==='История'?<div className="automation-history">{visibleRuns.map(run=><button key={run.id} className="automation-history-row" onClick={()=>setOpened(run.id)}><Workflow size={20}/><span><b>{run.automationName}</b><small>{run.clientName} · {new Date(run.date).toLocaleString('ru-RU')}</small></span><Badge tone={run.error?'red':run.result?.waitingFor?'orange':'green'}>{status(run)}</Badge><ArrowUpRight size={16}/></button>)}{!visibleRuns.length&&<div className="panel empty">{runs.length?'Запусков по этому запросу нет.':'Запустите тест сценария — здесь появятся проверяемые результаты.'}</div>}</div>:<div className="automation-grid">{visible.map(record=>{const flow=library.find(item=>item.id===record.workflowId),last=runs.find(run=>run.automationId===record.id);return <article className="panel automation-card" key={record.id}><div className="row-between"><span className="automation-icon"><Workflow size={22}/></span><Badge tone={record.status==='Активно'?'green':''}>{record.status==='Активно'?'Включена':'Пауза'}</Badge></div><h3>{record.name}</h3><p>{record.note||'Локальная цепочка событий, условий и действий.'}</p><div className="automation-graph-summary">{flow?<>{flow.nodes.slice(0,4).map((node,index)=><span key={node.id}>{index>0&&<ArrowRight size={12}/>}<span>{String(node.data.label||node.data.kind)}</span></span>)}{flow.nodes.length>4&&<span>+{flow.nodes.length-4}</span>}</>:<span><AlertCircle size={15}/>Сценарий не назначен</span>}</div><dl><div><dt>Событие</dt><dd>{events[record.channel]||record.channel}</dd></div><div><dt>Схема</dt><dd>{flow?.name||'Выберите при настройке'}</dd></div><div><dt>Ответственный</dt><dd>{record.owner}</dd></div></dl>{last&&<button className="automation-last-run" onClick={()=>setOpened(last.id)}><Clock size={14}/>{status(last)} · {new Date(last.date).toLocaleDateString('ru-RU')}<ArrowUpRight size={13}/></button>}<footer><button data-permission="ai" className="primary" disabled={!canRun||!flow||!deals.length} onClick={()=>setTestId(record.id)}><Play size={14}/>Проверить</button><button data-permission="edit" disabled={!canEdit||!flow} onClick={()=>openBuilder(record)}>В Builder <ArrowUpRight size={14}/></button><button data-permission="edit" disabled={!canEdit} aria-label={'Настроить '+record.name} onClick={()=>{setEditing(record);setFormOpen(true)}}><Pencil size={14}/></button><button data-permission="edit" disabled={!canEdit} aria-label={(record.status==='Активно'?'Приостановить ':'Включить ')+record.name} onClick={()=>{if(!canEdit)return;replace(records.map(item=>item.id===record.id?{...item,status:item.status==='Активно'?'Пауза':'Активно'}:item));audit('Изменён статус автоматизации: '+record.name)}}>{record.status==='Активно'?<Pause size={14}/>:<Play size={14}/>}</button><button data-permission="remove" disabled={!canRemove} aria-label={'Удалить '+record.name} onClick={()=>setDeleteId(record.id)}><Trash2 size={14}/></button></footer></article>})}{!visible.length&&<div className="panel empty"><Search size={24}/><p>{records.length?'Автоматизаций по этому запросу нет.':'Создайте автоматизацию из сохранённого сценария Builder.'}</p></div>}</div>}
  {formOpen&&<Modal title={editing?'Настроить автоматизацию':'Новая автоматизация'} close={()=>setFormOpen(false)}><form data-permission={editing?'edit':'create'} onSubmit={event=>{event.preventDefault();save(event.currentTarget)}}><label>Название<input name="name" required autoFocus defaultValue={editing?.name} placeholder="Например, повторный контакт"/></label><label>Сохранённый сценарий<Select name="workflowId" defaultValue={editing?.workflowId||library[0]?.id||''}>{!library.length&&<option value="">Сначала сохраните схему в Builder</option>}{editing?.workflowId&&!library.some(flow=>flow.id===editing.workflowId)&&<option value={editing.workflowId}>Сценарий удалён — выберите другой</option>}{library.map(flow=><option key={flow.id} value={flow.id}>{flow.name} · {flow.nodes.length} блоков</option>)}</Select><small>Чтобы изменить схему, сохраните новую версию в Builder и выберите её здесь.</small></label><div className="form-grid"><label>Событие<Select name="channel" defaultValue={editing?.channel||'manual'}>{Object.entries(events).map(([key,label])=><option key={key} value={key}>{label}</option>)}{editing?.channel&&!events[editing.channel]&&<option value={editing.channel}>{editing.channel}</option>}</Select></label><label>Статус<Select name="status" defaultValue={editing?.status||'Пауза'}><option>Пауза</option><option>Активно</option></Select></label></div><label>Ответственный<Select name="owner" defaultValue={editing?.owner||'Ответственный за сделку'}>{[...new Set(['Ответственный за сделку','Владелец',...employees.filter(employee=>employee.status==='Активен').map(employee=>employee.name),...(editing?.owner?[editing.owner]:[])])].map(owner=><option key={owner}>{owner}</option>)}</Select></label><label>Описание<textarea name="note" defaultValue={editing?.note} placeholder="Когда и зачем использовать этот сценарий"/></label><div className="modal-footer"><button type="button" onClick={()=>setFormOpen(false)}>Отмена</button><button className="primary" disabled={!library.length}>Сохранить</button></div></form></Modal>}
  {testId&&<Modal title={'Проверить: '+(records.find(record=>record.id===testId)?.name||'сценарий')} close={()=>setTestId('')}><p>Сценарий читает текущие данные CRM, задач и склада. Этап и назначение агента можно применить отдельно после проверки.</p><label>Клиент<Select value={selectedClient?.id||''} onChange={event=>setClientId(event.target.value)}>{deals.map(client=><option key={client.id} value={client.id}>{client.name} · {client.status}</option>)}</Select></label><div className="modal-footer"><button onClick={()=>setTestId('')}>Отмена</button><button data-permission="ai" disabled={!canRun||!selectedClient} className="primary" onClick={()=>{const record=records.find(item=>item.id===testId);if(record&&selectedClient)execute(record,selectedClient)}}><Play size={15}/>Запустить локальный тест</button></div></Modal>}
  {currentRun&&<Drawer title={currentRun.automationName} close={()=>setOpened('')}><div className="automation-run-heading"><Badge tone={currentRun.error?'red':currentRun.result?.waitingFor?'orange':'green'}>{status(currentRun)}</Badge><p>{currentRun.clientName} · {new Date(currentRun.date).toLocaleString('ru-RU')}</p></div>{currentRun.error&&<p className="form-error" role="alert">{currentRun.error}</p>}{currentRun.result?.journal.map((entry,index)=><details key={entry.id} className="automation-journal-step" open={entry.status==='waiting'}><summary>{entry.status==='waiting'?<Clock size={16}/>:<CheckCircle2 size={16}/>}<span>{index+1}. {entry.node}</span><small>{entry.status==='waiting'?'Ожидание':entry.status==='skipped'?'Пропущен':'Готово'}</small></summary><pre>{entry.result}</pre></details>)}{currentRun.result?.drafts.map((draft,index)=><section className="automation-draft" key={index}><div className="row-between"><b>Черновик сообщения {index+1}</b><button aria-label={'Копировать черновик '+(index+1)} onClick={()=>navigator.clipboard.writeText(draft).then(()=>notify('Черновик скопирован')).catch(()=>notify('Не удалось скопировать текст'))}><Copy size={14}/></button></div><p>{draft}</p></section>)}{currentRun.result&&!currentRun.appliedAt&&!fresh&&<div className="info-panel"><AlertCircle size={17}/>Сценарий или данные изменились. Для продолжения нужен новый тест.</div>}{currentRun.result?.waitingFor&&<button data-permission="ai" className="primary" disabled={!canRun||!fresh} onClick={()=>{if(currentRecord&&currentClient)execute(currentRecord,currentClient,currentRun)}}>{currentRun.result.waitingType==='delay'?'Пропустить ожидание и продолжить':'Подтвердить и продолжить'}</button>}{currentRun.result&&!currentRun.result.waitingFor&&!currentRun.appliedAt&&pending&&<section className="automation-apply"><h3>Изменения клиента</h3>{changes.status&&<p>Этап: {currentClient?.status} <ArrowRight size={14}/> {currentRun.result.updated.status}</p>}{changes.owner&&<p>Ответственный: {currentClient?.owner} <ArrowRight size={14}/> {currentRun.result.updated.owner}</p>}<button data-permission="edit" className="primary" disabled={!canEdit||!canApplyClientChanges||!fresh} onClick={applyRun}>Применить к клиенту</button></section>}{currentRun.appliedAt&&<div className="info-panel"><CheckCircle2 size={17}/>Изменения применены {new Date(currentRun.appliedAt).toLocaleString('ru-RU')}</div>}{currentRun.result&&!currentRun.result.waitingFor&&!pending&&!currentRun.appliedAt&&<p className="muted">Изменений клиента нет. Результаты и черновики доступны выше.</p>}<div className="modal-footer"><button data-permission="ai" disabled={!canRun||!currentRecord||!currentClient} onClick={()=>{if(currentRecord&&currentClient)execute(currentRecord,currentClient)}}>Новый тест</button><button data-permission="export" disabled={!canExport} onClick={()=>downloadText('automation-run.json',JSON.stringify(currentRun,null,2),'application/json')}><Download size={14}/>JSON</button></div></Drawer>}
  {deleteId&&<Modal title="Удалить автоматизацию?" close={()=>setDeleteId('')}><p>«{records.find(record=>record.id===deleteId)?.name}» будет удалена из списка. Сохранённая схема и история тестов останутся.</p><div className="modal-footer"><button onClick={()=>setDeleteId('')}>Отмена</button><button data-permission="remove" disabled={!canRemove} className="danger" onClick={()=>{if(!canRemove)return;replace(records.filter(record=>record.id!==deleteId));audit('Удалена автоматизация: '+records.find(record=>record.id===deleteId)?.name);setDeleteId('');notify('Автоматизация удалена')}}>Удалить</button></div></Modal>}
 </div>;
}
