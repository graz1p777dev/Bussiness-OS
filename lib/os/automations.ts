import type {Entity} from './data.ts';
import type {AgentContext} from './agent-tools.ts';
import {buildAutomationBlueprint,type BlueprintWorkflow} from './business-blueprint.ts';
import type {WorkflowNode,WorkflowEdge} from './workflow.ts';

export type AutomationRecord=Entity&{workflowId?:string};
export type AutomationGraph={id:string;name:string;date:string;nodes:(WorkflowNode&{type?:string;position:{x:number;y:number}})[];edges:WorkflowEdge[]};
const legacyNames=['Новый лид → Sales Agent','Follow-up через 24 часа','Проверка оплаты → CRM','Склад: низкий остаток'];

/** Link only known starter rows. Never replace a saved graph or restore a removed row. */
export function linkStarterAutomations(records:AutomationRecord[],library:AutomationGraph[],workspace:string,stages:string[],now?:string){
 const prepared=buildAutomationBlueprint(workspace,stages,now);
 const added:BlueprintWorkflow[]=[];
 const linked=records.map(record=>{
  if(record.workflowId)return record;
  const index=legacyNames.indexOf(record.name);
  const legacyIndex=['BM-50','BM-51','BM-52','BM-53'].indexOf(record.id);
  const template=prepared.snapshots[index>=0?index:legacyIndex];
  if(!template)return record;
  if(!library.some(flow=>flow.id===template.id)&&!added.some(flow=>flow.id===template.id))added.push(template);
  return {...record,workflowId:template.id};
 });
 return {records:linked,library:[...library,...added]};
}

export function automationFingerprint(flow:AutomationGraph,client:Entity,context:AgentContext,stages:string[]){
 return JSON.stringify({graph:{id:flow.id,nodes:flow.nodes.map(node=>({id:node.id,data:node.data})),edges:flow.edges.map(edge=>({id:edge.id,source:edge.source,target:edge.target,label:edge.label,sourceHandle:edge.sourceHandle}))},client,context,stages});
}
