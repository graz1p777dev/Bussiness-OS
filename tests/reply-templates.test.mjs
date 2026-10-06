import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReply} from '../lib/os/reply-templates.ts';
const customer={id:'D1',name:'Алина Ибраимова',value:12400,status:'Квалификация',channel:'Instagram',owner:'Медина',note:'Ждёт наличия'};
test('reply variables use current customer fields, whitespace and repeated placeholders',()=>{
 assert.deepEqual(renderReply('{{имя}}, {{ клиент }}: {{сумма}}. {{этап}} / {{канал}} / {{ответственный}} / {{заметка}} / {{id}}. {{имя}}',customer),{text:'Алина, Алина Ибраимова: 12 400 сом. Квалификация / Instagram / Медина / Ждёт наличия / D1. Алина',missing:[]});
});
test('missing variables stay visible and are reported once; values are never recursively interpolated',()=>{
 assert.deepEqual(renderReply('{{телефон}} {{телефон}} {{заметка}}',{...customer,note:''}),{text:'{{телефон}} {{телефон}} {{заметка}}',missing:['телефон','заметка']});
 assert.equal(renderReply('{{заметка}}',{...customer,note:'{{имя}} <script>'}).text,'{{имя}} <script>');
 assert.equal(renderReply('Сумма {{сумма}}',{...customer,value:0}).text,'Сумма 0 сом');
});
