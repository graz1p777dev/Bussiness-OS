import test from 'node:test';
import assert from 'node:assert/strict';
import {clientFieldNames,clientFieldInputName,readClientCustomFields} from '../lib/os/client-fields.ts';
import {renderReply} from '../lib/os/reply-templates.ts';
test('configured fields omit standard fields and duplicates while preserving custom names',()=>{
 assert.deepEqual(clientFieldNames(' Телефон\nГород\nИсточник\nТип кожи\nТип кожи\nEmail\nПримечание\nРазмер заказа'),['Тип кожи','Email','Размер заказа']);
});
test('client form updates named fields, preserves hidden values and allows explicit clearing',()=>{
 const form=new FormData();form.set(clientFieldInputName('Тип кожи'),' Сухая ');form.set(clientFieldInputName('Email'),'');form.set('name','Клиент');form.set('client-field:%ZZ','broken');
 const values=readClientCustomFields(form,{'Тип кожи':'Жирная',Email:'before@example.test',Архивное:'Сохранить'});
 assert.deepEqual(values,{'Тип кожи':'Сухая',Email:'',Архивное:'Сохранить'});
});
test('reply templates interpolate custom fields without replacing reserved values or traversing prototypes',()=>{
 const customer={id:'a',name:'Анна',value:0,status:'Новый',channel:'Telegram',owner:'',note:'',customFields:{'Тип кожи':'Сухая',имя:'Другое имя','Пустое':''}};
 assert.deepEqual(renderReply('{{имя}}: {{Тип кожи}}. {{Пустое}} {{constructor}} {{toString}}',customer),{text:'Анна: Сухая. {{Пустое}} {{constructor}} {{toString}}',missing:['Пустое','constructor','toString']});
});
