import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDocuments,trashDocuments,restoreDocuments} from '../lib/os/documents.ts';
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
