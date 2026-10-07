import test from 'node:test';
import assert from 'node:assert/strict';
import {demoAssistant,validAssistantAction} from '../lib/os/assistant.ts';
test('finding deals highlights the board; read-only targets cannot be auto-clicked',()=>{
 const answer=demoAssistant('Где смотреть сделки?');
 assert.deepEqual(answer.actions,[{type:'highlight',target:'crm-board'}]);
 assert.equal(validAssistantAction(answer.actions[0]),true);
 assert.equal(validAssistantAction({type:'open',target:'crm-board'}),false);
 assert.equal(validAssistantAction({type:'navigate',route:'https://evil.example'}),false);
 assert.equal(validAssistantAction({type:'highlight',target:'unknown'}),false);
});
