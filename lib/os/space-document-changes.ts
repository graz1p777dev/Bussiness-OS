import {spaceDocuments} from './knowledge-spaces.ts';
import type {DocumentEntry} from './documents.ts';
export type SpaceDocumentProposal={id:string;spaceId:string;agentId:string;agentName:string;action:'create'|'edit';documentId:string;name:string;text:string;before?:DocumentEntry;createdAt:string;status:'pending'|'applied'|'rejected';appliedAt?:string;automatic?:boolean};
export function proposeSpaceDocument(input:{spaceId:string;agentId:string;agentName:string;action:'create'|'edit';documentId:string;name:string;text:string},entries:DocumentEntry[],id:string,now:string):SpaceDocumentProposal{
 if(!entries.some(entry=>entry.id===input.spaceId&&entry.kind==='folder'&&!entry.parent&&!entry.deleted))throw new Error('Пространство недоступно.');
 if(!input.agentId)throw new Error('Выберите агента.');if(!input.text.trim()||input.text.length>100000)throw new Error('Текст документа — от 1 до 100000 символов.');
 const before=input.action==='edit'?spaceDocuments(entries,input.spaceId).find(entry=>entry.id===input.documentId):undefined;
 if(input.action==='edit'&&(!before||before.blob))throw new Error('Выберите текстовый документ пространства. Загруженные файлы редактируются отдельно.');
 const name=input.action==='edit'?before!.name:input.name.trim();if(!name||name.length>300)throw new Error('Название — от 1 до 300 символов.');
 return {...input,id,name,before:before?structuredClone(before):undefined,createdAt:now,status:'pending'};
}
export function applySpaceDocument(proposal:SpaceDocumentProposal,entries:DocumentEntry[],access:{create:boolean;edit:boolean;ai:boolean},now:string){
 if(proposal.status!=='pending')throw new Error('Предложение уже обработано.');if(!access.ai||!(proposal.action==='create'?access.create:access.edit))throw new Error('Действие запрещено ролью.');
 if(!entries.some(entry=>entry.id===proposal.spaceId&&entry.kind==='folder'&&!entry.parent&&!entry.deleted))throw new Error('Пространство удалено.');
 if(proposal.action==='create'){
 if(entries.some(entry=>entry.id===proposal.documentId))throw new Error('Документ с таким ID уже существует.');if(entries.some(entry=>!entry.deleted&&entry.parent===proposal.spaceId&&entry.name.toLowerCase()===proposal.name.toLowerCase()))throw new Error('Документ с таким названием уже существует.');
 return [...entries,{id:proposal.documentId,parent:proposal.spaceId,name:proposal.name,kind:'file' as const,text:proposal.text,mime:'text/markdown',modified:now}];}
 const live=spaceDocuments(entries,proposal.spaceId).find(entry=>entry.id===proposal.documentId);if(!live||live.blob||JSON.stringify(live)!==JSON.stringify(proposal.before))throw new Error('Документ изменился или перемещён. Подготовьте новое предложение.');return entries.map(entry=>entry.id===live.id?{...entry,text:proposal.text,modified:now}:entry);
}
export function localDocumentText(method:'full'|'append'|'replace',before:string,input:string,find:string){if(!input.trim())throw new Error('Введите текст.');if(method==='append')return before+(before?'\n\n':'')+input;if(method==='replace'){if(!find||!before.includes(find))throw new Error('Указанный фрагмент не найден в документе.');return before.replaceAll(find,input)}return input}
export function parseModelDocument(text:string){const raw=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value)||!('text' in value)||typeof value.text!=='string'||!value.text.trim()||value.text.length>100000)throw new Error('Модель должна вернуть JSON с текстом документа.');return value.text}
export function spaceDocumentCommand(request:string){
 const create=request.match(/^создай\s+документ\s+[«"]([^»"]+)[»"]\s*:\s*([\s\S]+)$/i);if(create)return {action:'create' as const,name:create[1],text:create[2],method:'full' as const,find:''};
 const append=request.match(/^добавь\s+в\s+документ\s+[«"]([^»"]+)[»"]\s*:\s*([\s\S]+)$/i);if(append)return {action:'edit' as const,name:append[1],text:append[2],method:'append' as const,find:''};
 const replace=request.match(/^замени\s+в\s+документе?\s+[«"]([^»"]+)[»"]\s+[«"]([^»"]+)[»"]\s+на\s+[«"]([\s\S]+)[»"]$/i);if(replace)return {action:'edit' as const,name:replace[1],text:replace[3],method:'replace' as const,find:replace[2]};return null;
}
