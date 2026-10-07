'use client';
import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {Bot,Settings2,ArrowRight} from 'lucide-react';
import {useStored} from '../../lib/os/storage';
import {initialAgents,type Entity} from '../../lib/os/data';
import {initialStageConfig} from '../../lib/os/stage-config';
import {reconcileAgentAssignments,assignDealAgent,emptyAgentPolicy,type StageAgentPolicy,type AgentDeal} from '../../lib/os/agent-handoffs';
import type {ChatMessage} from '../../lib/os/conversations';
import {Modal,Badge} from './ui';
import Select from './Select';
import './AgentResponsibility.css';

export function useAgentHandoffs(deals:Entity[],setDeals:Dispatch<SetStateAction<Entity[]>>,agents:Entity[],messages:Record<string,ChatMessage[]>,enabled=true){
 const [stages]=useStored('stage-config-v3',initialStageConfig);
 const [policies]=useStored<Record<string,StageAgentPolicy>>('stage-agent-policies-v1',{});
 const [minute,setMinute]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setMinute(value=>value+1),60000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{if(!enabled)return;const next=reconcileAgentAssignments(deals,agents,stages,policies,messages,new Date().toISOString());if(next!==deals)setDeals(next)},[deals,agents,stages,policies,messages,minute,setDeals,enabled]);
}
export function StageAgentSettings({canEdit=true}:{canEdit?:boolean}){
 const [open,setOpen]=useState(false),[pipeline,setPipeline]=useState<'sales'|'repeat'>('sales');
 const [stages]=useStored('stage-config-v3',initialStageConfig),[agents]=useStored('agents',initialAgents);
 const [policies,setPolicies]=useStored<Record<string,StageAgentPolicy>>('stage-agent-policies-v1',{});
 const [draft,setDraft]=useState<Record<string,StageAgentPolicy>>({});
 function set(stageId:string,key:keyof StageAgentPolicy,value:string|number){setDraft(current=>({...current,[stageId]:{...emptyAgentPolicy,...current[stageId],[key]:value}}))}
 function picker(id:string,label:string,key:'agentId'|'fallbackAgentId'|'urgentAgentId'|'unansweredAgentId'){
  const value=draft[id]?.[key]||'';
  return <label>{label}<Select value={value} onChange={event=>set(id,key,event.target.value)}><option value="">{key==='agentId'?'Без автоматического назначения':'Не подменять'}</option>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}{agent.status==='Активен'?'':' · '+agent.status}</option>)}{value&&!agents.some(agent=>agent.id===value)&&<option value={value} disabled>Агент удалён — выберите другого</option>}</Select></label>;
 }
 return <><button data-permission="edit" disabled={!canEdit} onClick={()=>{if(!canEdit)return;setDraft(structuredClone(policies));setOpen(true)}}><Bot size={15}/>Агенты этапов</button>{open&&<Modal title="Агенты этапов и подмена" close={()=>setOpen(false)} wide><div className="agent-stage-settings"><p>На каждом этапе свой агент. Резервный подхватит клиента, если основной на паузе или удалён. Отдельные правила работают для срочных клиентов и сообщений без ответа.</p><div className="tabs"><button className={pipeline==='sales'?'selected':''} onClick={()=>setPipeline('sales')}>Продажи</button><button className={pipeline==='repeat'?'selected':''} onClick={()=>setPipeline('repeat')}>Повторные продажи</button></div><div className="agent-stage-list">{stages[pipeline].map(stage=><section key={stage.id}><header><i style={{background:stage.color}}/><h3>{stage.name}</h3></header><div className="form-grid">{picker(stage.id,'Основной агент','agentId')}{picker(stage.id,'Резервный агент','fallbackAgentId')}</div><details><summary><Settings2 size={14}/>Подмена по ситуации</summary><div className="form-grid">{picker(stage.id,'Для срочного клиента','urgentAgentId')}{picker(stage.id,'Если долго нет ответа','unansweredAgentId')}</div><label>Ожидание ответа, минут<input type="number" min={1} max={1440} value={draft[stage.id]?.unansweredMinutes??15} onChange={event=>set(stage.id,'unansweredMinutes',Number(event.target.value))}/></label></details></section>)}</div><p className="agent-stage-note">Изменения применяются после сохранения. Подмена меняет ответственность и сохраняет историю; сообщения клиенту автоматически не отправляются. Ручной выбор действует до следующего этапа, кроме настроенных ситуаций подмены.</p><div className="modal-footer"><button onClick={()=>setOpen(false)}>Отмена</button><button data-permission="edit" className="primary" onClick={()=>{if(!canEdit)return;setPolicies(Object.fromEntries(Object.entries(draft).map(([id,policy])=>[id,{...policy,unansweredMinutes:Math.min(1440,Math.max(1,Math.round(policy.unansweredMinutes)||15))}])));setOpen(false)}}>Сохранить назначения</button></div></div></Modal>}</>;
}
export function CustomerAgentResponsibility({deal,setDeals,canEdit=true}:{deal:Entity;setDeals:Dispatch<SetStateAction<Entity[]>>;canEdit?:boolean}){
 const [agents]=useStored('agents',initialAgents),[stages]=useStored('stage-config-v3',initialStageConfig);
 const [deals]=useStored<Entity[]>('deals',[]);
 const current=(deals.find(item=>item.id===deal.id)||deal) as AgentDeal;
 const stage=(current.pipeline==='Повторные продажи'?stages.repeat:stages.sales).find(stage=>stage.name===current.status);
 return <section className="customer-agent-responsibility"><header><Bot size={18}/><h3>Ответственный агент</h3>{current.agentAssignment?.manual&&<Badge>Вручную</Badge>}</header><label data-permission="edit">Агент клиента<Select disabled={!canEdit} value={current.agentId??agents.find(agent=>agent.name===current.owner)?.id??''} onChange={event=>{if(!canEdit)return;const agent=agents.find(agent=>agent.id===event.target.value)||null;setDeals(rows=>rows.map(row=>row.id===current.id?assignDealAgent(row,agent,stage?.id||'','Ручное назначение в карточке',true,new Date().toISOString()):row))}}><option value="">Сотрудник / без агента</option>{agents.map(agent=><option key={agent.id} value={agent.id} disabled={agent.status!=='Активен'}>{agent.name}{agent.status==='Активен'?'':' · '+agent.status}</option>)}{current.agentId&&!agents.some(agent=>agent.id===current.agentId)&&<option value={current.agentId}>Удалённый агент</option>}</Select></label><small>{current.agentAssignment?.reason||'Автоматические назначения можно настроить в «Агенты этапов».'}</small>{current.agentHistory?.length? <details><summary>История передач · {current.agentHistory.length}</summary>{current.agentHistory.slice(0,10).map((entry,index)=><article key={entry.at+index}><div><span>{entry.from}</span><ArrowRight size={12}/><b>{entry.to}</b></div><small>{entry.reason} · {new Date(entry.at).toLocaleString('ru-RU')}</small></article>)}</details>:null}</section>;
}
