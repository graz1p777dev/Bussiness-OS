import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantProfile,assistantProfiles,assistantTopic} from '../lib/os/assistant-chats.ts';
test('saved and legacy chat identities retain distinct profile colors and logos',()=>{
 assert.equal(new Set(assistantProfiles.map(item=>item.color)).size,5);
 assert.equal(new Set(assistantProfiles.map(item=>item.icon)).size,5);
 assert.equal(assistantProfile({id:'custom',context:'Продажи'}).id,'sales');
 assert.equal(assistantProfile({id:'default-4',context:'Custom context'}).id,'planning');
 assert.equal(assistantProfile({id:'custom',context:'Other',agentId:'analytics'}).id,'analytics');
});
test('topic is derived from first message with whitespace normalization and length limit',()=>{
 assert.equal(assistantTopic('  Почему\nупали продажи?  '),'Почему упали продажи?');
 assert.ok(assistantTopic('а'.repeat(100)).length<=54);
 assert.equal(assistantTopic('  '),'Новый разговор');
});
