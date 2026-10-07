import type {Entity} from './data.ts';
import type {ChatMessage} from './conversations.ts';
export type StageAgentPolicy={agentId:string;fallbackAgentId:string;urgentAgentId:string;unansweredAgentId:string;unansweredMinutes:number};
export type AgentAssignment={stageId:string;manual:boolean;reason:string;assignedAt:string};
export type AgentHandoff={from:string;to:string;reason:string;at:string};
export type AgentDeal=Entity&{agentId?:string;agentAssignment?:AgentAssignment;agentHistory?:AgentHandoff[]};
export type AgentStage={id:string;name:string};
export const emptyAgentPolicy:StageAgentPolicy={agentId:'',fallbackAgentId:'',urgentAgentId:'',unansweredAgentId:'',unansweredMinutes:15};
export function assignDealAgent(deal:AgentDeal,agent:Entity|null,stageId:string,reason:string,manual:boolean,now:string):AgentDeal{
 const to=agent?.name||'Сотрудник',from=deal.owner;
 return {...deal,agentId:agent?.id||'',owner:agent?.name||(deal.agentId?'Не назначен':deal.owner),agentAssignment:{stageId,manual,reason,assignedAt:now},agentHistory:[{from,to,reason,at:now},...(deal.agentHistory||[])].slice(0,100)};
}
export function reconcileAgentAssignments(deals:AgentDeal[],agents:Entity[],stages:{sales:AgentStage[];repeat:AgentStage[]},policies:Record<string,StageAgentPolicy>,messages:Record<string,ChatMessage[]>,now:string):AgentDeal[]{
 let changed=false;
 const active=(id:string)=>agents.find(agent=>agent.id===id&&agent.status==='Активен');
 const next=deals.map(deal=>{
  if(deal.closedAt||['Успешно','Неуспешно'].includes(deal.pipeline||'')||['Успешно','Неуспешно'].includes(deal.status))return deal;
  const stage=(deal.pipeline==='Повторные продажи'?stages.repeat:stages.sales).find(stage=>stage.name===deal.status),policy=stage&&policies[stage.id];
  if(!stage||!policy?.agentId)return deal;
  const assignment=deal.agentAssignment,sameStage=assignment?.stageId===stage.id;
  const last=(messages[deal.id]||[]).at(-1);
  const incomingAt=typeof last==='object'&&last.direction==='incoming'&&last.sentAt?Date.parse(last.sentAt):NaN;
  const overdue=Number.isFinite(incomingAt)&&Date.parse(now)-incomingAt>=Math.max(1,policy.unansweredMinutes)*60000;
  let target:Entity|undefined,reason='';
  if(deal.urgent&&active(policy.urgentAgentId)){target=active(policy.urgentAgentId);reason='Срочный клиент'}
  else if(overdue&&active(policy.unansweredAgentId)){target=active(policy.unansweredAgentId);reason='Нет ответа более '+policy.unansweredMinutes+' мин.'}
  else if(sameStage&&assignment?.manual){
   if(!deal.agentId||active(deal.agentId))return deal;
   target=active(policy.fallbackAgentId);reason='Назначенный агент недоступен';
  }else{target=active(policy.agentId);reason='Агент этапа «'+stage.name+'»';if(!target){target=active(policy.fallbackAgentId);reason='Основной агент недоступен'}}
  if(!target)return deal;
  if(deal.agentId===target.id&&sameStage&&deal.owner===target.name)return deal;
  changed=true;return assignDealAgent(deal,target,stage.id,reason,false,now);
 });
 return changed?next:deals;
}
