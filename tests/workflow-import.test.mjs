import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkflowImport,workflowBranch} from '../lib/os/workflow-schema.ts';
import {validateWorkflow} from '../lib/os/workflow-validation.ts';
const node=(id,kind)=>({id,position:{x:0,y:100},data:{kind,label:id}});
const graph={version:1,nodes:[node('t','Trigger'),node('c','CRM')],edges:[{id:'tc',source:'t',target:'c'}]};
test('import preserves draft configuration and rejects malformed structure',()=>{
 const draft=parseWorkflowImport(graph);assert.equal(draft.nodes[0].type,'agent');assert.ok(validateWorkflow(draft.nodes,draft.edges).some(s=>s.includes('выберите этап')));
 assert.throws(()=>parseWorkflowImport(null),/nodes и edges/);
 assert.throws(()=>parseWorkflowImport({...graph,version:2}),/Версия/);
 assert.throws(()=>parseWorkflowImport({...graph,nodes:[null]}),/Блок 1/);
 assert.throws(()=>parseWorkflowImport({...graph,nodes:[node('t','Unknown')]}),/неизвестный тип/);
 assert.throws(()=>parseWorkflowImport({...graph,nodes:[node('t','Trigger'),node('t','Output')]}),/ID блоков/);
 assert.throws(()=>parseWorkflowImport({...graph,edges:[...graph.edges,...graph.edges]}),/ID связей/);
 assert.throws(()=>parseWorkflowImport({...graph,edges:[{id:'tc',source:'t',target:'missing'}]}),/отсутствующими/);
 assert.throws(()=>parseWorkflowImport({...graph,nodes:[{...node('t','Trigger'),position:{x:Infinity,y:0}}]}),/координаты/);
});
test('branch validation and execution use ports consistently despite old descriptive labels',()=>{
 const nodes=[node('t','Trigger'),{...node('c','Condition'),data:{kind:'Condition',label:'Проверка',value:1}},node('y','Output'),node('n','Output')];
 const edges=[{id:'tc',source:'t',target:'c'},{id:'cy',source:'c',target:'y',sourceHandle:'yes',label:'Нет'},{id:'cn',source:'c',target:'n',sourceHandle:'no',label:'Да'}];
 assert.equal(workflowBranch(edges[1]),'Да');assert.deepEqual(validateWorkflow(nodes,edges),[]);
 assert.throws(()=>parseWorkflowImport({nodes,edges:edges.map(e=>e.source==='c'?{...e,sourceHandle:undefined,label:'Продолжить'}:e)}),/выберите выход/);
 assert.throws(()=>parseWorkflowImport({...graph,edges:[{id:'tc',source:'t',target:'c',sourceHandle:'yes'}]}),/не имеет выхода/);
 const parsed=parseWorkflowImport({nodes,edges:edges.map(e=>({...e,sourceHandle:undefined,label:e.target==='y'?'Да • отправить':e.target==='n'?'Нет • напомнить':undefined}))});
 assert.equal(parsed.edges[1].sourceHandle,'yes');assert.equal(parsed.edges[2].sourceHandle,'no');
 const stageGraph={...graph,nodes:[node('t','Trigger'),{...node('c','CRM'),data:{kind:'CRM',label:'Этап',stage:'Удалённый этап'}}]};
 assert.ok(validateWorkflow(stageGraph.nodes,stageGraph.edges,['Оплата']).some(s=>s.includes('недоступен')));
});
