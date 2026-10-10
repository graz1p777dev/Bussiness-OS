import test from 'node:test';
import assert from 'node:assert/strict';
import {agentConfigurationHistory,readAgentConfiguration,saveAgentConfiguration,updateAgentConfigurationDocument} from '../lib/os/agent-configuration.ts';
import {nextAgentRun,configuredAgentTools,restrictAgentEntityTools} from '../lib/os/agent-workspace.ts';
import {defaultSettingsDocument,setSettingsAlias,readSettingsAlias} from '../lib/os/settings-document.ts';

const access={run:true,export:true,clients:true,analytics:true,inventory:true,tasks:true};
test('agent configuration reads legacy sources and schedules without losing saved preferences',()=>{
 const value=readAgentConfiguration({tools:'["crm.read","inventory.read"]',frequency:'weekly',schedule:'{"time":"18:30","weekday":7}',model:'Custom',provider:'OpenAI'},{prompt:'Inspect stock',status:'Активен'});
 assert.deepEqual(value,{knowledgeSpaces:[],name:'Агент',description:'',entities:['clients','analytics','inventory','tasks','web'],prompt:'Inspect stock',tools:['get_clients','get_inventory'],status:'enabled',frequency:'weekly',time:'18:30',weekday:7,model:'Custom',provider:'OpenAI'});
 assert.equal(readAgentConfiguration({schedule:'{bad',frequency:'broken'},{status:'Пауза'}).status,'disabled');
 assert.equal(readAgentConfiguration({schedule:'24:00'}).time,'09:00');
});
test('agent configuration preserves unsupported values and round trips through canonical settings',()=>{
 const previous={prompt:'Inspect stock',tools:'["get_inventory"]',temperature:'0.7',budget:'250',approval:'on',entities:['inventory']};
 const draft={...readAgentConfiguration(previous),frequency:'weekly',time:'09:30',weekday:7};
 const saved=saveAgentConfiguration(draft,previous,access);
 assert.equal(saved.temperature,'0.7');assert.equal(saved.approval,'on');assert.deepEqual(JSON.parse(saved.entities),['inventory']);assert.equal(previous.schedule,undefined);
 const document=setSettingsAlias(defaultSettingsDocument,'agent-settings',{'review-agent':saved});
 assert.deepEqual(readSettingsAlias(document,'agent-settings')['review-agent'],saved);
 const sunday=new Date('2026-10-11T08:00:00');assert.equal(new Date(nextAgentRun(saved,sunday)).getHours(),9);
 assert.equal(saveAgentConfiguration({...draft,frequency:'manual'},saved,access).schedule,'');
});
test('configuration denies new inaccessible sources but preserves or removes existing ones',()=>{
 const previous={prompt:'Inspect stock',tools:'["get_inventory"]'},draft=readAgentConfiguration(previous),limited={...access,clients:false,inventory:false};
 assert.deepEqual(JSON.parse(saveAgentConfiguration(draft,previous,limited).tools),['get_inventory']);
 assert.throws(()=>saveAgentConfiguration({...draft,tools:['get_inventory','get_clients']},previous,limited),/недоступный/);
 assert.deepEqual(JSON.parse(saveAgentConfiguration({...draft,status:'disabled',tools:[]},previous,limited).tools),[]);
 assert.throws(()=>saveAgentConfiguration({...draft,tools:['web_search']},previous,{...limited,run:false}),/недоступный/);
});
test('invalid agent configuration cannot become a runnable plan',()=>{
 const previous={prompt:'Inspect stock',tools:'["get_inventory"]'},draft=readAgentConfiguration(previous);
 for(const change of [{name:' '},{name:'x'.repeat(121)},{description:'x'.repeat(601)},{entities:['unknown']},{entities:[]},{prompt:' '},{prompt:'x'.repeat(1801)},{tools:[]},{tools:['get_inventory','get_inventory']},{tools:['unknown']},{status:'wrong'},{frequency:'hourly'},{frequency:'daily',time:'25:00'},{frequency:'weekly',weekday:0},{frequency:'weekly',weekday:1.5},{provider:'x'.repeat(121)},{model:'x'.repeat(121)}])assert.throws(()=>saveAgentConfiguration({...draft,...change},previous,access));
});
test('name, description, status and prompt update atomically without changing another agent or the original document',()=>{
 const document=structuredClone(defaultSettingsDocument),agent=document.agents.definitions[0],source=document.agents.settings[agent.id]||{},before=JSON.stringify(document);
 const draft={...readAgentConfiguration(source,{name:agent.name,prompt:agent.note,status:agent.status}),name:'  Stock desk  ',description:' Stock checks ',status:'disabled',prompt:'Verify available stock',entities:['inventory'],tools:['get_inventory']};
 const next=updateAgentConfigurationDocument(document,agent,source,draft,access,true);
 assert.equal(next.agents.definitions[0].name,'Stock desk');assert.equal(next.agents.definitions[0].status,'Пауза');assert.equal(next.agents.definitions[0].note,'Verify available stock');assert.equal(next.agents.settings[agent.id].description,'Stock checks');assert.deepEqual(configuredAgentTools(next.agents.settings[agent.id],[]),['get_inventory']);assert.deepEqual(next.agents.definitions[1],document.agents.definitions[1]);assert.equal(JSON.stringify(document),before);
 assert.throws(()=>updateAgentConfigurationDocument(document,agent,source,draft,access,false),/запрещено/);assert.equal(JSON.stringify(document),before);
 assert.throws(()=>updateAgentConfigurationDocument(next,agent,source,draft,access,true),/изменились/);
});
test('entity restrictions constrain runtime tools, deny mismatched grants and preserve legacy compatibility',()=>{
 const source={prompt:'Stock',tools:'["get_inventory"]',entities:'["inventory"]'},draft=readAgentConfiguration(source),limited={...access,clients:false};
 assert.deepEqual(configuredAgentTools({...source,tools:'["get_inventory","get_clients"]'},[]),['get_inventory']);
 assert.deepEqual(restrictAgentEntityTools({entities:'[]'},['get_inventory']),[]);
 assert.deepEqual(configuredAgentTools({entities:['crm','products'],tools:['crm.read','inventory.read']},[]),['get_clients','get_inventory']);
 assert.deepEqual(configuredAgentTools({entities:'bad'},['get_clients']),[]);
 assert.throws(()=>saveAgentConfiguration({...draft,entities:['inventory','clients'],tools:['get_inventory']},source,limited),/недоступную сущность/);
 assert.throws(()=>saveAgentConfiguration({...draft,tools:['get_clients']},source,access),/соответствующей сущности/);
 assert.deepEqual(configuredAgentTools(undefined,['get_clients','get_tasks']),['get_clients','get_tasks']);
});
test('settings journal shows only the selected agent, own actor and currently readable data',()=>{
 const rows=[{id:'own',actorId:'me',agentId:'a',tools:['get_tasks'],journal:[]},{id:'other-user',actorId:'other',agentId:'a',tools:[],journal:[]},{id:'other-agent',actorId:'me',agentId:'b',tools:[],journal:[]},{id:'private',actorId:'me',agentId:'a',tools:['get_clients'],journal:[]},{id:'cost',actorId:'me',agentId:'a',tools:['get_inventory'],finance:true,journal:[]}];
 assert.deepEqual(agentConfigurationHistory(rows,'a','me',{...access,clients:false}).map(row=>row.id),['own']);
 assert.deepEqual(agentConfigurationHistory(rows,'a','me',{...access,run:false}),[]);
});
