import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkflow} from '../lib/os/workflow-validation.ts';
const nodes=[{id:'t',data:{kind:'Trigger',label:'Вход'}},{id:'c',data:{kind:'Condition',label:'Проверка',field:'amount',operator:'greater',value:1000}},{id:'y',data:{kind:'Output',label:'Да'}},{id:'n',data:{kind:'Output',label:'Нет'}}];
const edges=[{id:'1',source:'t',target:'c'},{id:'2',source:'c',target:'y',label:'Да'},{id:'3',source:'c',target:'n',label:'Нет'}];
test('workflow validation detects missing branch labels, cycles and extra triggers',()=>{assert.deepEqual(validateWorkflow(nodes,edges),[]);assert.ok(validateWorkflow(nodes,edges.map(e=>({...e,label:''}))).some(s=>s.includes('подписанные')));assert.ok(validateWorkflow(nodes,[...edges,{id:'4',source:'y',target:'t'}]).some(s=>s.includes('Циклы')));assert.ok(validateWorkflow([...nodes,{id:'t2',data:{kind:'Trigger',label:'Второй'}}],edges).some(s=>s.includes('ровно один')))});
