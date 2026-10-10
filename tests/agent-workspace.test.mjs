import test from 'node:test';
import assert from 'node:assert/strict';
import {agentRecipes,agentStartMode,appendAgentReport,buildAgentPlan,compareAgentReports,configuredAgentTools,nextAgentRun,summarizeAgentJournal} from '../lib/os/agent-workspace.ts';
import {executeAgentTool} from '../lib/os/agent-tools.ts';
import {scopeAgentContext} from '../lib/os/agent-access.ts';
const all={run:true,export:true,clients:true,analytics:true,inventory:true,tasks:true};
const onlyAnalytics={...all,clients:false,inventory:false,tasks:false};
const context={clients:[{id:'c1',name:'First',value:300,status:'Первичный контакт',channel:'WhatsApp',owner:'',note:''},{id:'c2',name:'Won',value:900,status:'Успешно',pipeline:'Успешно',channel:'Сайт',owner:'Demo',note:''}],tasks:[{id:'t1',name:'Open',status:'В работе',owner:'Demo'},{id:'t2',name:'Done',status:'Done',owner:'Demo'},{id:'t3',name:'Complete',status:'Выполнена',owner:'Demo'}],inventory:{products:[{id:'p1',name:'Low',stocks:{a:1,b:2},minimum:4,price:100,cost:50},{id:'p2',name:'Good',stocks:{a:6},minimum:4,price:100,cost:50}],warehouses:[],documents:[],sales:[{id:'s1',total:1000,refunds:100}],shifts:[]}};
const report=(id,extra={})=>({id,actorId:'owner-user',tools:['get_analytics'],status:'Завершён',task:'Test',time:'2026-10-10',journal:[{tool:'get_analytics',input:{},output:{}}],metrics:[{id:'revenue',label:'Revenue',value:10,unit:'money',source:'get_analytics'}],...extra});

test('planning rejects hidden tools, duplicate grants, unavailable network and empty tasks before execution',()=>{
 for(const tools of [['get_clients'],['get_inventory'],['unknown'],['get_analytics','get_analytics'],['web_search']])assert.throws(()=>buildAgentPlan('Test',tools,onlyAnalytics,'local'));
 assert.throws(()=>buildAgentPlan('Test',['get_analytics'],{...all,run:false},'local'));
 assert.throws(()=>buildAgentPlan('  ',['get_tasks'],all,'local'));
 assert.throws(()=>buildAgentPlan('Test',[],all,'local'));
 assert.throws(()=>buildAgentPlan('a'.repeat(6001),['get_tasks'],all,'local'));
 const plan=buildAgentPlan('Test',['get_analytics'],onlyAnalytics,'local');assert.deepEqual(plan.map(step=>step.id),['plan','get_analytics','report','save']);
 assert.equal(buildAgentPlan('Test',['web_search'],all,'model',true)[1].tool,'web_search');
});
test('all board scenarios execute actual scoped tools without modifying the workspace',()=>{
 const original=structuredClone(context);
 for(const recipe of agentRecipes){const scoped=scopeAgentContext(context,recipe.tools,all),journal=recipe.tools.map(tool=>({tool,input:{},output:executeAgentTool(tool,{},scoped)}));const result=summarizeAgentJournal(journal);assert.ok(result.text);assert.ok(result.metrics.length,recipe.name)}
 assert.deepEqual(context,original);
 const scoped=scopeAgentContext(context,['get_analytics'],onlyAnalytics),result=summarizeAgentJournal([{tool:'get_analytics',input:{},output:executeAgentTool('get_analytics',{},scoped)}]);assert.equal(result.metrics.find(metric=>metric.id==='revenue').value,900);assert.doesNotMatch(JSON.stringify(result),/"First"|"Won"|"Low"|"Good"/);
});
test('local reports count current stock, open tasks and missing assignees using observed results only',()=>{
 const journal=['get_clients','get_inventory','get_tasks'].map(tool=>({tool,input:{},output:executeAgentTool(tool,{},context)})),result=summarizeAgentJournal(journal);
 const values=Object.fromEntries(result.metrics.map(metric=>[metric.id,metric.value]));assert.deepEqual(values,{early:1,unassigned:1,lowStock:1,products:2,openTasks:1});assert.equal(result.metrics.some(metric=>metric.id==='revenue'),false);
 const failed=summarizeAgentJournal([{tool:'get_inventory',input:{},output:{error:'Denied'}}]);assert.deepEqual(failed.metrics,[]);
 const latest=summarizeAgentJournal([{tool:'get_tasks',input:{},output:[]},...journal]);assert.equal(latest.metrics.find(metric=>metric.id==='openTasks').value,1);
});
test('comparison rechecks actor and permissions, filters failed runs and aligns only comparable sources',()=>{
 const first=report('one'),second=report('two',{metrics:[{...first.metrics[0],value:17}]});assert.equal(compareAgentReports(first,second,'owner-user',all)[0].delta,7);
 assert.throws(()=>compareAgentReports(first,second,'other',all));assert.throws(()=>compareAgentReports(first,second,'owner-user',{...all,analytics:false}));assert.throws(()=>compareAgentReports(first,{...second,status:'Ошибка'},'owner-user',all));assert.throws(()=>compareAgentReports(first,first,'owner-user',all));
 assert.deepEqual(compareAgentReports(first,{...second,metrics:[{...second.metrics[0],source:'get_inventory'}]},'owner-user',all),[]);
 const clients=report('clients',{tools:['get_clients'],journal:[{tool:'get_clients',input:{query:'A'},output:[]}],metrics:[{id:'early',label:'Early',value:3,unit:'number',source:'get_clients'}]});assert.deepEqual(compareAgentReports(clients,{...clients,id:'different-filter',journal:[{tool:'get_clients',input:{query:'B'},output:[]}]},'owner-user',all),[]);
});
test('schedule preview handles daily and weekly boundaries without pretending a background execution exists',()=>{
 const noon=new Date(2026,9,10,12,0),daily=nextAgentRun({frequency:'daily',schedule:'09:30'},noon);assert.equal(new Date(daily).getDate(),11);assert.equal(new Date(daily).getHours(),9);
 const weekly=nextAgentRun({frequency:'weekly',schedule:JSON.stringify({time:'12:00',weekday:noon.getDay()||7})},noon);assert.equal(new Date(weekly).getDate(),17);
 for(const settings of [{frequency:'manual',schedule:'12:00'},{frequency:'weekly',schedule:'{"time":"12:00","weekday":8}'},{frequency:'daily',schedule:'25:00'},{frequency:'daily',schedule:'12:00',status:'disabled'}])assert.equal(nextAgentRun(settings,noon),null);
 assert.equal(nextAgentRun({frequency:'daily',schedule:'12:00'},new Date('invalid')),null);
});
test('canonical tool selections support old strings, arrays and Store scopes without granting unknown tools',()=>{
 assert.deepEqual(configuredAgentTools(undefined,['get_tasks']),['get_tasks']);assert.deepEqual(configuredAgentTools({tools:''},['get_tasks']),[]);
 assert.deepEqual(configuredAgentTools({tools:'crm.read\nget_tasks\nunknown\ncrm.read'},[]),['get_clients','get_tasks']);assert.deepEqual(configuredAgentTools({tools:'["get_inventory","web.search"]'},[]),['get_inventory','web_search']);assert.deepEqual(configuredAgentTools({tools:['get_tasks','unknown']},[]),['get_tasks']);
});
test('report retention replaces duplicate IDs and never evicts another actor history',()=>{
 const others=Array.from({length:110},(_,i)=>report('other-'+i,{actorId:'other'})),own=Array.from({length:105},(_,i)=>report('own-'+i)),next=report('own-0',{text:'Updated'}),result=appendAgentReport([...others,...own],next);
 assert.equal(result.filter(row=>row.actorId==='owner-user').length,100);assert.equal(result.filter(row=>row.actorId==='other').length,110);assert.equal(result[0].text,'Updated');assert.equal(result.filter(row=>row.id==='own-0').length,1);assert.equal(others.length,110);
});


test('web-only agents can start in model mode only when the actual provider supports search',()=>{
 assert.equal(agentStartMode(['web_search'],all,{configured:true,webSearch:true}),'model');assert.equal(agentStartMode(['web_search'],all,{configured:false,webSearch:true}),null);assert.equal(agentStartMode(['web_search'],all,{configured:true,webSearch:false}),null);assert.equal(agentStartMode(['web_search'],{...all,run:false},{configured:true,webSearch:true}),null);assert.equal(agentStartMode(['get_tasks','web_search'],all,{configured:true,webSearch:true}),'local');
});
test('comparison uses exact executed filters and the last successful tool provenance',()=>{
 const metric={id:'early',label:'Early',value:1,unit:'number',source:'get_clients'},base=report('a',{tools:['get_clients'],journal:[{tool:'get_clients',input:{query:'Alice'},output:[{name:'Alice'}]}],metrics:[metric]});
 const spaces=report('b',{tools:['get_clients'],journal:[{tool:'get_clients',input:{query:' Alice '},output:[]}],metrics:[{...metric,value:0}]});assert.deepEqual(compareAgentReports(base,spaces,'owner-user',all),[]);
 const retry={...spaces,id:'retry',journal:[...base.journal,{tool:'get_clients',input:{query:'Bob'},output:{error:'Failed'}}],metrics:[metric]};assert.equal(compareAgentReports(base,retry,'owner-user',all)[0].delta,0);
 const caseOnly={...base,id:'case',journal:[{tool:'get_clients',input:{query:'ALICE'},output:[{name:'Alice'}]}]};assert.equal(compareAgentReports(base,caseOnly,'owner-user',all).length,1);
});

test('execution chain shows the latest tool failure and a successful retry distinctly',async()=>{const {agentToolStatus}=await import('../lib/os/agent-workspace.ts');const first={tool:'get_clients',input:{},output:[]},failed={...first,output:{error:'Unavailable'}};assert.equal(agentToolStatus([],'get_clients'),'pending');assert.equal(agentToolStatus([first,failed],'get_clients'),'error');assert.equal(agentToolStatus([failed,first],'get_clients'),'complete')});
