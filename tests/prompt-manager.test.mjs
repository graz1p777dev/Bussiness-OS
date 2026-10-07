import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDeals} from '../lib/os/data.ts';
import {initialPromptFilters,filterPromptDeals,analyzePromptSlice,buildPromptSuggestions,composeManagedPrompt,applyPromptToSettings,promptDiff} from '../lib/os/prompt-manager.ts';

const deal=(id,fields={})=>({id,name:'Клиент '+id,value:100,status:'Контакт',pipeline:'Продажи',channel:'WhatsApp',owner:'Менеджер',note:'',...fields});
const deals=[
 deal('sales'),
 deal('repeat',{pipeline:'Повторные продажи',status:'Оплата',channel:'Telegram'}),
 deal('sales-won',{pipeline:'Успешно',status:'Успешно',previousPipeline:'Продажи'}),
 deal('repeat-won',{pipeline:'Успешно',status:'Успешно',previousPipeline:'Повторные продажи',channel:'Telegram'}),
 deal('repeat-lost',{pipeline:'Неуспешно',status:'Неуспешно',previousPipeline:'Повторные продажи',channel:'Telegram'}),
 deal('legacy',{pipeline:undefined,status:'Оплата'}),
 deal('legacy-won',{pipeline:undefined,status:'Успешно'}),
];
const filtered=changes=>filterPromptDeals(deals,{...initialPromptFilters,...changes}).map(row=>row.id);
const incoming=(id,text)=>({id,text,direction:'incoming'});
const outgoing=(id,text)=>({id,text,direction:'outgoing'});
const answers={business:'  Косметика  ',goal:'  Помочь выбрать уход  ',tone:'  Коротко и тепло  ',boundaries:'  Проверять наличие  '};
const suggestion=(id,text)=>({id,title:'Правило '+id,reason:'Ответ владельца',text});

test('funnel filters retain the original sales or repeat funnel for closed deals and support legacy sales',()=>{
 assert.deepEqual(filtered({pipelines:['Продажи']}),['sales','sales-won','legacy','legacy-won']);
 assert.deepEqual(filtered({pipelines:['Повторные продажи']}),['repeat','repeat-won','repeat-lost']);
 assert.deepEqual(filtered({}),deals.map(row=>row.id));
 assert.deepEqual(filtered({pipelines:[]}),[]);
});

test('stage and source filters intersect, with exclusions overriding includes and empty includes allowing all',()=>{
 assert.deepEqual(filtered({pipelines:['Повторные продажи'],includeStages:['Оплата','Успешно'],includeSources:['Telegram']}),['repeat','repeat-won']);
 assert.deepEqual(filtered({includeStages:['Оплата','Успешно'],excludeStages:['Успешно'],includeSources:['WhatsApp','Telegram'],excludeSources:['WhatsApp']}),['repeat']);
 assert.deepEqual(filtered({excludeStages:['Успешно','Неуспешно'],excludeSources:['Telegram']}),['sales','legacy']);
 assert.deepEqual(filtered({includeSources:['Telegram'],excludeSources:['Telegram']}),[]);
 assert.deepEqual(filtered({includeStages:['Несуществующий этап']}),[]);
});

test('bought means a successful outcome; payment-stage, open, and lost deals remain not bought',()=>{
 assert.deepEqual(filtered({purchase:'bought'}),['sales-won','repeat-won','legacy-won']);
 assert.deepEqual(filtered({purchase:'not-bought'}),['sales','repeat','repeat-lost','legacy']);
 assert.deepEqual(filtered({pipelines:['Повторные продажи'],purchase:'bought'}),['repeat-won']);
 assert.deepEqual(filtered({pipelines:['Повторные продажи'],purchase:'not-bought',includeStages:['Неуспешно']}),['repeat-lost']);
});

test('analysis counts only saved messages belonging to the selected deals and treats legacy strings as outgoing',()=>{
 const rows=[deals[0],deals[1],deals[2]];
 const messages={
  sales:[incoming('s1','Какая цена, есть скидка?'),outgoing('s2','Расскажем про доставку')],
  repeat:['Проверяем наличие',incoming('r1','Есть доставка в Ош?')],
  'sales-won':[incoming('w1','Есть ли в наличии?'),outgoing('w2','Уточню')],
  excluded:[incoming('e1','Аллергия, хочу возврат')],
 };
 const original=structuredClone({rows,messages});
 const analysis=analyzePromptSlice(rows,messages);
 assert.deepEqual({...analysis,topics:analysis.topics.map(({id,count})=>({id,count}))},{deals:3,bought:1,withMessages:3,savedMessages:6,incoming:3,outgoing:3,unanswered:1,sources:['WhatsApp','Telegram'],topics:[{id:'price',count:1},{id:'stock',count:1},{id:'delivery',count:1}]});
 assert.deepEqual({rows,messages},original);
});

test('seeded customer cards and notes never invent saved messages or unanswered conversations',()=>{
 const analysis=analyzePromptSlice(initialDeals,{});
 assert.equal(analysis.deals,initialDeals.length);
 for(const key of ['withMessages','savedMessages','incoming','outgoing','unanswered'])assert.equal(analysis[key],0,key);
 assert.deepEqual(analysis.topics,[]);
 const empty=analyzePromptSlice([],{sales:[incoming('s1','Какая цена?')]});
 assert.deepEqual(empty,{deals:0,bought:0,withMessages:0,savedMessages:0,incoming:0,outgoing:0,unanswered:0,sources:[],topics:[]});
});

test('suggestions preserve owner answers and add topics only from actual incoming text',()=>{
 const row=deal('client',{note:'Жалоба на доставку, нужна скидка'});
 const noEvidence=analyzePromptSlice([row],{client:['Есть доставка?',outgoing('o1','Цена и наличие')]});
 const base=buildPromptSuggestions(answers,initialPromptFilters,noEvidence);
 assert.deepEqual(base.map(item=>item.id),['context','tone','boundaries']);
 assert.equal(base[0].text,'Контекст бизнеса: Косметика\nЗадача агента: Помочь выбрать уход');
 assert.equal(base[1].text,'Стиль общения: Коротко и тепло');
 assert.equal(base[2].text,'Правила и передача сотруднику: Проверять наличие');
 const evidence=analyzePromptSlice([row],{client:[incoming('i1','Сколько стоит доставка?'),incoming('i2','Какая цена?')]});
 const suggestions=buildPromptSuggestions(answers,initialPromptFilters,evidence);
 assert.deepEqual(suggestions.map(item=>item.id),['context','tone','boundaries','unanswered','price','delivery']);
 assert.match(suggestions.find(item=>item.id==='price').reason,/2/);
 assert.match(suggestions.find(item=>item.id==='delivery').reason,/1/);
});

test('repeat-purchase advice requires both the bought filter and a confirmed successful deal',()=>{
 const purchased=analyzePromptSlice([deals[2]],{}),open=analyzePromptSlice([deals[0]],{});
 const ids=(filters,analysis)=>buildPromptSuggestions(answers,filters,analysis).map(item=>item.id);
 assert.ok(ids({...initialPromptFilters,purchase:'bought'},purchased).includes('repeat'));
 assert.ok(!ids(initialPromptFilters,purchased).includes('repeat'));
 assert.ok(!ids({...initialPromptFilters,purchase:'bought'},open).includes('repeat'));
});

test('managed prompt replacement is idempotent and preserves manual prefix and suffix exactly',()=>{
 const prefix='  Ручная инструкция\n\n',suffix='\n\nЗавершающее правило  \n';
 const selected=[suggestion('one','  Проверяй наличие.  '),suggestion('two','Уточняй потребность.')];
 const initial=composeManagedPrompt(prefix,[suggestion('old','Старое правило.')])+suffix;
 const updated=composeManagedPrompt(initial,selected);
 assert.equal(updated,prefix+'[Начало настроек Prompt Manager]\nПроверяй наличие.\n\nУточняй потребность.\n[Конец настроек Prompt Manager]'+suffix);
 assert.equal(composeManagedPrompt(updated,selected),updated);
 assert.equal(composeManagedPrompt(updated,[]),updated);
 assert.equal(composeManagedPrompt('',[]),'');
 assert.equal((updated.match(/\[Начало настроек Prompt Manager\]/g)||[]).length,1);
});

test('applying the reviewed prompt preserves other settings and other agents without mutating the input',()=>{
 const settings={sales:{prompt:'Старый текст',model:'Chat Model',temperature:'0.4',enabled:'true'},support:{prompt:'Поддержка',model:'Gemini'}};
 const original=structuredClone(settings),updated=applyPromptToSettings(settings,'sales','Проверенный текст');
 assert.deepEqual(updated,{sales:{...settings.sales,prompt:'Проверенный текст'},support:settings.support});
 assert.deepEqual(settings,original);
 assert.notEqual(updated,settings);
 assert.notEqual(updated.sales,settings.sales);
 assert.equal(updated.support,settings.support);
 assert.deepEqual(applyPromptToSettings(settings,'new','Новый агент'),{...settings,new:{prompt:'Новый агент'}});
});

test('prompt diff shows changed lines and nearby context with correct old and new line numbers',()=>{
 const before='Вступление\nКонтекст 1\nКонтекст 2\nСтарое правило\nКонец 1\nКонец 2\nКонец 3';
 const after='Вступление\nКонтекст 1\nКонтекст 2\nНовое правило\nЕщё правило\nКонец 1\nКонец 2\nКонец 3';
 assert.deepEqual(promptDiff(before,after),[
  {kind:'context',text:'Контекст 1',before:2,after:2},
  {kind:'context',text:'Контекст 2',before:3,after:3},
  {kind:'removed',text:'Старое правило',before:4},
  {kind:'added',text:'Новое правило',after:4},
  {kind:'added',text:'Ещё правило',after:5},
  {kind:'context',text:'Конец 1',before:5,after:6},
  {kind:'context',text:'Конец 2',before:6,after:7},
 ]);
 assert.deepEqual(promptDiff(before,before),[]);
 assert.deepEqual(promptDiff('','Новый текст'),[{kind:'added',text:'Новый текст',after:1}]);
 assert.deepEqual(promptDiff('Старый текст',''),[{kind:'removed',text:'Старый текст',before:1}]);
});
