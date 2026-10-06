import test from 'node:test';
import assert from 'node:assert/strict';
import {needsReply,messageText} from '../lib/os/conversations.ts';
const incoming={id:'1',text:'Подскажите цену?',direction:'incoming'},outgoing={id:'2',text:'Цена 1000 сом',direction:'outgoing'};
test('only latest message direction determines whether client needs a reply',()=>{
 assert.equal(needsReply([incoming]),true);assert.equal(needsReply([incoming,outgoing]),false);
 assert.equal(needsReply([outgoing,incoming]),true);assert.equal(needsReply([incoming,outgoing,incoming]),true);
});
test('legacy operator replies and empty conversation fallback are compatible',()=>{
 assert.equal(needsReply(['Старый ответ']),false);assert.equal(needsReply(['Старый ответ',incoming]),true);
 assert.equal(needsReply([],null),false);assert.equal(needsReply([],'outgoing'),false);assert.equal(needsReply([]),true);
 assert.equal(messageText(incoming),'Подскажите цену?');assert.equal(messageText('Старый ответ'),'Старый ответ');
});
