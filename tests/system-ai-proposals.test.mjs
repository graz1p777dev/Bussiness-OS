import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettingsDocument,settingsAccess,settingsDocumentKey,getSettingsDocument} from '../lib/os/settings-document.ts';
import {initialEmployees,initialRoles} from '../lib/os/team.ts';
import {prepareSystemProposal,applySystemProposal,commitSystemProposal} from '../lib/os/system-ai-proposals.ts';
import {diagnoseServerConfiguration} from '../lib/os/server-engineer.ts';
const fresh=()=>structuredClone(defaultSettingsDocument),owner=settingsAccess(initialEmployees[0],initialRoles);
const memory=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)}};

test('logistics preview is pure and selected fields apply without touching existing stages or sales',()=>{
 const before=fresh(),original=structuredClone(before);before.crm.settings.customFields+='\nПеревозчик';
 const plan=prepareSystemProposal('logistics','Настрой логистику',before,'p1');assert.equal(plan.changes.length,2);
 assert.deepEqual(before.crm.stages,original.crm.stages);
 const next=applySystemProposal(plan,['crm.settings'],before,owner);
 assert.deepEqual(next.crm.stages,before.crm.stages);assert.equal(next.crm.settings.customFields.split('\n').filter(row=>row==='Перевозчик').length,1);
 assert.match(next.crm.settings.customFields,/Трек-номер/);assert.deepEqual(next.business,before.business);
 const full=applySystemProposal(plan,plan.changes.map(row=>row.path),before,owner);
 assert.deepEqual(full.crm.stages.sales.slice(0,before.crm.stages.sales.length),before.crm.stages.sales);
 assert.equal(full.crm.stages.sales.at(-1).name,'Доставлено');assert.deepEqual(full.crm.stages.repeat,before.crm.stages.repeat);
 assert.equal(prepareSystemProposal('logistics','Повтор',full,'p2').changes.length,0);
});

test('proposal requires selected supported paths and current rights; stale target fails while unrelated config survives',()=>{
 const before=fresh(),plan=prepareSystemProposal('logistics','Доставка',before,'p'),selected=plan.changes.map(row=>row.path);
 assert.throws(()=>applySystemProposal(plan,[],before,owner),/Выберите/);
 assert.throws(()=>applySystemProposal(plan,['permissions.roles'],before,owner),/не входит/);
 assert.throws(()=>applySystemProposal(plan,selected,before,{...owner,canWrite:()=>false}),/Недостаточно прав/);
 const current=structuredClone(before);current.appearance.theme='Light';
 assert.equal(applySystemProposal(plan,selected,current,owner).appearance.theme,'Light');
 current.crm.settings.requiredPhone=!current.crm.settings.requiredPhone;
 assert.throws(()=>applySystemProposal(plan,selected,current,owner),/изменился после/);
});

test('approved proposal persists once through canonical document; cancelled preview writes nothing',()=>{
 const storage=memory(),current=getSettingsDocument(storage),bytes=storage.getItem(settingsDocumentKey),plan=prepareSystemProposal('reply-review','Проверять ответы',current,'p');
 assert.equal(storage.getItem(settingsDocumentKey),bytes);
 const selected=plan.changes.map(row=>row.path);commitSystemProposal(plan,selected,owner,storage);
 const next=getSettingsDocument(storage);assert.equal(next.ai.bot.mode,'С подтверждением');assert.equal(next.ai.bot.strictTraining,true);
 assert.equal(next.ai.bot.prompt,current.ai.bot.prompt);assert.equal(storage.getItem('life-bot-config-v2'),null);
 const saved=storage.getItem(settingsDocumentKey);assert.throws(()=>commitSystemProposal(plan,selected,owner,storage),/изменился после/);assert.equal(storage.getItem(settingsDocumentKey),saved);
});

test('engineer safeguards need production authority and preserve provider and endpoint',()=>{
 const before=fresh();Object.assign(before.system.engineer,{mode:'emergency',backup:false,tests:false,rollback:false,endpoint:'https://gateway.example.test'});
 const plan=prepareSystemProposal('engineer-safeguards','Безопасный режим',before,'p');
 const employee={...initialEmployees[0],role:'admin'},admin=settingsAccess(employee,initialRoles);
 assert.throws(()=>applySystemProposal(plan,['system.engineer'],before,admin),/Недостаточно прав/);
 const next=applySystemProposal(plan,['system.engineer'],before,owner);assert.equal(next.system.engineer.mode,'diagnose');assert.equal(next.system.engineer.endpoint,before.system.engineer.endpoint);assert.equal(next.system.engineer.provider,before.system.engineer.provider);
});

test('engineer reports configuration findings and never fabricates service or secret evidence',()=>{
 const document=fresh();document.system.engineer.endpoint='';document.system.engineer.tests=false;
 document.integrations.channels={PRIVATE:{enabled:true,events:[],values:{apiUrl:'https://private.example.test'}}};
 const report=diagnoseServerConfiguration(document,'HTTP 500','run','2026-10-10T10:00:00Z');
 assert.equal(report.scope,'local-config');assert.equal(report.findings.find(row=>row.id==='telemetry').status,'unknown');assert.equal(report.findings.find(row=>row.id==='gateway').status,'attention');assert.equal(report.findings.find(row=>row.id==='safeguards').status,'attention');
 assert.equal(report.findings.some(row=>row.area==='Интеграции'),false);assert.equal(report.findings.some(row=>row.id==='system-ai'),false);
 const permitted=diagnoseServerConfiguration(document,'HTTP 500','run','2026-10-10T10:00:00Z',{integrations:true,systemAI:true});
 assert.equal(permitted.findings.find(row=>row.id==='channel-PRIVATE').status,'attention');assert.equal(JSON.stringify(permitted).includes('private.example.test'),false);
 document.system.engineer.endpoint='https://gateway.example.test';document.system.engineer.tests=true;document.system.engineer.backup=true;document.system.engineer.rollback=true;document.system.engineer.mode='diagnose';
 const updated=diagnoseServerConfiguration(document,'','run2','2026-10-10T11:00:00Z');assert.equal(updated.findings.find(row=>row.id==='gateway').status,'configured');assert.equal(updated.findings.find(row=>row.id==='telemetry').status,'unknown');
});

test('CRM-only proposal commit does not require unrelated MCP authority after document normalization',()=>{
 const storage=memory(),before=getSettingsDocument(storage),plan=prepareSystemProposal('logistics','Доставка',before,'limited');
 const access={...owner,canWrite:(branch,section)=>branch==='crm'&&['stages','settings'].includes(section)};
 const next=commitSystemProposal(plan,plan.changes.map(change=>change.path),access,storage);
 assert.equal(next.crm.stages.sales.at(-1).name,'Доставлено');assert.deepEqual(next.mcp,before.mcp);
});
