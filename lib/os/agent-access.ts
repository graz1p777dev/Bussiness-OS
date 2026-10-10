import {agentToolDefinitions,summarizeAgentAnalytics,type AgentContext} from './agent-tools.ts';

export type AgentDataAccess={run:boolean;export:boolean;clients:boolean;analytics:boolean;inventory:boolean;tasks:boolean;finance?:boolean};
export type AgentRunScope={actorId?:string;tools?:string[];finance?:boolean;journal:{tool:string}[]};
const requirements:Record<string,keyof AgentDataAccess>={get_clients:'clients',get_analytics:'analytics',get_inventory:'inventory',get_tasks:'tasks',web_search:'run'};

export function permittedAgentTools(access:AgentDataAccess){
 return access.run?[...agentToolDefinitions.map(tool=>tool.name),'web_search'].filter(name=>access[requirements[name]]):[];
}
export function scopeAgentContext(context:AgentContext,requested:string[],access:AgentDataAccess):AgentContext{
 const permitted=new Set(permittedAgentTools(access));
 const includes=(name:string)=>requested.includes(name)&&permitted.has(name);
 return {
  clients:includes('get_clients')?context.clients:[],
  tasks:includes('get_tasks')?context.tasks:[],
  inventory:{products:includes('get_inventory')?context.inventory.products.map(product=>({id:product.id,name:product.name,stocks:product.stocks,minimum:product.minimum,price:product.price,deleted:product.deleted,...(access.finance===true&&typeof product.cost==='number'?{cost:product.cost}:{})})):[],warehouses:[],documents:[],sales:[],shifts:[]},
  ...(includes('get_analytics')?{analytics:summarizeAgentAnalytics(context)}:{}),
 };
}
export function canReadAgentRun(run:AgentRunScope,actorId:string,access:AgentDataAccess){
 if(!access.run||(run.actorId?run.actorId!==actorId:actorId!=='owner-user'))return false;
 const permitted=new Set(permittedAgentTools(access));
 const hasInventory=[...(run.tools||[]),...run.journal.map(step=>step.tool)].includes('get_inventory');
 if(access.finance!==true&&(run.finance===true||run.finance===undefined&&hasInventory))return false;
 return [...(run.tools||[]),...run.journal.map(step=>step.tool)].every(tool=>permitted.has(tool));
}
