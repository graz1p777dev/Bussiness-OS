import type {Employee} from './team';
import {messageDirection,type ChatMessage} from './conversations.ts';
export type ReplyActivity={employeeId:string;date:string;replies:number};
export const demoReplyActivity:ReplyActivity[]=Array.from({length:7},(_,i)=>['aiym','medina','nuriza'].map((employeeId,j)=>({employeeId,date:'2026-10-'+String(i+1).padStart(2,'0'),replies:[28,34,23][j]+i%3*3}))).flat();
export function employeeRanking(employees:Employee[],activity:ReplyActivity[],messages:Record<string,ChatMessage[]>,from:string,to:string){
 const counts=new Map<string,number>();for(const row of activity)if(row.date>=from&&row.date<=to)counts.set(row.employeeId,(counts.get(row.employeeId)||0)+row.replies);
 for(const history of Object.values(messages))for(const message of history){if(typeof message==='string'||messageDirection(message)!=='outgoing'||!message.employeeId||!message.sentAt)continue;const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(message.sentAt));if(date>=from&&date<=to)counts.set(message.employeeId,(counts.get(message.employeeId)||0)+1)}
 let rank=0,previous=-1;return employees.filter(e=>e.status==='Активен'&&e.role!=='owner').map(e=>({...e,replies:counts.get(e.id)||0})).sort((a,b)=>b.replies-a.replies||a.name.localeCompare(b.name,'ru')).map((e,i)=>{if(e.replies!==previous)rank=i+1;previous=e.replies;return {...e,rank}});
}
