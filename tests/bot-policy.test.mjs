import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBotPolicy,resolveBotReply} from '../lib/os/bot-policy.ts';
const client={id:'c',name:'Алина Ибраимова',value:12400,status:'Первичный контакт',channel:'Instagram',owner:'Айым',note:'',city:'Бишкек'};
const template={id:'delivery',name:'Доставка',body:'{{имя}}, доставка по Бишкеку.'};
const rule={id:'rule',enabled:true,event:'message',field:'request',operator:'contains',value:'доставка',action:'template',templateId:'delivery',once:true};
test('first matched template expands card variables and once-only rules fall through',()=>{const policy={...initialBotPolicy,rulesList:[rule]};assert.equal(resolveBotReply(policy,[template],'Как работает ДОСТАВКА?',client,false).text,'Алина, доставка по Бишкеку.');assert.equal(resolveBotReply(policy,[template],'доставка',client,false,['rule']).kind,'model');assert.equal(resolveBotReply({...policy,mode:'templates'},[template],'привет',client,false).kind,'handoff')});
test('missing templates and variables never become successful replies',()=>{const policy={...initialBotPolicy,rulesList:[rule]};assert.equal(resolveBotReply(policy,[],'доставка',client,false).kind,'error');assert.equal(resolveBotReply(policy,[{...template,body:'{{заметка}}'}],'доставка',client,false).kind,'error');assert.equal(resolveBotReply({...policy,rulesList:[{...rule,event:'first-contact'}]},[template],'доставка',client,false).kind,'model')});
