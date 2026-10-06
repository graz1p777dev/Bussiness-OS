import test from 'node:test';
import assert from 'node:assert/strict';
import {planningPersonKey,planningPersonOptions} from '../lib/os/planning-people.ts';
const people=[{id:'a',name:'Айым Абдиева',active:true},{id:'m',name:'Медина Осмонова',active:true},{id:'old',name:'Бывший сотрудник',active:false}];
test('new planning records select active people; existing inactive assignments are retained',()=>{
 assert.deepEqual(planningPersonOptions(people).map(option=>option.value),['a','m']);
 assert.deepEqual(planningPersonOptions(people,'Бывший сотрудник','old').map(option=>option.value),['a','m','old']);
 assert.equal(planningPersonOptions(people,'Историческое имя').at(-1).name,'Историческое имя');
});
test('legacy first names resolve to the same identity as new full names without conflating namesakes',()=>{
 assert.equal(planningPersonKey(people,'Медина'),'m');
 assert.equal(planningPersonKey(people,'Медина Осмонова'),'m');
 const namesakes=[...people,{id:'other',name:'Медина Асанова',active:true}];
 assert.equal(planningPersonKey(namesakes,'Медина'),'legacy:Медина');
 assert.equal(planningPersonKey(namesakes,'Медина','m'),'m');
 assert.equal(planningPersonKey(people,'Историческое имя','removed'),'removed');
});
