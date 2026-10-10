import {selectedKnowledgeSpaces} from './agent-knowledge.ts';
import {agentToolDefinitions} from './agent-tools.ts';
import {canReadAgentRun,permittedAgentTools,type AgentDataAccess} from './agent-access.ts';
import {agentEntityTools,agentToolLabels,configuredAgentEntities,configuredAgentTools,type AgentReport} from './agent-workspace.ts';
import {readSettingsAlias,setSettingsAlias,type SettingsDocument} from './settings-document.ts';
import type {Entity} from './data.ts';

export type AgentConfigurationDraft={name:string;description:string;knowledgeSpaces:string[];entities:string[];prompt:string;tools:string[];status:'enabled'|'disabled';frequency:'manual'|'daily'|'weekly';time:string;weekday:number;provider:string;model:string};
export function readAgentConfiguration(settings:Record<string,unknown>={},fallback:{name?:string;prompt?:string;status?:string;model?:string}={}):AgentConfigurationDraft{
 let schedule:Record<string,unknown>={time:settings.schedule};try{if(typeof settings.schedule==='string'&&settings.schedule.startsWith('{')){const value:unknown=JSON.parse(settings.schedule);if(value&&typeof value==='object'&&!Array.isArray(value))schedule=value as Record<string,unknown>}}catch{}
 return {knowledgeSpaces:selectedKnowledgeSpaces(settings),name:fallback.name||(typeof settings.name==='string'?settings.name:'Агент'),description:typeof settings.description==='string'?settings.description:'',entities:configuredAgentEntities(settings),prompt:typeof settings.prompt==='string'?settings.prompt:fallback.prompt||'',tools:configuredAgentTools(settings,agentToolDefinitions.map(tool=>tool.name)),status:settings.status==='disabled'||fallback.status&&fallback.status!=='Активен'?'disabled':'enabled',frequency:settings.frequency==='daily'||settings.frequency==='weekly'?settings.frequency:'manual',time:typeof schedule.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)?schedule.time:'09:00',weekday:Number.isInteger(Number(schedule.weekday))&&Number(schedule.weekday)>=1&&Number(schedule.weekday)<=7?Number(schedule.weekday):1,provider:typeof settings.provider==='string'?settings.provider:'',model:typeof settings.model==='string'?settings.model:fallback.model||''};
}
export function saveAgentConfiguration(draft:AgentConfigurationDraft,previous:Record<string,unknown>,access:AgentDataAccess):Record<string,unknown>{
 if(!draft.name.trim()||draft.name.length>120)throw new Error('Название должно содержать от 1 до 120 символов.');
 if(draft.description.length>600)throw new Error('Описание должно содержать до 600 символов.');
 if(!draft.prompt.trim()||draft.prompt.length>1800)throw new Error('Инструкция должна содержать от 1 до 1800 символов.');
 if(!['enabled','disabled'].includes(draft.status)||!['manual','daily','weekly'].includes(draft.frequency))throw new Error('Проверьте статус и частоту запуска.');
 if(!Array.isArray(draft.knowledgeSpaces)||draft.knowledgeSpaces.length>30||new Set(draft.knowledgeSpaces).size!==draft.knowledgeSpaces.length||draft.knowledgeSpaces.some(id=>typeof id!=='string'||!id.trim()||id.length>300))throw new Error('Проверьте выбранные пространства.');if(access.knowledge!==true&&draft.knowledgeSpaces.some(id=>!selectedKnowledgeSpaces(previous).includes(id)))throw new Error('База знаний недоступна вашей роли.');
 const before=configuredAgentTools(previous,agentToolDefinitions.map(tool=>tool.name)),permitted=permittedAgentTools(access);
 const beforeEntities=configuredAgentEntities(previous);
 if(!Array.isArray(draft.entities)||new Set(draft.entities).size!==draft.entities.length||draft.entities.some(entity=>!Object.hasOwn(agentEntityTools,entity)||!beforeEntities.includes(entity)&&!permitted.includes(agentEntityTools[entity])))throw new Error('Нельзя добавить недоступную сущность.');
 if(draft.tools.some(tool=>!draft.entities.some(entity=>agentEntityTools[entity]===tool)))throw new Error('Инструмент требует доступа к соответствующей сущности.');
 if(!Array.isArray(draft.tools)||new Set(draft.tools).size!==draft.tools.length||draft.tools.some(tool=>!Object.hasOwn(agentToolLabels,tool)||!before.includes(tool)&&!permitted.includes(tool)))throw new Error('Нельзя добавить недоступный источник.');
 if(draft.status==='enabled'&&!draft.tools.length)throw new Error('Выберите хотя бы один источник для активного агента.');
 if(draft.frequency!=='manual'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))throw new Error('Укажите время от 00:00 до 23:59.');
 if(draft.frequency==='weekly'&&(!Number.isInteger(draft.weekday)||draft.weekday<1||draft.weekday>7))throw new Error('Выберите день недели.');
 if(draft.provider.length>120||draft.model.length>120)throw new Error('Название провайдера и модели — до 120 символов.');
 return {...previous,knowledgeSpaces:JSON.stringify(draft.knowledgeSpaces),name:draft.name.trim(),description:draft.description.trim(),entities:JSON.stringify(draft.entities),prompt:draft.prompt.trim(),tools:JSON.stringify(draft.tools),status:draft.status,frequency:draft.frequency,schedule:draft.frequency==='manual'?'':draft.frequency==='daily'?draft.time:JSON.stringify({time:draft.time,weekday:draft.weekday}),provider:draft.provider.trim(),model:draft.model.trim()};
}
export function updateAgentConfigurationDocument(document:SettingsDocument,expected:Entity,source:Record<string,unknown>,draft:AgentConfigurationDraft,access:AgentDataAccess,canEdit:boolean){
 if(!canEdit)throw new Error('Редактирование агентов запрещено вашей ролью.');
 const definitions=readSettingsAlias(document,'agents') as Entity[],settings=readSettingsAlias(document,'agent-settings') as Record<string,Record<string,unknown>>,live=definitions.find(agent=>agent.id===expected.id);
 if(!live||JSON.stringify(live)!==JSON.stringify(expected)||JSON.stringify(settings[expected.id]||{})!==JSON.stringify(source))throw new Error('Настройки изменились. Откройте форму заново.');
 const value=saveAgentConfiguration(draft,source,access),next=setSettingsAlias(document,'agent-settings',{...settings,[expected.id]:value});
 return setSettingsAlias(next,'agents',definitions.map(agent=>agent.id===expected.id?{...agent,name:draft.name.trim(),note:draft.prompt.trim(),status:draft.status==='enabled'?'Активен':'Пауза'}:agent));
}
export function agentConfigurationHistory(runs:AgentReport[],agentId:string,actorId:string,access:AgentDataAccess){return runs.filter(run=>run.agentId===agentId&&canReadAgentRun(run,actorId,access))}
