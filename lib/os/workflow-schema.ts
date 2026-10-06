import type {WorkflowNode,WorkflowEdge} from './workflow';
export const workflowKinds=['Trigger','AI Agent','Sub Agent','Condition','Router','Database','HTTP/API','CRM','Inventory','Message','Human Approval','Delay','Code','Transform','Output'];
export function workflowBranch(edge:WorkflowEdge){return edge.sourceHandle==='yes'?'Да':edge.sourceHandle==='no'?'Нет':String(edge.label||'').startsWith('Да')?'Да':String(edge.label||'').startsWith('Нет')?'Нет':''}
export function workflowStructureErrors(nodes:WorkflowNode[],edges:WorkflowEdge[]){
 const errors:string[]=[];const ids=new Set(nodes.map(n=>n.id));
 if(nodes.some(n=>!n.id.trim())||ids.size!==nodes.length)errors.push('ID блоков должны быть непустыми и уникальными');
 if(nodes.some(n=>!workflowKinds.includes(String(n.data.kind))))errors.push('Есть неизвестные типы блоков');
 if(edges.some(e=>!e.id.trim())||new Set(edges.map(e=>e.id)).size!==edges.length)errors.push('ID связей должны быть непустыми и уникальными');
 if(edges.some(e=>!ids.has(e.source)||!ids.has(e.target)))errors.push('Есть связи с отсутствующими блоками');
 return errors;
}
type ImportedEdge=Omit<WorkflowEdge,'label'>&{label?:string};
type ImportedNode=WorkflowNode&{type:'agent';position:{x:number;y:number}};
function record(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==='object'&&!Array.isArray(value))}
export function parseWorkflowImport(value:unknown):{nodes:ImportedNode[];edges:ImportedEdge[]}{
 if(!record(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges))throw new Error('Файл должен содержать списки nodes и edges');
 if(value.version!==undefined&&value.version!==1)throw new Error('Версия формата не поддерживается. Нужна версия 1');
 const nodes=value.nodes.map((node,index)=>{
  if(!record(node)||typeof node.id!=='string'||!record(node.data)||!record(node.position)||typeof node.position.x!=='number'||typeof node.position.y!=='number'||!Number.isFinite(node.position.x)||!Number.isFinite(node.position.y))throw new Error('Блок '+(index+1)+': нужны ID, data и координаты position');
  if(typeof node.data.kind!=='string'||!workflowKinds.includes(node.data.kind))throw new Error('Блок '+(index+1)+': неизвестный тип '+String(node.data.kind));
  if(node.data.disabled!==undefined&&typeof node.data.disabled!=='boolean')throw new Error('Блок '+(index+1)+': disabled должен быть переключателем');
  if(node.data.label!==undefined&&typeof node.data.label!=='string')throw new Error('Блок '+(index+1)+': название должно быть текстом');
  return {...node,type:'agent' as const,id:node.id,data:{...node.data,kind:node.data.kind,label:node.data.label||node.data.kind},position:{x:node.position.x,y:node.position.y}};
 });
 const edges=value.edges.map((edge,index)=>{
  if(!record(edge)||typeof edge.id!=='string'||typeof edge.source!=='string'||typeof edge.target!=='string')throw new Error('Связь '+(index+1)+': нужны ID, source и target');
  if(edge.label!==undefined&&typeof edge.label!=='string')throw new Error('Связь '+(index+1)+': подпись должна быть текстом');
  if(edge.sourceHandle!==undefined&&edge.sourceHandle!==null&&!['yes','no'].includes(String(edge.sourceHandle)))throw new Error('Связь '+(index+1)+': неизвестный выход блока');
  if(edge.targetHandle!==undefined&&edge.targetHandle!==null)throw new Error('Связь '+(index+1)+': неизвестный вход блока');
  const result={...edge,id:edge.id,source:edge.source,target:edge.target} as ImportedEdge;
  const source=nodes.find(n=>n.id===edge.source);
  if(source&&['Condition','Router'].includes(String(source.data.kind))){const branch=workflowBranch(result);if(!branch)throw new Error('Связь '+(index+1)+': выберите выход «Да» или «Нет»');result.sourceHandle=branch==='Да'?'yes':'no'}else if(source&&result.sourceHandle)throw new Error('Связь '+(index+1)+': этот блок не имеет выхода '+result.sourceHandle);
  return result;
 });
 const problems=workflowStructureErrors(nodes,edges);if(problems.length)throw new Error(problems.join('. '));
 return {nodes,edges};
}
