import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDocuments,trashDocuments,restoreDocuments} from '../lib/os/documents.ts';
const entries=[{id:'a',parent:null,name:'A',kind:'folder'},{id:'b',parent:'a',name:'B',kind:'folder'},{id:'c',parent:'b',name:'C',kind:'file'},{id:'d',parent:null,name:'D',kind:'folder'}];
test('folder movement rejects self-descendants and preserves nested selected files',()=>{assert.throws(()=>moveDocuments(entries,['a'],'b'));const moved=moveDocuments(entries,['a','c'],'d');assert.equal(moved[0].parent,'d');assert.equal(moved[2].parent,'b');assert.equal(entries[0].parent,null)});
test('trash and restore include descendants, while orphan restore returns to root',()=>{const trashed=trashDocuments(entries,['a']);assert.ok(trashed.slice(0,3).every(e=>e.deleted));assert.ok(restoreDocuments(trashed,['a']).every(e=>!e.deleted));assert.equal(restoreDocuments(trashed,['c'])[2].parent,null)});
