import test from 'node:test';
import assert from 'node:assert/strict';
import {assignDealAgent,reconcileAgentAssignments,emptyAgentPolicy} from '../lib/os/agent-handoffs.ts';
const agent=(id,status='Активен')=>({id,name:'Агент '+id,status,value:0,channel:'Chat Model',owner:'',note:''});
const agents=[agent('sales'),agent('support'),agent('urgent')];
const stages={sales:[{id:'new',name:'Новый'},{id:'payment',name:'Оплата'}],repeat:[{id:'repeat',name:'Новый'}]};
const policies={new:{...emptyAgentPolicy,agentId:'sales',fallbackAgentId:'support',urgentAgentId:'urgent',unansweredAgentId:'support',unansweredMinutes:10},payment:{...emptyAgentPolicy,agentId:'support'}};
const deal={id:'d1',name:'Клиент',value:100,status:'Новый',pipeline:'Продажи',channel:'WhatsApp',owner:'Менеджер',note:''};
const now='2026-10-07T10:30:00Z';
test('stage assignment, stage transitions and inactive agent substitution preserve one history entry per handoff',()=>{
 let rows=reconcileAgentAssignments([deal],agents,stages,policies,{},now);
 assert.equal(rows[0].agentId,'sales');assert.equal(rows[0].agentHistory.length,1);
 assert.equal(reconcileAgentAssignments(rows,agents,stages,policies,{},now),rows);
 rows=reconcileAgentAssignments(rows,[agent('sales','Пауза'),agents[1]],stages,policies,{},now);
 assert.equal(rows[0].agentId,'support');assert.equal(rows[0].agentHistory.length,2);
 const payment=reconcileAgentAssignments([{...rows[0],status:'Оплата'}],agents,stages,policies,{},now)[0];
 assert.equal(payment.agentAssignment.stageId,'payment');assert.equal(payment.agentId,'support');
 assert.equal(reconcileAgentAssignments([{...deal,pipeline:'Успешно'}],agents,stages,policies,{},now)[0].owner,'Менеджер');
});
test('manual assignment survives unrelated renders until the stage changes or the chosen agent becomes unavailable',()=>{
 const manual=assignDealAgent(deal,agents[2],'new','Вручную',true,now),rows=[manual];
 assert.equal(reconcileAgentAssignments(rows,agents,stages,policies,{},now),rows);
 assert.equal(reconcileAgentAssignments([{...manual,status:'Оплата'}],agents,stages,policies,{},now)[0].agentId,'support');
 assert.equal(reconcileAgentAssignments(rows,[agents[0],agents[1],agent('urgent','Пауза')],stages,policies,{},now)[0].agentId,'support');
 const human=assignDealAgent(manual,null,'new','Вручную',true,now);
 assert.equal(reconcileAgentAssignments([human],agents,stages,policies,{},now)[0].agentId,'');
});
test('urgent and unanswered rules use actual incoming timestamps, return to the primary after reply, and never invent timestamps',()=>{
 assert.equal(reconcileAgentAssignments([{...deal,urgent:true}],agents,stages,policies,{},now)[0].agentId,'urgent');
 const messages={d1:[{id:'m1',text:'Вопрос',direction:'incoming',sentAt:'2026-10-07T10:00:00Z'}]};
 const waiting=reconcileAgentAssignments([deal],agents,stages,policies,messages,now);
 assert.equal(waiting[0].agentId,'support');
 assert.equal(reconcileAgentAssignments(waiting,agents,stages,policies,{d1:[...messages.d1,{id:'m2',direction:'outgoing',text:'Ответ',sentAt:now}]},now)[0].agentId,'sales');
 for(const message of [{direction:'incoming',text:'Без даты'},{direction:'incoming',text:'Неверная дата',sentAt:'wrong'}])assert.equal(reconcileAgentAssignments([deal],agents,stages,policies,{d1:[message]},now)[0].agentId,'sales');
 assert.equal(reconcileAgentAssignments([deal],[],stages,policies,{},now)[0],deal);
});
