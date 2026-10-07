import test from 'node:test';
import assert from 'node:assert/strict';
import {initialEmployees,teamActions} from '../lib/os/team.ts';
import {applyStaffMessengerAction,canManageStaffChat,canPostStaffChat,createStaffMessageTask,initialStaffMessenger,staffChatTitle,staffMessageReaders,staffUnreadCount,visibleStaffChats} from '../lib/os/staff-messenger.ts';

const employees=initialEmployees;
const permissions=Object.fromEntries(Object.keys(teamActions).map(action=>[action,true]));
const owner={employeeId:'owner-user',permissions},aiym={employeeId:'aiym',permissions},nuriza={employeeId:'nuriza',permissions};
const readonly={...aiym,permissions:Object.fromEntries(Object.keys(teamActions).map(action=>[action,false]))};
const now='2026-10-07T12:00:00Z';
const create=(kind='direct',id='chat-1',memberIds=['aiym'])=>({type:'createChat',kind,id,name:'Обсуждение',description:'Рабочие вопросы',memberIds,at:now});
function apply(state,action,actor=owner,people=employees){const result=applyStaffMessengerAction(state,action,actor,people);assert.equal(result.ok,true,result.error);return result.state}
const direct=()=>apply(initialStaffMessenger,create());
const send=(id,body='Сообщение',chatId='chat-1',extra={})=>({type:'send',chatId,id,body,attachments:[],at:now,...extra});

test('direct conversations are unique for the same pair in either direction and keep isolated membership',()=>{
 const state=direct(),again=applyStaffMessengerAction(state,create('direct','another',['owner-user']),aiym,employees);
 assert.equal(again.ok,true);assert.equal(again.chatId,'chat-1');assert.equal(again.state,state);
 assert.equal(visibleStaffChats(state,nuriza,employees).length,0);
 assert.equal(staffChatTitle(state.chats[0],owner.employeeId,employees),'Айым Абдиева');
 assert.equal(applyStaffMessengerAction(state,create('direct','bad',['aiym','nuriza']),owner,employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,create('direct','bad',['missing']),owner,employees).ok,false);
});

test('read-only, unknown and blocked employees cannot create or mutate chats',()=>{
 const state=apply(direct(),send('m1'));
 const actions=[create('group','new',['owner-user']),send('m2'),{type:'react',messageId:'m1',emoji:'👍'},{type:'read',chatId:'chat-1',messageId:'m1'}];
 for(const actor of [readonly,{...owner,employeeId:'missing'}])for(const action of actions)assert.equal(applyStaffMessengerAction(state,action,actor,employees).ok,false);
 const blocked=employees.map(person=>person.id===owner.employeeId?{...person,status:'Заблокирован'}:person);
 assert.equal(visibleStaffChats(state,owner,blocked).length,0);
 assert.equal(applyStaffMessengerAction(state,send('m3'),owner,blocked).ok,false);
 assert.equal(applyStaffMessengerAction(initialStaffMessenger,create(),{...owner,permissions:{...permissions,create:false}},employees).ok,false);
});

test('announcement channels require administration rights and restrict posting to owner or assigned admin',()=>{
 assert.equal(applyStaffMessengerAction(initialStaffMessenger,create('channel'),{...owner,permissions:{...permissions,remove:false}},employees).ok,false);
 let state=apply(initialStaffMessenger,create('channel'));
 assert.equal(canPostStaffChat(state.chats[0],aiym,employees),false);
 assert.equal(applyStaffMessengerAction(state,send('forbidden'),aiym,employees).ok,false);
 state=apply(state,{type:'updateChat',chatId:'chat-1',name:'Объявления',description:'',members:[{employeeId:'owner-user',role:'owner'},{employeeId:'aiym',role:'admin'}]});
 assert.equal(canPostStaffChat(state.chats[0],aiym,employees),true);
 assert.equal(apply(state,send('announcement'),aiym).messages[0].senderId,'aiym');
});

test('only the group owner with edit access can change membership, and owner cannot be removed',()=>{
 let state=apply(initialStaffMessenger,create('group'));
 state=apply(state,send('member-message'),aiym);
 const action={type:'updateChat',chatId:'chat-1',name:'Продажи',description:'План на неделю',members:[{employeeId:'owner-user',role:'owner'},{employeeId:'nuriza',role:'member'}]};
 assert.equal(canManageStaffChat(state.chats[0],aiym,employees),false);
 assert.equal(applyStaffMessengerAction(state,action,aiym,employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,action,{...owner,permissions:{...permissions,edit:false}},employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,{...action,members:[{employeeId:'aiym',role:'member'},{employeeId:'nuriza',role:'owner'}]},owner,employees).ok,false);
 state=apply(state,action);
 assert.equal(visibleStaffChats(state,aiym,employees).length,0);
 assert.equal(visibleStaffChats(state,nuriza,employees).length,1);
 assert.equal(applyStaffMessengerAction(state,send('no-longer-member'),aiym,employees).ok,false);
 for(const action of [{type:'editMessage',messageId:'member-message',body:'Изменение',at:now},{type:'deleteMessage',messageId:'member-message',at:now},{type:'react',messageId:'member-message',emoji:'👍'}])assert.equal(applyStaffMessengerAction(state,action,aiym,employees).ok,false);
});

test('sending rejects empty content, duplicate ids and replies from other chats or deleted messages',()=>{
 let state=apply(direct(),send('m1','Первое'));
 state=apply(state,create('group','chat-2',['nuriza']));
 state=apply(state,send('m2','Другой чат','chat-2'));
 assert.equal(applyStaffMessengerAction(state,send('empty',' '),owner,employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,send('m1'),owner,employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,send('bad-reply','Ответ','chat-1',{replyToId:'m2'}),owner,employees).ok,false);
 state=apply(state,send('reply','Ответ','chat-1',{replyToId:'m1'}),aiym);
 assert.equal(state.messages.at(-1).replyToId,'m1');
 state=apply(state,{type:'deleteMessage',messageId:'m1',at:now});
 assert.equal(applyStaffMessengerAction(state,send('reply-to-deleted','Ответ','chat-1',{replyToId:'m1'}),aiym,employees).ok,false);
});

test('message editing and deletion require independent permissions plus authorship and current membership',()=>{
 let state=apply(direct(),send('m1','Исходный текст'));
 const edit={type:'editMessage',messageId:'m1',body:'Исправлено',at:now},remove={type:'deleteMessage',messageId:'m1',at:now};
 for(const action of [edit,remove])assert.equal(applyStaffMessengerAction(state,action,aiym,employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,edit,{...owner,permissions:{...permissions,edit:false}},employees).ok,false);
 assert.equal(applyStaffMessengerAction(state,remove,{...owner,permissions:{...permissions,remove:false}},employees).ok,false);
 state=apply(state,edit);assert.equal(state.messages[0].body,'Исправлено');assert.equal(state.messages[0].editedAt,now);
 state=apply(state,remove);assert.equal(state.messages[0].body,'');assert.equal(state.messages[0].deletedAt,now);
 assert.equal(applyStaffMessengerAction(state,edit,owner,employees).ok,false);
});

test('reactions toggle only the acting member reaction and cannot touch deleted messages',()=>{
 let state=apply(direct(),send('m1'));
 state=apply(state,{type:'react',messageId:'m1',emoji:'👍'});
 state=apply(state,{type:'react',messageId:'m1',emoji:'👍'},aiym);
 assert.equal(state.messages[0].reactions.length,2);
 state=apply(state,{type:'react',messageId:'m1',emoji:'👍'});
 assert.deepEqual(state.messages[0].reactions,[{employeeId:'aiym',emoji:'👍'}]);
 assert.equal(applyStaffMessengerAction(state,{type:'react',messageId:'m1',emoji:'💣'},owner,employees).ok,false);
 state=apply(state,{type:'deleteMessage',messageId:'m1',at:now});
 assert.deepEqual(state.messages[0].reactions,[]);
 assert.equal(applyStaffMessengerAction(state,{type:'react',messageId:'m1',emoji:'👍'},aiym,employees).ok,false);
});

test('read counts come from saved message order, even when multiple messages have the same timestamp',()=>{
 let state=apply(direct(),send('m1'));
 state=apply(state,send('m2'));
 assert.equal(staffUnreadCount(state,state.chats[0],'aiym'),2);
 assert.deepEqual(staffMessageReaders(state,state.chats[0],state.messages[0]),[]);
 state=apply(state,{type:'read',chatId:'chat-1',messageId:'m1'},aiym);
 assert.equal(staffUnreadCount(state,state.chats[0],'aiym'),1);
 assert.deepEqual(staffMessageReaders(state,state.chats[0],state.messages[0]),['aiym']);
 assert.deepEqual(staffMessageReaders(state,state.chats[0],state.messages[1]),[]);
 state=apply(state,{type:'read',chatId:'chat-1',messageId:'m2'},aiym);
 const afterOldRead=apply(state,{type:'read',chatId:'chat-1',messageId:'m1'},aiym);
 assert.equal(afterOldRead,state);assert.equal(staffUnreadCount(state,state.chats[0],'aiym'),0);
 state=apply(state,send('m3'));
 assert.equal(staffUnreadCount(state,state.chats[0],'aiym'),1);
 state=apply(state,{type:'deleteMessage',messageId:'m3',at:now});
 assert.equal(staffUnreadCount(state,state.chats[0],'aiym'),0);
 assert.equal(staffUnreadCount(state,state.chats[0],'nuriza'),0);
});

test('file-only and audio messages persist metadata and survive JSON reload without base64 data',()=>{
 const attachments=[{id:'file-audio',name:'voice.ogg',type:'audio/ogg',size:4096},{id:'file-doc',name:'brief.pdf',type:'application/pdf',size:512}];
 const state=apply(direct(),send('files','','chat-1',{attachments}));
 const restored=JSON.parse(JSON.stringify(state));
 assert.deepEqual(restored.messages[0].attachments,attachments);
 assert.doesNotMatch(JSON.stringify(restored),/base64|data:/);
 const removed=apply(state,{type:'deleteMessage',messageId:'files',at:now});
 assert.deepEqual(removed.messages[0].attachments,[]);
});

test('tasks use the existing tasks shape, correct assignee and source link, without mutating messages',()=>{
 const state=apply(direct(),send('m1','Проверьте наличие SPF'));
 const result=createStaffMessageTask(state,'m1',aiym,employees,true,{id:'task-1',title:'Проверить SPF',assigneeId:'nuriza',dueDate:'2026-10-08'});
 assert.equal(result.ok,true);
 assert.equal(result.task.owner,'Нуриза Асанова');assert.equal(result.task.name,'Проверить SPF');assert.equal(result.task.status,'To Do');assert.equal(result.task.channel,'Средний');assert.equal(result.task.value,0);
 assert.equal(result.task.sourceChatId,'chat-1');assert.equal(result.task.sourceMessageId,'m1');assert.equal(result.task.nextTaskAt,'2026-10-08');assert.match(result.task.note,/Проверьте наличие SPF/);
 assert.equal(state.messages.length,1);
});

test('task creation checks both task permission and chat access, including source removal and valid dates',()=>{
 const state=apply(direct(),send('m1'));
 const input={id:'t',title:'Проверить',assigneeId:'aiym',dueDate:''};
 assert.equal(createStaffMessageTask(state,'m1',aiym,employees,false,input).ok,false);
 assert.equal(createStaffMessageTask(state,'m1',readonly,employees,true,input).ok,false);
 assert.equal(createStaffMessageTask(state,'m1',nuriza,employees,true,input).ok,false);
 assert.equal(createStaffMessageTask(state,'m1',owner,employees,true,{...input,assigneeId:'missing'}).ok,false);
 assert.equal(createStaffMessageTask(state,'m1',owner,employees,true,{...input,dueDate:'2026-02-30'}).ok,false);
 const removed=apply(state,{type:'deleteMessage',messageId:'m1',at:now});
 assert.equal(createStaffMessageTask(removed,'m1',owner,employees,true,input).ok,false);
});
