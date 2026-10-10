import type {Entity} from './data.ts';
export type CRMFocus='all'|'reply'|'overdue'|'unassigned'|'mine';
export function focusDeals(deals:Entity[],focus:CRMFocus,unanswered:string[],viewer:string,now:number){
 return deals.filter(deal=>focus==='all'||focus==='reply'&&unanswered.includes(deal.id)||focus==='overdue'&&Boolean(deal.nextTaskAt&&Date.parse(deal.nextTaskAt)<now)||focus==='unassigned'&&!deal.owner.trim()||focus==='mine'&&(deal.owner===viewer||deal.owner===viewer.trim().split(/\s+/)[0]));
}
export function nextDealAction(deal:Entity,needsReply:boolean,now:number){
 if(needsReply)return {label:'Ответить клиенту',tone:'reply'};
 if(deal.nextTaskAt&&Date.parse(deal.nextTaskAt)<now)return {label:'Просрочен следующий контакт',tone:'overdue'};
 if(!deal.owner.trim())return {label:'Назначить ответственного',tone:'unassigned'};
 if(deal.nextTaskAt)return {label:'Контакт: '+new Date(deal.nextTaskAt).toLocaleDateString('ru-RU',{timeZone:'Asia/Bishkek',day:'numeric',month:'short'}),tone:'scheduled'};
 return {label:'Запланировать следующий шаг',tone:'empty'};
}
