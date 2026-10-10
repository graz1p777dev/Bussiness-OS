import test from 'node:test';
import assert from 'node:assert/strict';
import {extensionCatalog,extensionPermissions,extensionWorkspaceDefaults,initialExtensionsState,parseExtensionsState,planExtensionInstall,planExtensionRemoval,commitExtensionPlan,developerEligibility,saveDeveloperProfile,saveExtensionDraft,transitionPublication,packagesForState} from '../lib/os/extensions.ts';
import {defaultSettingsDocument,getSettingsDocument} from '../lib/os/settings-document.ts';
import {settingsStorage,readStoredValue} from '../lib/os/storage.ts';
import {parseWorkflowImport} from '../lib/os/workflow-schema.ts';
import {validateWorkflow} from '../lib/os/workflow-validation.ts';
const now='2026-10-07T12:00:00.000Z',actor='owner-user';
const access={create:true,edit:true,remove:true,review:true,scopes:Object.keys(extensionPermissions)};
const fresh=()=>structuredClone(initialExtensionsState);
const source=()=>structuredClone({...extensionWorkspaceDefaults,'appearance-v2':defaultSettingsDocument.appearance.preferences,'analytics-boards-v2':{Existing:['revenue']},'business-modules-v1':{automations:[],finance:[{id:'keep',name:'Keep'}]}});
const pkg=id=>extensionCatalog.find(item=>item.id===id);
const install=(id,version='1.0.0',state=fresh(),workspace=source(),rights=access,grants=pkg(id).required)=>planExtensionInstall(state,pkg(id),version,grants,actor,now,rights,workspace);
const merged=(workspace,plan)=>({...workspace,...plan.workspace});
const profile={displayName:'Мастерская',accountCreatedAt:'2026-09-20',identity:'declared',subscription:'active',agreement:true};
const draft=(id='one')=>({id,packageId:'community:'+actor+':test',actorId:actor,basePackageId:'sales-concierge',name:'Мой агент',description:'Помогает проверить следующий шаг',version:'1.0.0',body:'Уточняй задачу. Покажи источники и предложи ответ.',accentDark:'#a78bfa',accentLight:'#7763c6',status:'draft',createdAt:now,updatedAt:now,reviewNote:''});
const memory=(data={})=>{const rows=new Map(Object.entries(data));return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows}};

test('all eight categories produce working resources and remove without losing workspace data',()=>{
 assert.equal(new Set(extensionCatalog.map(item=>item.category)).size,8);
 for(const pack of extensionCatalog){const workspace=source(),plan=install(pack.id);assert.ok(plan.state.installs[0].effects.length,pack.id);assert.ok(Object.keys(plan.workspace).length,pack.id);const removed=planExtensionRemoval(plan.state,pack.id,actor,now,access,merged(workspace,plan));assert.deepEqual(merged(merged(workspace,plan),removed),workspace,pack.id);assert.equal(removed.state.installs.length,0);}
});
test('installed graph snapshots import and validate in Agent Builder',()=>{
 for(const id of ['gentle-followup','request-summary','retail-kit']){const plan=install(id),snapshot=plan.workspace['workflow-library-v1'][0];assert.equal(parseWorkflowImport(snapshot).nodes.length,snapshot.nodes.length);assert.deepEqual(validateWorkflow(snapshot.nodes,snapshot.edges),[]);assert.equal(plan.workspace['business-modules-v1'].automations[0].workflowId,snapshot.id);assert.equal(plan.workspace['business-modules-v1'].finance[0].id,'keep');}
});
test('optional capabilities create only explicitly granted resources',()=>{
 const basic=install('retail-kit');assert.equal(basic.workspace['reply-templates-v1'],undefined);
 const extra=install('retail-kit','1.0.0',fresh(),source(),access,[...pkg('retail-kit').required,'replyTemplates.write']);assert.equal(extra.workspace['reply-templates-v1'].length,extensionWorkspaceDefaults['reply-templates-v1'].length+3);
 const agent=install('sales-concierge','1.0.0',fresh(),source(),access,['agents.configure','crm.read']);assert.equal(agent.workspace['agent-settings']['ext:sales-concierge:agent'].tools,'crm.read');assert.equal(agent.workspace.agents.at(-1).status,'Пауза');
});
test('install/update/remove enforce both Store and target scopes',()=>{
 assert.throws(()=>install('sales-concierge','1.0.0',fresh(),source(),{...access,create:false}),/запрещено/);
 assert.throws(()=>install('sales-concierge','1.0.0',fresh(),source(),{...access,scopes:[]}),/разрешение/);
 assert.throws(()=>install('sales-concierge','1.0.0',fresh(),source(),access,[]),/обязательные/);
 assert.throws(()=>install('sales-concierge','1.0.0',fresh(),source(),access,['agents.configure','appearance.configure']),/разрешение/);
 const first=install('sales-concierge'),workspace=merged(source(),first);
 assert.throws(()=>install('sales-concierge','1.1.0',first.state,workspace,{...access,edit:false}),/запрещено/);
 assert.throws(()=>install('sales-concierge','1.1.0',first.state,workspace,{...access,scopes:[]}),/обновление/);
 assert.throws(()=>planExtensionRemoval(first.state,'sales-concierge',actor,now,{...access,remove:false},workspace),/запрещено/);
 assert.throws(()=>planExtensionRemoval(first.state,'sales-concierge',actor,now,{...access,scopes:[]},workspace),/прав/);
});
test('versions update created records once and reject downgrades or resource collisions',()=>{
 const first=install('sales-concierge'),workspace=merged(source(),first),next=install('sales-concierge','1.1.0',first.state,workspace);
 assert.equal(next.state.installs[0].version,'1.1.0');assert.equal(next.workspace.agents.filter(row=>row.id==='ext:sales-concierge:agent').length,1);
 assert.throws(()=>install('sales-concierge','1.0.0',next.state,merged(workspace,next)),/более новая/);
 const collision=source();collision['channel-config-v2'].Telegram={enabled:false,values:{username:'mine'},events:[],updated:now};assert.throws(()=>install('telegram-starter','1.0.0',fresh(),collision),/уже существует/);
});
test('manual changes survive removal and block destructive updates',()=>{
 const workspace=source(),first=install('sales-concierge'),current=merged(workspace,first);current.agents=current.agents.map(row=>row.id==='ext:sales-concierge:agent'?{...row,name:'Мой вариант'}:row);
 assert.throws(()=>install('sales-concierge','1.1.0',first.state,current),/изменили ресурс/);
 const removed=planExtensionRemoval(first.state,'sales-concierge',actor,now,access,current);assert.equal(removed.warnings.length,2);assert.equal(merged(current,removed).agents.at(-1).name,'Мой вариант');assert.ok(merged(current,removed)['agent-settings']['ext:sales-concierge:agent']);
 const theme=install('sage'),appearance=merged(source(),theme);appearance['appearance-v2'].fontSize=18;const removedTheme=planExtensionRemoval(theme.state,'sage',actor,now,access,appearance);assert.equal(removedTheme.workspace['appearance-v2'],undefined);assert.equal(appearance['appearance-v2'].fontSize,18);
});
test('theme installation keeps readability settings and removal restores previous colors',()=>{
 const workspace=source();workspace['appearance-v2'].lowPower=true;workspace['appearance-v2'].fontSize=17;const first=install('sage','1.0.0',fresh(),workspace);
 assert.equal(first.workspace['appearance-v2'].lowPower,true);assert.equal(first.workspace['appearance-v2'].fontSize,17);assert.equal(first.workspace['appearance-v2'].palettes.dark.accent,'#81b29a');
 const removed=planExtensionRemoval(first.state,'sage',actor,now,access,merged(workspace,first));assert.deepEqual(removed.workspace['appearance-v2'],workspace['appearance-v2']);
});
test('strict parser rejects hidden fields, unsafe effect payloads and ungranted effects',()=>{
 for(const mutate of [s=>{s.extra='hidden'},s=>{s.installs[0].admin=true},s=>{s.installs[0].effects[0].after.secret='hidden'},s=>{s.installs[0].effects[0].slot='owner-user'},s=>{s.installs[0].effects[0].before={id:'old',name:'Overwrite'}},s=>{s.installs[0].grants=[]},s=>{s.developers[actor]={...profile,privateKey:'hidden'}}]){const value=install('sales-concierge').state;mutate(value);assert.throws(()=>parseExtensionsState(value));}
 const prototype=JSON.parse('{"version":1,"installs":[],"publications":[],"developers":{},"events":[],"__proto__":{"admin":true}}');assert.throws(()=>parseExtensionsState(prototype));assert.equal({}.admin,undefined);
});
test('commit rolls back earlier writes if a later storage write fails',()=>{
 const base=source(),stored=memory(Object.fromEntries(Object.entries(base).map(([key,value])=>['life-'+key,JSON.stringify(value)]))),before=Object.fromEntries(stored.rows);let failed=false;
 const broken={...stored,setItem:(key,value)=>{if(key==='life-extension-store-v1'&&!failed){failed=true;throw new Error('quota')}stored.setItem(key,value)}};
 assert.throws(()=>commitExtensionPlan(broken,install('retail-kit')),/quota/);assert.deepEqual(Object.fromEntries(stored.rows),before);
});
test('canonical adapter persists real resources and manifests together',()=>{
 const store=memory(),document=getSettingsDocument(store),workspace=source();workspace.agents=document.agents.definitions;workspace['agent-settings']=document.agents.settings;const plan=install('sales-concierge','1.0.0',fresh(),workspace);
 commitExtensionPlan(settingsStorage(store),plan);assert.equal(readStoredValue('extension-store-v1',{},store).installs.length,1);assert.equal(readStoredValue('agents',[],store).at(-1).id,'ext:sales-concierge:agent');assert.equal(store.getItem('life-agents'),null);
});
test('developer profile eligibility checks all five conditions and seven-day boundary',()=>{
 assert.ok(developerEligibility(profile,now).every(row=>row.ok));assert.equal(developerEligibility({...profile,accountCreatedAt:'2026-10-01'},now).find(row=>row.id==='age').ok,false);assert.equal(developerEligibility({...profile,accountCreatedAt:'2026-09-30T12:00:00.000Z'},now).find(row=>row.id==='age').ok,true);
 assert.equal(developerEligibility(undefined,now).filter(row=>row.ok).length,0);assert.throws(()=>saveDeveloperProfile(fresh(),actor,{...profile,accountCreatedAt:'2027-01-01'},now,access),/прошлом/);
});
test('publishing is staged, local and requires reviewer privileges',()=>{
 let state=saveDeveloperProfile(fresh(),actor,profile,now,access);state=saveExtensionDraft(state,draft(),actor,now,access);assert.equal(state.publications[0].status,'draft');assert.equal(packagesForState(state).length,extensionCatalog.length);
 assert.throws(()=>transitionPublication(state,'one','publish',actor,now,access),/проверку/);
 state=transitionPublication(state,'one','submit',actor,now,access);assert.throws(()=>transitionPublication(state,'one','review',actor,now,{...access,review:false}),/запрещено/);
 state=transitionPublication(state,'one','review',actor,now,access);state=transitionPublication(state,'one','security',actor,now,access);state=transitionPublication(state,'one','publish',actor,now,access);
 assert.equal(state.publications[0].status,'published');const custom=packagesForState(state).at(-1);assert.equal(custom.author,profile.displayName);assert.equal(custom.publisherId,actor);assert.equal(custom.id,draft().packageId);
 const plan=planExtensionInstall(state,custom,'1.0.0',custom.required,actor,now,access,source());assert.equal(plan.workspace['agent-settings']['ext:'+custom.id+':agent'].prompt,draft().body);
 state=transitionPublication(plan.state,'one','withdraw',actor,now,access);assert.equal(packagesForState(state).some(item=>item.id===custom.id),false);assert.equal(state.installs.length,1);
 assert.throws(()=>saveExtensionDraft(state,draft(),actor,now,access),/новую версию/);
});
test('developer cannot submit without eligibility or spoof other author and built-in IDs',()=>{
 let state=saveExtensionDraft(fresh(),draft(),actor,now,access);assert.throws(()=>transitionPublication(state,'one','submit',actor,now,access),/условия/);
 assert.throws(()=>saveExtensionDraft(state,{...draft('two'),actorId:'someone'},actor,now,access),/Автор/);
 assert.throws(()=>saveExtensionDraft(state,{...draft('two'),packageId:'sales-concierge'},actor,now,access),/идентификатор/);
 assert.throws(()=>saveExtensionDraft(state,{...draft('two'),basePackageId:'graphite'},actor,now,access),/основу/);
 assert.throws(()=>saveExtensionDraft(state,draft('two'),actor,now,access),/версия/);
});
test('script-like publication content fails local security check and can be returned for edits',()=>{
 let state=saveDeveloperProfile(fresh(),actor,profile,now,access);state=saveExtensionDraft(state,{...draft(),body:'<script>bad()</script>'},actor,now,access);state=transitionPublication(state,'one','submit',actor,now,access);state=transitionPublication(state,'one','review',actor,now,access);
 assert.throws(()=>transitionPublication(state,'one','security',actor,now,access),/Исполняемый код/);assert.throws(()=>transitionPublication(state,'one','return',actor,now,access),/что нужно/);
 state=transitionPublication(state,'one','return',actor,now,access,'Оставьте только инструкции');assert.equal(state.publications[0].status,'changes-requested');state=saveExtensionDraft(state,draft(),actor,now,access);assert.equal(state.publications[0].status,'draft');
});

test('canonical schema key ordering never looks like a user edit during update or removal',()=>{
 const store=memory();getSettingsDocument(store);const defaults=source(),workspace=()=>Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,readStoredValue(key,fallback,store)]));
 const before=workspace(),first=install('sales-concierge','1.0.0',fresh(),before,access,['agents.configure','crm.read']);commitExtensionPlan(settingsStorage(store),first);
 const current=parseExtensionsState(readStoredValue('extension-store-v1',{},store));
 const updated=install('sales-concierge','1.1.0',current,workspace(),access,current.installs[0].grants);commitExtensionPlan(settingsStorage(store),updated);
 assert.equal(readStoredValue('extension-store-v1',{},store).installs[0].version,'1.1.0');
 const removed=planExtensionRemoval(readStoredValue('extension-store-v1',{},store),'sales-concierge',actor,now,access,workspace());assert.deepEqual(removed.warnings,[]);commitExtensionPlan(settingsStorage(store),removed);
 assert.deepEqual(workspace(),before);
});

test('legacy installed themes accept added default font but preserve a manually selected font',()=>{
 const workspace=source();delete workspace['appearance-v2'].fontFamily;
 const first=install('sage','1.0.0',fresh(),workspace),current=merged(workspace,first);current['appearance-v2'].fontFamily='system';
 const removed=planExtensionRemoval(first.state,'sage',actor,now,access,current);
 assert.deepEqual(removed.warnings,[]);assert.ok(removed.workspace['appearance-v2']);
 current['appearance-v2'].fontFamily='humanist';
 const edited=planExtensionRemoval(first.state,'sage',actor,now,access,current);
 assert.equal(edited.workspace['appearance-v2'],undefined);assert.ok(edited.warnings.length);
});
