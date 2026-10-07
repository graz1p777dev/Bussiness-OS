'use client';
import {useEffect,useRef,useState} from 'react';
import {Play,Square,Download,LockKeyhole} from 'lucide-react';
import {useStored} from '../lib/os/storage';
import {agentToolDefinitions,executeAgentTool,type AgentContext} from '../lib/os/agent-tools';
import {canReadAgentRun,permittedAgentTools,scopeAgentContext,type AgentDataAccess} from '../lib/os/agent-access';
import {downloadText} from '../lib/os/export';
import AIMark from '../components/os/AIMark';
import Select from '../components/os/Select';
type Run={id:string;actorId?:string;tools?:string[];task:string;time:string;status:string;text:string;journal:{tool:string;input:unknown;output:unknown}[];citations?:{url:string;title:string}[]};
const labels:Record<string,string>={get_clients:'Клиенты и сделки',get_analytics:'Аналитика продаж',get_inventory:'Остатки товаров',get_tasks:'Задачи команды',web_search:'Поиск в интернете'};
export default function AgentWorkspace({context,access,actorId,audit}:{context:AgentContext;access:AgentDataAccess;actorId:string;audit:(s:string)=>void}){
 const [task,setTask]=useState('Проанализируй продажи, клиентов и остатки. Найди проблемы и предложи следующие действия.');const [mode,setMode]=useState('local');const [allowed,setAllowed]=useState(agentToolDefinitions.map(t=>t.name));const [status,setStatus]=useState({configured:false,webSearch:false});const [runs,setRuns]=useStored<Run[]>('agent-runs-v3',[]);const [current,setCurrent]=useState<Run|null>(null);const [busy,setBusy]=useState(false);const abort=useRef<AbortController|null>(null);
 const permitted=permittedAgentTools(access),accessKey=permitted.join('|');
 const selected=allowed.filter(name=>permitted.includes(name)&&(name!=='web_search'||mode==='model'&&status.webSearch));
 const visible=current&&canReadAgentRun(current,actorId,access)?current:null;
 const history=runs.filter(run=>canReadAgentRun(run,actorId,access));
 useEffect(()=>()=>abort.current?.abort(),[accessKey,actorId]);
 useEffect(()=>{const c=new AbortController();fetch('/api/os-agents',{signal:c.signal}).then(r=>r.json()).then(body=>setStatus(body as {configured:boolean;webSearch:boolean})).catch(()=>{});return()=>{c.abort();abort.current?.abort()}},[]);
 async function run(){
  if(!access.run||busy||!task.trim()||!selected.length||mode==='model'&&!status.configured)return;
  const tools=[...selected],scoped=scopeAgentContext(context,tools,access),controller=new AbortController();abort.current=controller;setBusy(true);
  let result:Run={id:crypto.randomUUID(),actorId,tools,task,time:new Date().toLocaleString('ru-RU'),status:'Работает',text:'',journal:[]};setCurrent(result);
  try{
   if(mode==='model'){
    const response=await fetch('/api/os-agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,allowed:tools,context:scoped}),signal:controller.signal});
    const body=await response.json() as {journal?:Run['journal'];citations?:Run['citations'];error?:string;text:string};result={...result,journal:body.journal||[],citations:body.citations||[]};
    if(!response.ok)throw new Error(body.error||'Ошибка модели');result={...result,text:body.text,status:'Завершён'};
   }else{
    for(const name of tools.filter(n=>n!=='web_search')){
     if(controller.signal.aborted)throw new DOMException('Отменено','AbortError');
     const output=executeAgentTool(name,{query:''},scoped);result={...result,journal:[...result.journal,{tool:name,input:{},output}]};setCurrent(result);
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    if(controller.signal.aborted)throw new DOMException('Отменено','AbortError');
    const insights:string[]=[];
    if(tools.includes('get_analytics')){const a=executeAgentTool('get_analytics',{},scoped) as {leads:number;revenue:number;potential:number};insights.push(`Клиентов: ${a.leads}. Реальная выручка локальной кассы: ${a.revenue} сом. Потенциал открытых сделок: ${a.potential} сом.`)}
    if(tools.includes('get_inventory')){const stock=executeAgentTool('get_inventory',{},scoped) as {name:string;low:boolean}[];const low=stock.filter(p=>p.low);insights.push(low.length?'Ниже минимального остатка: '+low.map(p=>p.name).join(', ')+'. Проверьте закупку перед предложением клиентам.':'Товаров ниже минимального остатка нет.')}
    if(tools.includes('get_clients')){const early=scoped.clients.filter(c=>['Неразобранное','Первичный контакт'].includes(c.status));insights.push(`Клиентов на начальных этапах: ${early.length}. Проверьте, кому ещё нужен первый ответ.`)}
    if(tools.includes('get_tasks'))insights.push(`Незавершённых задач: ${scoped.tasks.filter(t=>t.status!=='Done').length}.`);
    result={...result,status:'Завершён',text:'Локальный разбор по правилам, без языковой модели и интернет-поиска.\n\n'+insights.join('\n\n')};
   }
   audit('Запуск инструментов OS: '+task);
  }catch(e){result={...result,status:controller.signal.aborted?'Отменён':'Ошибка',text:e instanceof Error?e.message:'Ошибка запуска'}}
  finally{setCurrent(result);setRuns(v=>[result,...v].slice(0,30));setBusy(false);abort.current=null}
 }
 return <section className="panel agent-workspace"><div className="row-between"><h2><AIMark size={24}/>Рабочее место субагента</h2><span>{status.configured?'Модель подключена':'Локальные инструменты доступны'}</span></div><p>Задача → разрешённые инструменты → проверяемый результат. Агент читает только выбранные данные, доступные вашей роли.</p><label>Задача<textarea value={task} maxLength={6000} disabled={!access.run||busy} onChange={e=>setTask(e.target.value)}/></label><label>Исполнение<Select value={mode} disabled={!access.run||busy} onChange={e=>setMode(e.target.value)}><option value="local">Локальный анализ по правилам</option><option value="model" disabled={!status.configured}>ИИ-модель {status.configured?'':'· не подключена'}</option></Select></label><div className="permission-grid">{Object.entries(labels).map(([name,label])=><label key={name} title={!permitted.includes(name)?'Нет доступа к этому источнику данных':''}><input disabled={busy||!permitted.includes(name)||name==='web_search'&&(!status.webSearch||mode!=='model')} type="checkbox" checked={selected.includes(name)} onChange={e=>{if(!permitted.includes(name))return;setAllowed(v=>e.target.checked?[...v,name]:v.filter(n=>n!==name))}}/>{label}{!permitted.includes(name)&&<LockKeyhole size={12}/>}</label>)}</div><div className="row"><button data-permission="ai" className="primary" disabled={!access.run||busy||!task.trim()||!selected.length} onClick={run}><Play size={15}/>Запустить субагента</button>{busy&&<button onClick={()=>abort.current?.abort()}><Square size={14}/>Остановить</button>}{visible&&<button data-permission="export" disabled={!access.export} onClick={()=>{if(access.export&&canReadAgentRun(visible,actorId,access))downloadText('agent-run.json',JSON.stringify(visible,null,2),'application/json')}}><Download size={14}/>Результат</button>}</div>{visible&&<div className="agent-journal"><div className="row-between"><b>{visible.status}</b><small>{visible.time}</small></div>{visible.journal.map((step,i)=><details key={i}><summary>{i+1}. {labels[step.tool]||step.tool}</summary><pre>{JSON.stringify(step.output,null,2)}</pre></details>)}<p>{visible.text}</p>{visible.citations?.filter(c=>/^https?:\/\//.test(c.url)).map((c,i)=><a key={i} href={c.url} target="_blank" rel="noreferrer">{c.title}</a>)}</div>}<h3>История ваших запусков</h3>{history.slice(0,5).map(r=><button key={r.id} onClick={()=>{if(canReadAgentRun(r,actorId,access))setCurrent(r)}}>{r.status} · {r.task.slice(0,65)} · {r.time}</button>)}{!history.length&&<p className="muted">Здесь появятся ваши запуски с доступными инструментами.</p>}{!status.configured&&<p className="muted">Для произвольных ИИ-задач и интернет-поиска подключите модель на backend. Локальный запуск выполняет выбранные инструменты и фиксированные проверки.</p>}</section>
}
