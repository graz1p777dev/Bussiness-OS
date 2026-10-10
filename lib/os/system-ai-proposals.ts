import {authorizeSettingsChange,settingsDocumentDiff,validateSettingsDocument,writeSettingsDocument,getSettingsDocument,type SettingsAccess,type SettingsDiff,type SettingsDocument,type SettingsStorage} from './settings-document.ts';

export type SystemProposalKind='logistics'|'reply-review'|'engineer-safeguards';
export type SystemProposal={id:string;kind:SystemProposalKind;request:string;title:string;summary:string;limitations:string;changes:SettingsDiff[]};
export const systemProposalLabels:Record<SystemProposalKind,string>={logistics:'Логистика в CRM','reply-review':'Проверка ответов бота','engineer-safeguards':'Безопасная диагностика сервера'};
const distinct=(rows:string[],added:string[])=>{const result=[...rows],seen=new Set(rows.map(row=>row.trim().toLocaleLowerCase('ru')));for(const row of added)if(!seen.has(row.toLocaleLowerCase('ru'))){result.push(row);seen.add(row.toLocaleLowerCase('ru'))}return result};
export function prepareSystemProposal(kind:SystemProposalKind,request:string,current:SettingsDocument,id:string):SystemProposal{
 if(!request.trim()||request.length>2000)throw new Error('Опишите задачу: от 1 до 2000 символов.');
 current=validateSettingsDocument(current);const next=structuredClone(current);let summary='',limitations='';
 if(kind==='logistics'){
  const stages=next.crm.stages as {sales:{id:string;name:string;color:string}[];repeat:{id:string;name:string;color:string}[]};
  const names=['Готово к отгрузке','В пути','Доставлено'],known=new Set(stages.sales.map(stage=>stage.name.trim().toLocaleLowerCase('ru')));
  stages.sales.push(...names.filter(name=>!known.has(name.toLocaleLowerCase('ru'))).map((name,index)=>({id:id+'-stage-'+index,name,color:['#5b8def','#d99b43','#46a887'][index]})));
  const settings=next.crm.settings as {customFields:string};settings.customFields=distinct(settings.customFields.split('\n').filter(Boolean),['Адрес доставки','Перевозчик','Трек-номер','Дата доставки']).join('\n');
  summary='Добавить этапы отгрузки в воронку продаж и поля доставки в существующую карточку CRM. Текущие этапы, поля и записи сохраняются.';
  limitations='Покупки доступны через уже связанную карточку клиента и customerId. Предложение не связывает автоматически старые чеки, не создаёт отдельный заказ доставки, страницу логистики или интеграцию перевозчика. Для этого нужен новый модуль и серверный исполнитель.';
 }else if(kind==='reply-review'){
  const bot=next.ai.bot as Record<string,unknown>;bot.mode='С подтверждением';bot.strictTraining=true;
  summary='Включить подтверждение подготовленного ответа и строгое обучение в существующих диалогах.';
  limitations='Ответы остаются локальными черновиками. Это предложение не подключает модель, не отправляет сообщения и не изменяет prompt агента.';
 }else if(kind==='engineer-safeguards'){
  const engineer=next.system.engineer as Record<string,unknown>;Object.assign(engineer,{mode:'diagnose',backup:true,tests:true,rollback:true});
  summary='Сохранить режим диагностики, обязательный бэкап, проверки и план отката в конфигурации инженера.';
  limitations='Параметры предназначены для будущего серверного исполнителя. Бэкап, тесты сервера, патч и деплой сейчас не выполняются.';
 }else throw new Error('Этот локальный сценарий не поддерживается.');
 return {id,kind,request:request.trim(),title:systemProposalLabels[kind],summary,limitations,changes:settingsDocumentDiff(current,validateSettingsDocument(next))};
}
export function applySystemProposal(proposal:SystemProposal,selected:string[],current:SettingsDocument,access:SettingsAccess):SettingsDocument{
 if(!selected.length)throw new Error('Выберите хотя бы одно изменение.');
 const allowed:Record<SystemProposalKind,string[]>={logistics:['crm.stages','crm.settings'],'reply-review':['ai.bot'],'engineer-safeguards':['system.engineer']};
 if(!allowed[proposal.kind]||new Set(selected).size!==selected.length)throw new Error('Некорректное предложение.');
 current=validateSettingsDocument(current);const next=structuredClone(current);
 for(const path of selected){const change=proposal.changes.find(change=>change.path===path);if(!change||!allowed[proposal.kind].includes(path)||path!==change.branch+'.'+change.section)throw new Error('Изменение не входит в предложение.');if(JSON.stringify(current[change.branch][change.section])!==JSON.stringify(change.before))throw new Error('Раздел «'+path+'» изменился после подготовки. Подготовьте предложение заново.');next[change.branch][change.section]=structuredClone(change.after)}
 const valid=validateSettingsDocument(next);authorizeSettingsChange(current,valid,access);return valid;
}
export function commitSystemProposal(proposal:SystemProposal,selected:string[],access:SettingsAccess,storage:SettingsStorage=localStorage){const current=getSettingsDocument(storage),next=applySystemProposal(proposal,selected,current,access);return writeSettingsDocument(next,access,storage)}
export function proposalChangeText(change:SettingsDiff,side:'before'|'after'){
 const value=change[side] as Record<string,unknown>;
 if(change.path==='crm.stages')return (value.sales as {name:string}[]).map(row=>row.name).join(' → ');
 if(change.path==='crm.settings')return String(value.customFields);
 if(change.path==='ai.bot')return 'Ответы: '+String(value.mode)+'\nСтрогое обучение: '+(value.strictTraining?'включено':'выключено');
 return 'Режим: '+String(value.mode)+'\nБэкап: '+(value.backup?'да':'нет')+' · Проверки: '+(value.tests?'да':'нет')+' · Откат: '+(value.rollback?'да':'нет');
}
