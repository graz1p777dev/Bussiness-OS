import test from 'node:test';
import assert from 'node:assert/strict';
import {actionPermissions,initialEmployees,teamActions} from '../lib/os/team.ts';
const viewer={...initialEmployees[1],role:'viewer'};
const roles=[{id:'viewer',name:'Просмотр и анализ',pages:['builder'],actions:['ai','export']}];
test('page access does not grant editing, deleting or creating; AI and export remain independent',()=>{const permissions=actionPermissions(viewer,roles,'builder');assert.deepEqual(Object.keys(permissions).sort(),Object.keys(teamActions).sort());assert.equal(permissions.edit,false);assert.equal(permissions.create,false);assert.equal(permissions.remove,false);assert.equal(permissions.ai,true);assert.equal(permissions.export,true)});
test('missing pages, accounts and blocked staff deny every action',()=>{for(const [employee,page] of [[viewer,'server'],[{...viewer,status:'Заблокирован'},'builder'],[{...viewer,status:'Уволен'},'builder'],[undefined,'builder']])assert.ok(Object.values(actionPermissions(employee,roles,page)).every(allowed=>allowed===false))});
