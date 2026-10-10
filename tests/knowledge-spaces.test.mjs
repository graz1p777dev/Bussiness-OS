import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spaceDocuments,findSpaceSources} from '../lib/os/knowledge-spaces.ts';
const entries=[{id:'a',parent:null,kind:'folder',name:'A'},{id:'b',parent:null,kind:'folder',name:'B'},{id:'nested',parent:'a',kind:'folder',name:'Nested'},{id:'1',parent:'nested',kind:'file',name:'Доставка',text:'Доставка по Бишкеку курьером.\nОплата наличными.'},{id:'2',parent:'b',kind:'file',name:'Доставка B',text:'Секрет другого пространства'},{id:'3',parent:'a',kind:'file',name:'Удалённый',text:'Доставка бесплатная',deleted:true}];
test('space context includes nested documents and excludes other spaces/trash',()=>{assert.deepEqual(spaceDocuments(entries,'a').map(x=>x.id),['1']);assert.deepEqual(spaceDocuments(entries,'missing'),[])});
test('retrieval returns source citations only from scoped matching text',()=>{const sources=findSpaceSources(spaceDocuments(entries,'a'),'Как работает доставка?');assert.equal(sources[0].id,'1');assert.equal(sources[0].quote,'Доставка по Бишкеку курьером.');assert.deepEqual(findSpaceSources(spaceDocuments(entries,'a'),'налоги'),[])});
