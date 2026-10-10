import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettingsDocument,settingsAliases,settingsDocumentKey,validateSettingsDocument,getSettingsDocument,readSettingsAlias,setSettingsAlias,parseSettingsImport,resetSettingsBranches,settingsAccess,authorizeSettingsChange,exportSettingsDocument,writeSettingsDocument} from '../lib/os/settings-document.ts';
import {readStoredValue,writeStoredValue,settingsStorage} from '../lib/os/storage.ts';
import {initialRoles,initialEmployees} from '../lib/os/team.ts';
import {planBusinessBlueprint} from '../lib/os/business-blueprint.ts';
const fresh=()=>structuredClone(defaultSettingsDocument);
const memory=(data={})=>{const rows=new Map(Object.entries(data));return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)}};
const owner=settingsAccess(initialEmployees[0],initialRoles);

test('live analytics layouts migrate through the canonical document and old documents gain an empty default',()=>{
 const old=fresh();delete old.business.liveAnalytics;
 assert.deepEqual(validateSettingsDocument(old).business.liveAnalytics,{});
 const layout={owner:[{id:'revenue',title:'Чеки',metric:'sales',kind:'metric',group:'none'}]},storage=memory({'life-analytics-live-v1':JSON.stringify(layout)});
 assert.deepEqual(readStoredValue('analytics-live-v1',{},storage),layout);
 assert.deepEqual(getSettingsDocument(storage).business.liveAnalytics,layout);
 assert.throws(()=>setSettingsAlias(getSettingsDocument(storage),'analytics-live-v1',{owner:[{...layout.owner[0],metric:'invented-profit'}]}));
 settingsStorage(storage).removeItem('life-analytics-live-v1');assert.deepEqual(readStoredValue('analytics-live-v1',{},storage),{});
});

test('default document and every alias round trip against the strict schema',()=>{
 const document=validateSettingsDocument(fresh());assert.equal(document.schemaVersion,1);
 for(const key of [...Object.keys(settingsAliases),'settings-deep-v2','inventory-company-v3','workspace'])assert.deepEqual(setSettingsAlias(document,key,readSettingsAlias(document,key)),document,key);
});
test('migration unifies company aliases, preserves business rows and keeps legacy backup',()=>{
 const legacy={'life-settings-deep-v2':JSON.stringify({company:'Старое имя',phone:'+996555123123',maxDiscount:17}),'life-workspace':JSON.stringify('Новая компания'),'life-inventory-company-v3':JSON.stringify({director:'Директор',currency:'USD'}),'life-theme':JSON.stringify('Light'),'life-deals':JSON.stringify([{id:'untouched',name:'Клиент'}])};
 const storage=memory(legacy),document=getSettingsDocument(storage);
 assert.equal(document.appearance.theme,'Light');assert.equal(document.business.company.company,'Новая компания');assert.equal(document.business.company.director,'Директор');assert.equal(document.business.checkout.maxDiscount,17);
 for(const [key,value] of Object.entries(legacy))assert.equal(storage.getItem(key),value);
 writeStoredValue('inventory-company-v3',{...readStoredValue('inventory-company-v3',{},storage),name:'Общее имя'},storage);
 assert.equal(readStoredValue('workspace','',storage),'Общее имя');assert.equal(readStoredValue('settings-deep-v2',{},storage).company,'Общее имя');
 writeStoredValue('settings-deep-v2',{...readStoredValue('settings-deep-v2',{},storage),company:'Общее имя 2'},storage);
 assert.equal(readStoredValue('inventory-company-v3',{},storage).name,'Общее имя 2');assert.equal(storage.getItem('life-workspace'),legacy['life-workspace']);
});
test('reset and removal never resurrect stale aliases; wrapper rollback keeps same canonical source',()=>{
 const storage=memory({'life-theme':'"Light"'}),wrapper=settingsStorage(storage);getSettingsDocument(storage);
 const snapshot=wrapper.getItem('life-theme');wrapper.setItem('life-theme','"System"');assert.equal(getSettingsDocument(storage).appearance.theme,'System');wrapper.setItem('life-theme',snapshot);assert.equal(getSettingsDocument(storage).appearance.theme,'Light');
 wrapper.removeItem('life-theme');assert.equal(readStoredValue('theme','System',storage),'Dark');assert.equal(storage.getItem('life-theme'),'"Light"');
 const reset=resetSettingsBranches(setSettingsAlias(getSettingsDocument(storage),'accent','Rose'),['appearance']);writeSettingsDocument(reset,owner,storage);assert.equal(getSettingsDocument(storage).appearance.accent,'Violet');
 wrapper.setItem('life-deals','[{"id":"keep"}]');assert.equal(storage.getItem('life-deals'),'[{"id":"keep"}]');
});
test('malformed imports, unknown fields, invalid enums, prototypes and secrets fail atomically',()=>{
 const storage=memory(),before=getSettingsDocument(storage),raw=storage.getItem(settingsDocumentKey);
 const invalid=[{schemaVersion:1,appearance:before.appearance},{...fresh(),schemaVersion:2},{...fresh(),unknown:true}];
 const badRole=fresh();badRole.permissions.roles[0].actions.push('administrator');invalid.push(badRole);
 const badPage=fresh();badPage.permissions.roles[0].pages.push('unknown-page');invalid.push(badPage);
 const badValue=fresh();badValue.business.checkout.maxDiscount=120;invalid.push(badValue);
 const secret=fresh();secret.integrations.channels.OpenAI={enabled:true,values:{key:'hidden'},events:[],updated:''};invalid.push(secret);
 const url=fresh();url.system.ai.endpoint='https://user:password@example.com';invalid.push(url);
 const token=fresh();token.system.ai.instructions='sk-proj-123456789012345678901234567890';invalid.push(token);
 const proto=JSON.parse(JSON.stringify(fresh()).replace('"schemaVersion":1','"schemaVersion":1,"__proto__":{"polluted":true}'));invalid.push(proto);
 for(const value of invalid){assert.throws(()=>writeSettingsDocument(parseSettingsImport(value,before),owner,storage));assert.equal(storage.getItem(settingsDocumentKey),raw)}
 assert.equal({}.polluted,undefined);
});
test('permissions export masking and import rights prevent settings-edit escalation',()=>{
 const role={id:'limited',name:'Оператор настроек',pages:['settings','agents','mcp','store'],actions:['edit','export']},employee={...initialEmployees[1],role:'limited'},access=settingsAccess(employee,[...initialRoles,role]);
 const document=fresh(),exported=exportSettingsDocument(document,access);assert.equal(exported.kind,'settings-export');assert.equal(exported.branches.permissions,undefined);assert.ok(exported.branches.appearance);
 const rights=fresh();rights.permissions.roles[1].actions.push('production');assert.throws(()=>authorizeSettingsChange(document,rights,access),/Недостаточно прав/);
 const server=fresh();server.system.engineer.mode='emergency';assert.throws(()=>authorizeSettingsChange(document,server,access),/Недостаточно прав/);
 const approval=fresh();approval.system.ai.approval=false;assert.throws(()=>authorizeSettingsChange(document,approval,access),/production/);
 const mcp=fresh();mcp.mcp.connection.clients.push({id:'test',name:'Test',enabled:true,credential:'demo-mcp-12345678-abcd',tools:['get_employees']});assert.throws(()=>authorizeSettingsChange(document,mcp,access),/инструменту/);
 assert.doesNotThrow(()=>authorizeSettingsChange(document,setSettingsAlias(document,'theme','Light'),access));
 const readOnly=settingsAccess(employee,[...initialRoles,{...role,actions:['export']}],false);assert.throws(()=>authorizeSettingsChange(document,setSettingsAlias(document,'theme','Light'),readOnly));
});
test('complete restricted branch exports import without replacing omitted branches',()=>{
 const current=setSettingsAlias(fresh(),'workspace','Моя компания'),appearance={...current.appearance,theme:'Light'};
 const next=parseSettingsImport({schemaVersion:1,kind:'settings-export',branches:{appearance}},current);assert.equal(next.appearance.theme,'Light');assert.equal(next.business.company.company,'Моя компания');
 assert.throws(()=>parseSettingsImport({schemaVersion:1,kind:'settings-export',branches:{appearance:{theme:'Light'}}},current));assert.throws(()=>parseSettingsImport({schemaVersion:1,kind:'settings-export',branches:{deals:[]}},current));
});
test('all existing editor mutations stay compatible with canonical storage',()=>{
 let document=fresh();document=setSettingsAlias(document,'agent-settings',{'agent-demo':{prompt:'Тест',temperature:'0.4',tokens:'4096',tools:'get_clients',storePermissions:'crm.read'}});
 document=setSettingsAlias(document,'nodes',[{id:'demo-node',type:'agent',position:{x:10,y:10},data:{kind:'AI Agent',description:'Инструкция',steps:'8',tool:'get_clients'},measured:{width:250,height:80}}]);
 document=setSettingsAlias(document,'bot-config-v2',{...readSettingsAlias(document,'bot-config-v2'),strictTraining:true});document=setSettingsAlias(document,'bot-policy-v1',{...readSettingsAlias(document,'bot-policy-v1'),onReviewError:'draft',onRisk:'hold'});
 document=setSettingsAlias(document,'channel-config-v2',{Telegram:{enabled:true,values:{routing:'AI с подтверждением',owner:'aiym',retry:'3',hours:'09:00–18:00'},events:['Входящие сообщения'],updated:'2026-10-07T12:00:00.000Z'}});
 assert.equal(document.ai.bot.strictTraining,true);assert.equal(document.agents.nodes[0].data.steps,'8');
});
test('migration strips legacy secrets but retains other integration settings and audit backup',()=>{
 const legacy=JSON.stringify({Telegram:{enabled:true,values:{token:'old-secret',username:'@demo',routing:'Оператор'},events:[],updated:''},OpenAI:{enabled:false,values:{key:'old-provider-secret',project:'demo-project'},events:[],updated:''}}),storage=memory({'life-channel-config-v2':legacy});
 const document=getSettingsDocument(storage);assert.equal(document.integrations.channels.Telegram.values.username,'@demo');assert.equal(document.integrations.channels.Telegram.values.token,undefined);assert.equal(document.integrations.channels.OpenAI.values.key,undefined);assert.equal(document.integrations.channels.OpenAI.values.project,'demo-project');assert.equal(storage.getItem('life-channel-config-v2'),legacy);assert.ok(!storage.getItem(settingsDocumentKey).includes('old-secret'));
});
test('business blueprint plans can apply via config wrapper without changing canonical schema',()=>{
 const storage=memory(),document=getSettingsDocument(storage),defaults={stages:document.crm.stages,settings:readSettingsAlias(document,'settings-deep-v2'),boards:document.business.analyticsBoards,business:{automations:[]}};
 const plan=planBusinessBlueprint(settingsStorage(storage),{workspace:'Тест',text:'Сфера: Магазин и онлайн-продажи\nКоманда: 3 сотрудника\nКаналы: WhatsApp, Сайт',approved:[true,true,true,true,true,true,true,true],defaults,now:'2026-10-07T00:00:00.000Z'});
 for(const [key,value] of Object.entries(plan))settingsStorage(storage).setItem(key,JSON.stringify(value));
 assert.equal(validateSettingsDocument(getSettingsDocument(storage)).schemaVersion,1);
});

test('per-page action overrides survive migration and cannot contain unknown privileges',()=>{
 const document=fresh();document.permissions.roles[1].pageActions={crm:[],tasks:['create']};
 const migrated=getSettingsDocument(memory({'life-team-roles-v3':JSON.stringify(document.permissions.roles)}));assert.deepEqual(migrated.permissions.roles[1].pageActions,{crm:[],tasks:['create']});
 const access=settingsAccess({...initialEmployees[1],role:'manager'},migrated.permissions.roles);assert.equal(access.canGrant('crm.read'),true);assert.equal(access.canGrant('replyTemplates.write'),true);
 document.permissions.roles[1].pageActions={crm:['production-admin']};assert.throws(()=>validateSettingsDocument(document));
 document.permissions.roles[1].pageActions={unknown:[]};assert.throws(()=>validateSettingsDocument(document));
});

test('every Store catalog package installs and removes through the canonical adapter',async()=>{
 const {extensionCatalog,extensionPermissions,initialExtensionsState,planExtensionInstall,planExtensionRemoval,commitExtensionPlan}=await import('../lib/os/extensions.ts');
 const rights={create:true,edit:true,remove:true,review:true,scopes:Object.keys(extensionPermissions)},now='2026-10-07T12:00:00.000Z';
 for(const pkg of extensionCatalog){
  const storage=memory({'life-business-modules-v1':JSON.stringify({automations:[]})}),document=getSettingsDocument(storage),source=Object.fromEntries(Object.keys(settingsAliases).map(key=>[key,readSettingsAlias(document,key)]));source['business-modules-v1']={automations:[]};source['documents-explorer-v1']=[];
  const before=storage.getItem(settingsDocumentKey),plan=planExtensionInstall(initialExtensionsState,pkg,pkg.version,pkg.required,'owner-user',now,rights,source);
  commitExtensionPlan(settingsStorage(storage),plan);const installed=getSettingsDocument(storage);assert.equal(installed.store.extensions.installs[0].packageId,pkg.id);
  const removed=planExtensionRemoval(plan.state,pkg.id,'owner-user',now,rights,{...source,...plan.workspace});commitExtensionPlan(settingsStorage(storage),removed);
  const restored=getSettingsDocument(storage);restored.store.extensions.events=[];assert.deepEqual(restored,JSON.parse(before),pkg.id);
 }
});

test('Store approvals cannot be imported with ordinary settings or Store edit rights',()=>{
 const role={id:'store-editor',name:'Редактор Store',pages:['settings','store'],actions:['edit','export']},employee={...initialEmployees[1],role:role.id},access=settingsAccess(employee,[...initialRoles,role]);
 const before=fresh(),after=fresh(),at='2026-10-07T00:00:00.000Z';after.store.extensions.publications.push({id:'pub1',packageId:'community:owner-user:demo',actorId:'owner-user',basePackageId:'sales-concierge',name:'Demo',description:'Demo',version:'1.0.0',body:'Demo',accentDark:'#000000',accentLight:'#ffffff',status:'published',createdAt:at,updatedAt:at,reviewNote:'Проверено локально',securityCheckedAt:at,publishedAt:at});
 validateSettingsDocument(after);assert.throws(()=>authorizeSettingsChange(before,after,access),/Модерация Store/);assert.doesNotThrow(()=>authorizeSettingsChange(before,after,owner));
 const undo=fresh();assert.throws(()=>authorizeSettingsChange(after,undo,access),/Модерация Store/);
});
test('legacy invalid role capabilities are removed without restoring broader owner defaults',()=>{
 const roles=[{id:'owner',name:'Владелец',pages:['settings','removed-route'],actions:['export','removed-action'],pageActions:{settings:[],unknown:['edit']}}],storage=memory({'life-team-roles-v3':JSON.stringify(roles)});
 const migrated=getSettingsDocument(storage);assert.deepEqual(migrated.permissions.roles,[{id:'owner',name:'Владелец',pages:['settings'],actions:['export'],pageActions:{settings:[]}}]);
 const broken=getSettingsDocument(memory({'life-team-roles-v3':'{"invalid":true}'}));assert.deepEqual(broken.permissions.roles,[]);
});

test('Store import scope alternatives match install and use edit permission for updates',()=>{
 const role={id:'scoped',name:'Редактор',pages:['settings','store','customers','builder','agents'],actions:['edit','create','export']},actor={...initialEmployees[1],role:role.id};
 const access=settingsAccess(actor,[role]);assert.equal(access.canGrant('crm.read'),true);assert.equal(access.canGrant('automations.configure'),true);
 const editOnly=settingsAccess(actor,[{...role,actions:['edit','export']}]);assert.equal(editOnly.canGrant('agents.configure','install'),false);assert.equal(editOnly.canGrant('agents.configure','update'),true);
});

test('font choice survives canonical export and old appearance preferences keep system font',()=>{
 const doc=fresh();doc.appearance.preferences.fontFamily='humanist';
 assert.equal(validateSettingsDocument(doc).appearance.preferences.fontFamily,'humanist');
 delete doc.appearance.preferences.fontFamily;
 assert.equal(validateSettingsDocument(doc).appearance.preferences.fontFamily,'system');
 doc.appearance.preferences.fontFamily='external-secret-font';
 assert.throws(()=>validateSettingsDocument(doc));
});
