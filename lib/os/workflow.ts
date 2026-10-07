import type {Entity} from './data';
import type {AgentContext} from './agent-tools.ts';
import {executeAgentTool} from './agent-tools.ts';
import {renderReply} from './reply-templates.ts';
import {assignDealAgent,type AgentDeal} from './agent-handoffs.ts';
export type WorkflowNode={id:string;data:Record<string,unknown>};
export type WorkflowEdge={id:string;source:string;target:string;label?:unknown;sourceHandle?:string|null};
export type WorkflowJournal={id:string;node:string;result:string;status:'done'|'skipped'|'waiting'};
export type WorkflowOptions={approvedNodes?:string[];now?:string};
export function workflowClientChanges(client:AgentDeal,updated:AgentDeal):Partial<AgentDeal>{
 const changes:Partial<AgentDeal>={};
 if(updated.status!==client.status)changes.status=updated.status;
 if(updated.pipeline!==client.pipeline)changes.pipeline=updated.pipeline;
 if(updated.agentId!==client.agentId||updated.owner!==client.owner)Object.assign(changes,{owner:updated.owner,agentId:updated.agentId,agentAssignment:updated.agentAssignment,agentHistory:updated.agentHistory});
 return changes;
}
import {workflowBranch,workflowStructureErrors} from './workflow-schema.ts';
function interpolate(text:string,client:Entity){const rendered=renderReply(text.replaceAll('{{name}}','{{клиент}}'),client);if(rendered.missing.length)throw new Error('Не заполнены переменные: '+rendered.missing.join(', '));return rendered.text}
function transformValue(value:unknown,client:Entity):unknown{if(typeof value==='string')return interpolate(value,client);if(Array.isArray(value))return value.map(v=>transformValue(v,client));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,transformValue(v,client)]));return value}
function readJSON(text:unknown,label:string){try{return JSON.parse(String(text||'{}'))}catch{throw new Error(label+': некорректный JSON')}}
function checkGraph(nodes:WorkflowNode[],edges:WorkflowEdge[]){const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length)throw new Error('ID узлов должны быть уникальны');if(edges.some(e=>!ids.has(e.source)||!ids.has(e.target)))throw new Error('Связь с отсутствующим узлом');const visited=new Set<string>(),stack=new Set<string>();function visit(id:string){if(stack.has(id))throw new Error('Циклы в тесте не поддерживаются');if(visited.has(id))return;stack.add(id);edges.filter(e=>e.source===id).forEach(e=>visit(e.target));stack.delete(id);visited.add(id)}nodes.forEach(n=>visit(n.id))}
export function runWorkflow(nodes:WorkflowNode[],edges:WorkflowEdge[],client:Entity,context:AgentContext,options:WorkflowOptions={}){
 const problems=workflowStructureErrors(nodes,edges);if(problems.length)throw new Error(problems.join('. '));checkGraph(nodes,edges);
 const triggers=nodes.filter(n=>n.data.kind==='Trigger');if(triggers.length!==1)throw new Error('Нужен ровно один триггер');
 const depths=new Map<string,number>();function depth(id:string):number{if(depths.has(id))return depths.get(id)!;const parents=edges.filter(e=>e.target===id);const value=parents.length?Math.max(...parents.map(e=>depth(e.source)))+1:0;depths.set(id,value);return value}nodes.forEach(n=>depth(n.id));
 const journal:WorkflowJournal[]=[];let updated:AgentDeal={...client};const drafts:string[]=[];const visited=new Set<string>();const queue=[triggers[0].id];let output:unknown=null;
 const result=(waitingFor:string|null=null,waitingType:'approval'|'delay'|null=null)=>({updated,drafts,journal,output,waitingFor,waitingType});
 while(queue.length){
  queue.sort((a,b)=>depth(a)-depth(b));const id=queue.shift()!;if(visited.has(id))continue;visited.add(id);const node=nodes.find(n=>n.id===id)!;const d=node.data;let branch:boolean|undefined;let text='';
  const log=(text:string,status:WorkflowJournal['status']='done')=>journal.push({id,node:String(d.label||d.kind),result:text,status});
  if(d.disabled)log('Пропущен: отключён','skipped');
  else{
   switch(d.kind){
    case 'Trigger':if(d.source&&d.source!=='Все'&&d.source!==client.channel){log('Источник клиента не совпадает; цепочка остановлена','skipped');return result()}text='Событие для '+client.name;break;
    case 'CRM':{
     if(d.action==='assign-agent'){
      const agent=context.agents?.find(item=>item.id===d.agentId&&item.status==='Активен');
      if(!agent)throw new Error('Назначение: выберите доступного активного агента');
      const stage=context.stages?.find(item=>item.name===updated.status);
      if(!stage)throw new Error('Назначение: текущий этап клиента недоступен');
      if(updated.agentId!==agent.id||updated.owner!==agent.name)updated=assignDealAgent(updated,agent,stage.id,'Назначение из сценария «'+String(d.label||'CRM')+'»',true,options.now||new Date().toISOString());
      text='Ответственный → '+agent.name+'. Назначение ожидает отдельного применения к клиенту.';
     }else{if(d.action==='create')throw new Error('Для существующего клиента выберите «Перенести этап»');if(!d.stage)throw new Error('В блоке CRM выберите этап');updated={...updated,status:String(d.stage),pipeline:['Успешно','Неуспешно'].includes(updated.pipeline||'')?'Продажи':updated.pipeline};text='Этап → '+updated.status}
     break;
    }
    case 'Condition':case 'Router':{
     const field=d.field==='amount'?updated.value:d.field==='source'?updated.channel:d.field==='owner'?updated.owner:d.field==='city'?updated.city||'':updated.status;
     if(d.value===undefined||String(d.value).trim()==='')throw new Error('В условии выберите значение');
     switch(d.operator){case 'greater':case 'at-least':case 'less':{const number=Number(d.value);if(!Number.isFinite(number)||typeof field!=='number')throw new Error('Числовое условие применимо только к сумме');branch=d.operator==='greater'?field>number:d.operator==='less'?field<number:field>=number;break}case 'not-equals':branch=String(field)!==String(d.value);break;case 'contains':branch=String(field).toLowerCase().includes(String(d.value).toLowerCase());break;default:branch=String(field)===String(d.value)}text='Условие: '+(branch?'Да':'Нет');break;
    }
    case 'Message':if(!String(d.template||'').trim())throw new Error('В блоке сообщения заполните шаблон');drafts.push(interpolate(String(d.template),updated));text='Черновик подготовлен для '+String(d.channel||updated.channel)+', без отправки';break;
    case 'Database':case 'Inventory':case 'AI Agent':case 'Sub Agent':{const tool=String(d.tool||(d.kind==='Inventory'?'get_inventory':'get_clients'));output=executeAgentTool(tool,{query:d.query===undefined?(d.kind==='Database'?client.name:''):interpolate(String(d.query),updated)},context);text=(['AI Agent','Sub Agent'].includes(String(d.kind))?'Локальный инструмент; модель не вызывалась.\n':'')+JSON.stringify(output,null,2);break}
    case 'Transform':output=transformValue(readJSON(d.code,'Преобразование'),updated);text=JSON.stringify(output,null,2);break;
    case 'HTTP/API':case 'Code':if(!d.mockEnabled)throw new Error('Узел '+d.kind+' требует backend. Для локального теста включите тестовый результат.');if(d.kind==='HTTP/API'){let url:URL;try{url=new URL(String(d.url))}catch{throw new Error('Укажите полный URL запроса')}if(!['http:','https:'].includes(url.protocol))throw new Error('Выберите HTTP или HTTPS');if(d.body)readJSON(d.body,'Тело запроса')}output=readJSON(d.mockResponse,'Тестовый результат');text='Тестовый результат; '+(d.kind==='Code'?'код не исполнялся':'сетевой запрос не выполнялся')+'.\n'+JSON.stringify(output,null,2);break;
    case 'Output':output=output??{client:updated,drafts};text=d.format==='JSON'?JSON.stringify(output,null,2):'Результат готов: '+updated.name+' · '+updated.status;break;
    case 'Human Approval':if(!options.approvedNodes?.includes(id)){log('Ожидает подтверждения; дальнейшие узлы не запущены','waiting');return result(id,'approval')}text='Подтверждено оператором в локальном тесте';break;
    case 'Delay':if(!options.approvedNodes?.includes(id)){log('Ожидание '+String(d.minutes||5)+' минут. В тесте можно пропустить ожидание.','waiting');return result(id,'delay')}text='Ожидание пропущено оператором в локальном тесте';break;
    default:throw new Error('Неизвестный тип узла: '+d.kind);
   }
   log(text);
  }
  const next=edges.filter(e=>e.source===id);
  if(branch!==undefined){const chosen=next.filter(e=>workflowBranch(e)===(branch?'Да':'Нет'));if(chosen.length!==1)throw new Error('Для условия нужна ровно одна ветка «Да» и одна «Нет»');queue.push(chosen[0].target)}else queue.push(...next.map(e=>e.target));
 }
 return result();
}
