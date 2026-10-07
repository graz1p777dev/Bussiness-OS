import test from 'node:test';
import assert from 'node:assert/strict';
import {moneyAccounts,moneyAccountBalances,moneyAccountId,filterMoneyRows,emptyMoneyFilters,saveMoneyRow,deleteMoneyRow} from '../lib/os/inventory-money.ts';
const directory=[{id:'cash',name:'Касса магазина',detail:'Наличные',extra:'KGS',fields:{balance:'1000',currency:'KGS'}},{id:'bank',name:'Банк',detail:'Банковский счёт',extra:'USD',fields:{balance:'50',currency:'USD'}}];
const row={id:'row1',direction:'Приход',operation:'Оплата',amount:100.10,category:'Продажа',account:'Касса магазина',accountId:'cash',counterparty:'Клиент',counterpartyId:'cl1',date:'2026-10-06',status:'Проведена'};
test('money edits, account changes, cancellation and deletion recompute balances without double applying',()=>{
 const accounts=moneyAccounts(directory,[]);let rows=saveMoneyRow([],row,accounts);
 assert.equal(moneyAccountBalances(accounts,rows)[0].balance,1100.10);
 rows=saveMoneyRow(rows,{...row,amount:200.20},accounts);assert.equal(moneyAccountBalances(accounts,rows)[0].balance,1200.20);
 rows=saveMoneyRow(rows,{...row,accountId:'bank',direction:'Расход',amount:10.30},accounts);
 assert.equal(moneyAccountBalances(accounts,rows)[0].balance,1000);assert.equal(moneyAccountBalances(accounts,rows)[1].balance,39.70);
 rows=saveMoneyRow(rows,{...rows[0],status:'Отменена'},accounts);assert.equal(moneyAccountBalances(accounts,rows)[1].balance,50);
 rows=saveMoneyRow(rows,{...rows[0],status:'Черновик'},accounts);assert.equal(moneyAccountBalances(accounts,rows)[1].balance,50);
 rows=deleteMoneyRow(rows,row.id);assert.equal(rows.length,0);assert.equal(moneyAccountBalances(accounts,rows)[1].balance,50);
 assert.equal(directory[0].fields.balance,'1000');
});
test('legacy operations retain their balance and archived account references without guessing ambiguous account types',()=>{
 const legacy={...row,accountId:undefined,account:'Наличные',status:undefined};const accounts=moneyAccounts(directory,[legacy]);
 assert.equal(moneyAccountId(legacy,accounts),'cash');assert.equal(moneyAccountBalances(accounts,[legacy])[0].balance,1100.10);
 const ambiguous=moneyAccounts([...directory,{...directory[0],id:'cash2',name:'Вторая касса'}],[legacy]);assert.equal(moneyAccountId(legacy,ambiguous),'legacy:Наличные');assert.equal(ambiguous.at(-1).archived,true);
 const removed=moneyAccounts([], [row]);assert.equal(removed[0].id,'cash');assert.equal(moneyAccountBalances(removed,[row])[0].balance,100.10);
});
test('money filters combine inclusive dates, direction, account, counterparty, status and search',()=>{
 const rows=[row,{...row,id:'other',date:'2026-10-07',status:'Черновик'},{...row,id:'expense',direction:'Расход',counterpartyId:'sup'}];const accounts=moneyAccounts(directory,rows);
 const filters={...emptyMoneyFilters,from:'2026-10-06',to:'2026-10-06',direction:'Приход',account:'cash',counterparty:'cl1',status:'Проведена',query:'опЛаТА'};
 assert.deepEqual(filterMoneyRows(rows,filters,accounts).map(row=>row.id),['row1']);
 assert.equal(filterMoneyRows(rows,{...filters,from:'2026-10-08'},accounts).length,0);
});
test('finance permissions never imply create/edit/remove and invalid amounts cannot change the ledger',()=>{
 const accounts=moneyAccounts(directory,[row]);
 assert.throws(()=>saveMoneyRow([],{...row},accounts,{finance:true,create:false}),/прав/);
 assert.throws(()=>saveMoneyRow([row],{...row,amount:20},accounts,{finance:true,edit:false}),/прав/);
 assert.throws(()=>deleteMoneyRow([row],row.id,{finance:false,remove:true}),/прав/);
 assert.throws(()=>deleteMoneyRow([row],row.id,{finance:true,remove:false}),/прав/);
 assert.equal(saveMoneyRow([],{...row},accounts,{finance:true,create:true}).length,1);
 for(const amount of [0,-1,NaN,Infinity,1.001])assert.throws(()=>saveMoneyRow([],{...row,amount},accounts),/сумму/);
 assert.throws(()=>saveMoneyRow([],{...row,date:'2026-02-30'},accounts),/дату/);
 assert.throws(()=>saveMoneyRow([],{...row,accountId:'missing'},accounts),/счёт/);
 assert.equal(row.amount,100.10);
});

test('account renames retain legacy postings and used accounts cannot change currency or disappear',async()=>{
 const {updateMoneyAccountReferences,assertMoneyAccountDeletion}=await import('../lib/os/inventory-money.ts');
 const legacy={...row,accountId:undefined,account:'Наличные',status:undefined};const accounts=moneyAccounts(directory,[legacy]);
 const next=updateMoneyAccountReferences([legacy],accounts,{id:'cash',name:'Переименованная касса',currency:'KGS',opening:1000});
 assert.equal(next[0].accountId,'cash');assert.equal(next[0].account,'Переименованная касса');
 const renamed=moneyAccounts([{...directory[0],name:'Переименованная касса'},directory[1]],next);
 assert.equal(moneyAccountBalances(renamed,next)[0].balance,1100.10);
 assert.throws(()=>updateMoneyAccountReferences([legacy],accounts,{id:'cash',name:'Касса',currency:'USD',opening:1000}),/валюту/);
 assert.throws(()=>assertMoneyAccountDeletion([legacy],accounts,'cash'),/используется/);
 assert.throws(()=>assertMoneyAccountDeletion([{...legacy,status:'Черновик'}],accounts,'cash'),/используется/);
 assert.doesNotThrow(()=>assertMoneyAccountDeletion([legacy],accounts,'bank'));
 assert.throws(()=>updateMoneyAccountReferences([],accounts,{id:'cash',name:'Касса',currency:'KGS',opening:Infinity}),/баланс/);
});

test('adding another cash account does not reassign existing legacy cash postings',async()=>{
 const {updateMoneyAccountReferences,pinMoneyAccountReferences}=await import('../lib/os/inventory-money.ts');
 const legacy={...row,accountId:undefined,account:'Наличные'};const before=moneyAccounts(directory,[legacy]);
 const pinned=updateMoneyAccountReferences([legacy],before,{id:'cash2',name:'Вторая касса',currency:'KGS',opening:0});
 const after=moneyAccounts([...directory,{id:'cash2',name:'Вторая касса',detail:'Наличные',extra:'KGS'}],pinned);
 assert.equal(moneyAccountId(pinned[0],after),'cash');assert.equal(moneyAccountBalances(after,pinned)[0].balance,1100.10);
 const ambiguous=moneyAccounts([...directory,{id:'cash2',name:'Вторая касса',detail:'Наличные',extra:'KGS'}],[legacy]);
 const held=pinMoneyAccountReferences([legacy],ambiguous);assert.equal(held[0].accountId,'legacy:Наличные');
 assert.equal(moneyAccountId(held[0],moneyAccounts(directory,held)),'legacy:Наличные');
});
