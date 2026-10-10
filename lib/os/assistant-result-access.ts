import {calendarSources} from './calendar.ts';
import {allowedSystemTools,systemAppearanceResult,type SystemContext,type SystemToolName} from './system-tools.ts';
export type AssistantResultScope={saleIds:string[]};
/** Saved results are snapshots; authority is always re-evaluated against the current scoped context. */
export function readableAssistantResult(tool:SystemToolName,result:unknown,context:SystemContext,scope?:AssistantResultScope):unknown{
 if(!allowedSystemTools(context.can).some(item=>item.name===tool))return null;
 if(tool==='get_calendar'){
  if(!Array.isArray(result))return [];
  const current=new Map((context.calendar||[]).filter(event=>Object.hasOwn(calendarSources,event.source)&&context.can(calendarSources[event.source].route)).map(event=>[event.id,event]));
  return result.filter(row=>{const event=row&&typeof row==='object'?current.get(row.id):undefined;return event&&event.source===row.source&&event.recordId===row.recordId}).map(({id,title,date,time,source,recordId})=>({id,title,date,time,source,recordId}));
 }
 if(tool==='get_settings')return context.appearance?systemAppearanceResult(result):{};
 const sales=new Set(context.inventory.sales.map(sale=>sale.id));
 if(tool==='get_sales'&&Array.isArray(result)){
  const customers=['crm','customers','conversations'].some(page=>context.can(page));
  return result.filter(row=>row&&typeof row==='object'&&sales.has(row.id)).map(row=>({id:row.id,date:row.date,total:row.total,status:row.status,...(customers?{customerId:row.customerId,customerName:row.customerName}:{})}));
 }
 if(tool==='get_analytics'&&result&&typeof result==='object'&&!Array.isArray(result)){
  const rows=result as Record<string,unknown>,crm=context.can('crm'),canSales=context.can('pos')&&(context.can('analytics')||context.can('finance'))&&Boolean(scope&&scope.saleIds.every(id=>sales.has(id)));
  return Object.fromEntries(Object.entries(rows).filter(([key])=>crm&&['leads','won','lost','potential','sources'].includes(key)||canSales&&['sales','revenue','refunds'].includes(key)));
 }
 if((tool==='get_products'||tool==='get_inventory')&&Array.isArray(result)&&!context.can('finance'))return result.map(row=>{const output={...row};delete output.cost;return output});
 return result;
}
