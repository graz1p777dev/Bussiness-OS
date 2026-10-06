'use client';
import {useMemo} from 'react';
import {useStored} from '../../lib/os/storage';
import {initialDeals,initialTasks,type Entity} from '../../lib/os/data';
import {initialInventory} from '../../lib/os/inventory-model';
import {initialEmployees,initialRoles,hasAccess} from '../../lib/os/team';
import {workspaceNotices} from '../../lib/os/notifications';
import {type ChatMessage} from '../../lib/os/conversations';
export function useWorkspaceNotifications(accountId:string){
 const [deals]=useStored('deals',initialDeals);
 const [messages]=useStored<Record<string,ChatMessage[]>>('messages',{});
 const [tasks]=useStored('tasks',initialTasks);
 const [inventory]=useStored('inventory-v2',initialInventory);
 const [employees]=useStored('team-employees-v3',initialEmployees);
 const [roles]=useStored('team-roles-v3',initialRoles);
 const [read,setRead]=useStored<string[]>('notification-read-v2:'+accountId,[]);
 const notices=useMemo(()=>{
  const employee=employees.find(row=>row.id===accountId);
  const owns=(row:Entity)=>accountId==='owner-user'||row.owner===employee?.name||row.owner===employee?.name.split(' ')[0];
  return workspaceNotices(deals.filter(owns),messages,tasks.filter(owns),inventory).filter(notice=>hasAccess(employee,roles,notice.route));
 },[accountId,deals,messages,tasks,inventory,employees,roles]);
 return {notices,read,setRead,unread:notices.filter(notice=>!read.includes(notice.id)).length};
}
