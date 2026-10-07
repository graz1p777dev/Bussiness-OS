import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDocuments,trashDocuments,restoreDocuments,migrateCompanyDocuments} from '../lib/os/documents.ts';
const entries=[{id:'a',parent:null,name:'A',kind:'folder'},{id:'b',parent:'a',name:'B',kind:'folder'},{id:'c',parent:'b',name:'C',kind:'file'},{id:'d',parent:null,name:'D',kind:'folder'}];
test('folder movement rejects self-descendants and preserves nested selected files',()=>{assert.throws(()=>moveDocuments(entries,['a'],'b'));const moved=moveDocuments(entries,['a','c'],'d');assert.equal(moved[0].parent,'d');assert.equal(moved[2].parent,'b');assert.equal(entries[0].parent,null)});
test('trash and restore include descendants, while orphan restore returns to root',()=>{const trashed=trashDocuments(entries,['a']);assert.ok(trashed.slice(0,3).every(e=>e.deleted));assert.ok(restoreDocuments(trashed,['a']).every(e=>!e.deleted));assert.equal(restoreDocuments(trashed,['c'])[2].parent,null)});

test('legacy knowledge migrates once without overwriting current documents',async()=>{
 const {migrateKnowledge}=await import('../lib/os/documents.ts');
 const current=[{id:'current',parent:null,name:'Мой документ',kind:'file',text:'Новая редакция',modified:'2026-10-06'}];
 const legacy=[{id:'BM-20',name:'Инструкция',note:'Старая редакция'},{id:'BM-21',name:'Условия',note:'Содержание'},null,{name:'Без id'}];
 const migrated=migrateKnowledge(current,legacy);
 assert.equal(migrated.length,4);assert.equal(migrated[0].text,'Новая редакция');
 assert.equal(migrated.find(e=>e.id==='legacy-knowledge-BM-20').text,'Старая редакция');
 assert.equal(migrated.find(e=>e.id==='legacy-knowledge-BM-21').parent,'legacy-knowledge');
 assert.strictEqual(migrateKnowledge(migrated,legacy),migrated);
 assert.strictEqual(migrateKnowledge(current,undefined),current);
});
test('uploaded text formats are recognized without treating binary files as text',async()=>{
 const {isTextDocument}=await import('../lib/os/documents.ts');
 assert.equal(isTextDocument({name:'report.CSV',mime:''}),true);
 assert.equal(isTextDocument({name:'unknown',mime:'text/plain'}),true);
 assert.equal(isTextDocument({name:'data',mime:'application/json'}),true);
 assert.equal(isTextDocument({name:'photo.png',mime:'image/png'}),false);
 assert.equal(isTextDocument({name:'document.pdf',mime:'application/pdf'}),false);
});

test('restore keeps existing files intact and resolves name collisions',()=>{
 const rows=[{id:'old',parent:null,name:'Инструкция.txt',kind:'file',text:'старый текст',deleted:true,modified:'2026-10-01'},{id:'new',parent:null,name:'Инструкция.txt',kind:'file',text:'новый текст',modified:'2026-10-06'}];
 const restored=restoreDocuments(rows,['old']);
 assert.equal(restored[1].name,'Инструкция.txt');assert.equal(restored[1].text,'новый текст');
 assert.equal(restored[0].name,'Инструкция (восстановлено 1).txt');assert.equal(restored[0].text,'старый текст');assert.equal(restored[0].deleted,false);
});
test('company documents migrate into category folders without overwriting files or uploaded blobs',()=>{
 const current=[{id:'current',parent:null,name:'Документы компании',kind:'folder',modified:'2026-10-01'},{id:'company-document-salary',parent:'current',name:'Мой PDF',kind:'file',blob:true,mime:'application/pdf',size:42,modified:'2026-10-01'}];
 const legacy=[{id:'salary',name:'Расчёт.txt',category:'Зарплаты',content:'  Содержание сохраняется без изменений\n',date:'2026-10-02'},{id:'salary2',name:'Расчёт.txt',category:'Зарплаты',content:'Другой документ'},null,{id:'bad',name:'Без содержания'}];
 const migrated=migrateCompanyDocuments(current,legacy,'2026-10-06T00:00:00Z');
 assert.deepEqual(migrated.slice(0,2),current);
 const root=migrated.find(entry=>entry.origin?.id==='root');
 assert.equal(root.name,'Документы компании (2)');
 const category=migrated.find(entry=>entry.kind==='folder'&&entry.name==='Зарплаты');
 assert.equal(category.parent,root.id);
 const file=migrated.find(entry=>entry.kind==='file'&&entry.origin?.id==='salary');
 assert.equal(file.id,'company-document-salary-2');
 assert.equal(file.parent,category.id);assert.equal(file.text,legacy[0].content);assert.equal(file.modified,'2026-10-02');
 assert.equal(migrated.find(entry=>entry.origin?.id==='salary2').name,'Расчёт (2).txt');
 assert.strictEqual(migrateCompanyDocuments(migrated,legacy),migrated);
 assert.deepEqual(current[1],migrated[1]);
});
test('migration keeps edited, renamed, moved and deleted document identity and supports restoring it',()=>{
 const legacy=[{id:'d1',name:'Регламент',category:'Правила',content:'Прежний текст'}];
 const migrated=migrateCompanyDocuments([],legacy,'2026-10-06T00:00:00Z');
 const id=migrated.find(entry=>entry.kind==='file').id;
 const edited=migrated.map(entry=>entry.id===id?{...entry,name:'Новая редакция',text:'Актуальные правила'}:entry);
 const moved=moveDocuments(edited,[id],null);
 const trashed=trashDocuments(moved,[id]);
 assert.strictEqual(migrateCompanyDocuments(trashed,legacy),trashed);
 const restored=restoreDocuments(trashed,[id]).find(entry=>entry.id===id);
 assert.equal(restored.name,'Новая редакция');assert.equal(restored.text,'Актуальные правила');assert.equal(restored.parent,null);assert.equal(restored.deleted,false);
});
test('new legacy rows import once even when source repeats IDs and the imported folder was trashed',()=>{
 const legacy=[{id:'d1',name:'Регламент',category:'Правила',content:'Текст'},{id:'d1',name:'Дубликат',content:'Другой'}];
 const migrated=migrateCompanyDocuments([],legacy);
 assert.equal(migrated.filter(entry=>entry.kind==='file').length,1);
 const root=migrated.find(entry=>entry.origin?.id==='root');
 const trashed=trashDocuments(migrated,[root.id]);
 const next=migrateCompanyDocuments(trashed,[...legacy,{id:'d2',name:'Ещё один',category:'Правила',content:'Новый'}]);
 assert.equal(next.filter(entry=>entry.kind==='file').length,2);
 assert.equal(next.find(entry=>entry.origin?.id==='d2').deleted,true);
 assert.equal(next.find(entry=>entry.id===root.id).deleted,true);
 assert.strictEqual(migrateCompanyDocuments(next,[]),next);
 assert.strictEqual(migrateCompanyDocuments(next,{bad:true}),next);
});
