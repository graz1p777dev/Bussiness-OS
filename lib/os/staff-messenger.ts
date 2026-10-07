import type {Entity} from './data.ts';
import type {ActionPermissions,Employee} from './team.ts';

export type StaffChatKind='direct'|'group'|'channel';
export type StaffMember={employeeId:string;role:'owner'|'admin'|'member';readToId?:string};
export type StaffChat={id:string;kind:StaffChatKind;name:string;description:string;createdBy:string;createdAt:string;members:StaffMember[]};
export type StaffAttachment={id:string;name:string;type:string;size:number};
export type StaffMessage={id:string;chatId:string;senderId:string;body:string;createdAt:string;editedAt?:string;deletedAt?:string;replyToId?:string;attachments:StaffAttachment[];reactions:{employeeId:string;emoji:string}[]};
export type StaffMessengerState={chats:StaffChat[];messages:StaffMessage[]};
export type StaffActor={employeeId:string;permissions?:ActionPermissions};
export type StaffMessageTask=Entity&{sourceChatId:string;sourceMessageId:string};
export const initialStaffMessenger:StaffMessengerState={chats:[],messages:[]};
export const staffReactions=['👍','❤️','✅','🔥','👀'];
export const staffChatLabels:Record<StaffChatKind,string>={direct:'Личный диалог',group:'Группа',channel:'Объявления'};
export type StaffMessengerAction=
 |{type:'createChat';id:string;kind:StaffChatKind;name:string;description:string;memberIds:string[];at:string}
 |{type:'updateChat';chatId:string;name:string;description:string;members:Pick<StaffMember,'employeeId'|'role'>[]}
 |{type:'send';chatId:string;id:string;body:string;replyToId?:string;attachments:StaffAttachment[];at:string}
 |{type:'editMessage';messageId:string;body:string;at:string}
 |{type:'deleteMessage';messageId:string;at:string}
 |{type:'react';messageId:string;emoji:string}
 |{type:'read';chatId:string;messageId:string};
type StaffResult={ok:true;state:StaffMessengerState;chatId?:string}|{ok:false;error:string};

export function staffCan(actor:StaffActor,employees:Employee[],action:keyof ActionPermissions){return employees.some(person=>person.id===actor.employeeId&&person.status==='Активен')&&(actor.permissions?.[action]??true)}
export function staffChatMember(chat:StaffChat|undefined,employeeId:string){return chat?.members.find(member=>member.employeeId===employeeId)}
export function canPostStaffChat(chat:StaffChat|undefined,actor:StaffActor,employees:Employee[]){const member=staffChatMember(chat,actor.employeeId);return Boolean(member&&staffCan(actor,employees,'create')&&(chat?.kind!=='channel'||member.role==='owner'||member.role==='admin'))}
export function canManageStaffChat(chat:StaffChat|undefined,actor:StaffActor,employees:Employee[]){return Boolean(chat&&chat.kind!=='direct'&&staffChatMember(chat,actor.employeeId)?.role==='owner'&&staffCan(actor,employees,'edit'))}
export function staffChatTitle(chat:StaffChat,employeeId:string,employees:Employee[]){return chat.kind==='direct'?employees.find(person=>person.id===chat.members.find(member=>member.employeeId!==employeeId)?.employeeId)?.name||'Сотрудник недоступен':chat.name}
export function visibleStaffChats(state:StaffMessengerState,actor:StaffActor,employees:Employee[]){return employees.some(person=>person.id===actor.employeeId&&person.status==='Активен')?state.chats.filter(chat=>staffChatMember(chat,actor.employeeId)):[]}
export function staffUnreadCount(state:StaffMessengerState,chat:StaffChat,employeeId:string){
 const member=staffChatMember(chat,employeeId);if(!member)return 0;
 const messages=state.messages.filter(message=>message.chatId===chat.id),readIndex=messages.findIndex(message=>message.id===member.readToId);
 return messages.slice(readIndex+1).filter(message=>message.senderId!==employeeId&&!message.deletedAt).length;
}
export function staffMessageReaders(state:StaffMessengerState,chat:StaffChat,message:StaffMessage){
 if(message.deletedAt||message.chatId!==chat.id)return [];
 const messages=state.messages.filter(item=>item.chatId===chat.id),index=messages.findIndex(item=>item.id===message.id);
 return index<0?[]:chat.members.filter(member=>member.employeeId!==message.senderId&&messages.findIndex(item=>item.id===member.readToId)>=index).map(member=>member.employeeId);
}

export function applyStaffMessengerAction(state:StaffMessengerState,action:StaffMessengerAction,actor:StaffActor,employees:Employee[]):StaffResult{
 const denied={ok:false,error:'Действие недоступно: проверьте права и участие в чате.'} as const;
 if(action.type==='createChat'){
  if(!staffCan(actor,employees,'create')||(action.kind==='channel'&&!staffCan(actor,employees,'remove')))return denied;
  const ids=[...new Set([actor.employeeId,...action.memberIds])];
  if(ids.some(id=>!employees.some(person=>person.id===id&&person.status==='Активен')))return {ok:false,error:'Выберите действующих сотрудников.'};
  if(action.kind==='direct'&&ids.length!==2)return {ok:false,error:'Выберите одного собеседника.'};
  if(action.kind!=='direct'&&(!action.name.trim()||ids.length<2))return {ok:false,error:'Укажите название и хотя бы одного участника.'};
  if(action.kind==='direct'){
   const existing=state.chats.find(chat=>chat.kind==='direct'&&chat.members.length===2&&chat.members.every(member=>ids.includes(member.employeeId)));
   if(existing)return {ok:true,state,chatId:existing.id};
  }
  if(state.chats.some(chat=>chat.id===action.id))return {ok:false,error:'Этот чат уже существует.'};
  const chat:StaffChat={id:action.id,kind:action.kind,name:action.name.trim(),description:action.description.trim(),createdBy:actor.employeeId,createdAt:action.at,members:ids.map(employeeId=>({employeeId,role:employeeId===actor.employeeId?'owner':'member'}))};
  return {ok:true,state:{...state,chats:[...state.chats,chat]},chatId:chat.id};
 }
 if(action.type==='updateChat'){
  const chat=state.chats.find(item=>item.id===action.chatId);
  if(!chat||!canManageStaffChat(chat,actor,employees))return denied;
  if(!action.name.trim()||action.members.length<2)return {ok:false,error:'Укажите название и хотя бы одного другого участника.'};
  if(new Set(action.members.map(member=>member.employeeId)).size!==action.members.length)return {ok:false,error:'Участники не должны повторяться.'};
  if(action.members.filter(member=>member.role==='owner').length!==1||!action.members.some(member=>member.employeeId===actor.employeeId&&member.role==='owner'))return {ok:false,error:'Владелец должен оставаться в чате.'};
  if(action.members.some(member=>!['owner','admin','member'].includes(member.role)||(!staffChatMember(chat,member.employeeId)&&!employees.some(person=>person.id===member.employeeId&&person.status==='Активен'))))return {ok:false,error:'Нового участника можно выбрать только из действующих сотрудников.'};
  const updated={...chat,name:action.name.trim(),description:action.description.trim(),members:action.members.map(member=>({...staffChatMember(chat,member.employeeId),...member}))};
  return {ok:true,state:{...state,chats:state.chats.map(item=>item.id===chat.id?updated:item)}};
 }
 if(action.type==='read'){
  const chat=state.chats.find(item=>item.id===action.chatId),member=staffChatMember(chat,actor.employeeId);
  if(!chat||!member||!staffCan(actor,employees,'edit'))return denied;
  const messages=state.messages.filter(message=>message.chatId===chat.id),next=messages.findIndex(message=>message.id===action.messageId),previous=messages.findIndex(message=>message.id===member.readToId);
  if(next<0||next<=previous)return {ok:true,state};
  return {ok:true,state:{...state,chats:state.chats.map(item=>item.id===chat.id?{...item,members:item.members.map(person=>person.employeeId===actor.employeeId?{...person,readToId:action.messageId}:person)}:item)}};
 }
 if(action.type==='send'){
  const chat=state.chats.find(item=>item.id===action.chatId);
  if(!chat||!canPostStaffChat(chat,actor,employees))return denied;
  if(!action.body.trim()&&!action.attachments.length)return {ok:false,error:'Напишите сообщение или прикрепите файл.'};
  if(action.replyToId&&!state.messages.some(message=>message.id===action.replyToId&&message.chatId===chat.id&&!message.deletedAt))return {ok:false,error:'Исходное сообщение недоступно для ответа.'};
  if(state.messages.some(message=>message.id===action.id))return {ok:false,error:'Сообщение уже сохранено.'};
  if(action.attachments.some(file=>!file.id||!file.name||!Number.isFinite(file.size)||file.size<0)||new Set(action.attachments.map(file=>file.id)).size!==action.attachments.length)return {ok:false,error:'Проверьте прикреплённые файлы.'};
  const message:StaffMessage={id:action.id,chatId:chat.id,senderId:actor.employeeId,body:action.body.trim(),createdAt:action.at,replyToId:action.replyToId,attachments:action.attachments,reactions:[]};
  return {ok:true,state:{...state,messages:[...state.messages,message],chats:state.chats.map(item=>item.id===chat.id?{...item,members:item.members.map(member=>member.employeeId===actor.employeeId?{...member,readToId:message.id}:member)}:item)}};
 }
 const message=state.messages.find(item=>item.id===action.messageId),chat=state.chats.find(item=>item.id===message?.chatId);
 if(!message||message.deletedAt||!staffChatMember(chat,actor.employeeId))return denied;
 let updated:StaffMessage;
 if(action.type==='react'){
  if(!staffCan(actor,employees,'edit')||!staffReactions.includes(action.emoji))return denied;
  const exists=message.reactions.some(reaction=>reaction.employeeId===actor.employeeId&&reaction.emoji===action.emoji);
  updated={...message,reactions:exists?message.reactions.filter(reaction=>reaction.employeeId!==actor.employeeId||reaction.emoji!==action.emoji):[...message.reactions,{employeeId:actor.employeeId,emoji:action.emoji}]};
 }else{
  if(message.senderId!==actor.employeeId||!staffCan(actor,employees,action.type==='deleteMessage'?'remove':'edit'))return denied;
  if(action.type==='deleteMessage')updated={...message,body:'',attachments:[],reactions:[],deletedAt:action.at};
  else{if(!action.body.trim()&&!message.attachments.length)return {ok:false,error:'Текст сообщения не может быть пустым.'};updated={...message,body:action.body.trim(),editedAt:action.at}}
 }
 return {ok:true,state:{...state,messages:state.messages.map(item=>item.id===message.id?updated:item)}};
}

export function createStaffMessageTask(state:StaffMessengerState,messageId:string,actor:StaffActor,employees:Employee[],canCreateTask:boolean,input:{id:string;title:string;assigneeId:string;dueDate:string}):{ok:true;task:StaffMessageTask}|{ok:false;error:string}{
 const message=state.messages.find(item=>item.id===messageId),chat=state.chats.find(item=>item.id===message?.chatId),assignee=employees.find(person=>person.id===input.assigneeId&&person.status==='Активен');
 if(!staffCan(actor,employees,'create')||!canCreateTask||!message||message.deletedAt||!chat||!staffChatMember(chat,actor.employeeId))return {ok:false,error:'Нет доступа к созданию задачи из этого сообщения.'};
 if(!input.title.trim()||!assignee)return {ok:false,error:'Укажите название и действующего ответственного.'};
 if(input.dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)||!Number.isFinite(Date.parse(input.dueDate))||new Date(input.dueDate).toISOString().slice(0,10)!==input.dueDate))return {ok:false,error:'Укажите корректный срок задачи.'};
 return {ok:true,task:{id:input.id,name:input.title.trim(),value:0,status:'To Do',channel:'Средний',owner:assignee.name,note:`Из чата «${staffChatTitle(chat,actor.employeeId,employees)}». Сообщение ${message.id}.\n\n${message.body||message.attachments.map(file=>file.name).join(', ')}`,sourceChatId:chat.id,sourceMessageId:message.id,...(input.dueDate?{nextTaskAt:input.dueDate}:{} )}};
}

// Local blobs stay in IndexedDB; localStorage contains attachment metadata only.
function staffFileDatabase():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Хранилище файлов недоступно в этом браузере.'));return}const request=indexedDB.open('life-staff-message-files-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Хранилище файлов занято другой вкладкой.'))})}
export async function saveStaffAttachment(id:string,file:Blob){const db=await staffFileDatabase();return new Promise<void>((resolve,reject)=>{const transaction=db.transaction('files','readwrite');transaction.objectStore('files').put(file,id);transaction.oncomplete=()=>{db.close();resolve()};transaction.onerror=transaction.onabort=()=>{db.close();reject(transaction.error||new Error('Не удалось сохранить файл.'))}})}
export async function loadStaffAttachment(id:string){const db=await staffFileDatabase();return new Promise<Blob|undefined>((resolve,reject)=>{const transaction=db.transaction('files','readonly'),request=transaction.objectStore('files').get(id);transaction.oncomplete=()=>{db.close();resolve(request.result as Blob|undefined)};transaction.onerror=transaction.onabort=()=>{db.close();reject(transaction.error)}})}
export async function removeStaffAttachment(id:string){const db=await staffFileDatabase();return new Promise<void>((resolve,reject)=>{const transaction=db.transaction('files','readwrite');transaction.objectStore('files').delete(id);transaction.oncomplete=()=>{db.close();resolve()};transaction.onerror=transaction.onabort=()=>{db.close();reject(transaction.error)}})}
