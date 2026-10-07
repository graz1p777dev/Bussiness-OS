import type {ActionPermissions} from './team.ts';
import type {InventoryDirectoryRow} from './inventory-directory.ts';
export const moneyStatuses=['Проведена','Черновик','Отменена'] as const;
export type MoneyStatus=typeof moneyStatuses[number];
export type MoneyRow={id:string;direction:string;operation:string;amount:number;category:string;account:string;accountId?:string;currency?:string;counterparty:string;counterpartyId?:string;date:string;status?:MoneyStatus;note?:string;reference?:string};
export type MoneyAccount={id:string;name:string;currency:string;opening:number;type:string;archived?:boolean};
export type MoneyFilters={from:string;to:string;direction:string;account:string;counterparty:string;status:string;query:string};
export const emptyMoneyFilters:MoneyFilters={from:'',to:'',direction:'',account:'',counterparty:'',status:'',query:''};
export function moneyStatus(row:MoneyRow):MoneyStatus{return row.status&&moneyStatuses.includes(row.status)?row.status:row.status?'Черновик':'Проведена'}
export function moneyAccountId(row:MoneyRow,accounts:MoneyAccount[]){
 if(row.accountId)return row.accountId;
 const exact=accounts.filter(account=>!account.archived&&account.name===row.account);
 if(exact.length===1)return exact[0].id;
 const byType=accounts.filter(account=>!account.archived&&account.type===row.account);
 return byType.length===1?byType[0].id:'legacy:'+row.account;
}
export function moneyAccounts(directory:InventoryDirectoryRow[],rows:MoneyRow[]):MoneyAccount[]{
 const accounts:MoneyAccount[]=directory.map(row=>({id:row.id,name:row.name,type:row.detail,currency:row.fields?.currency||(['KGS','USD','EUR','KZT','RUB'].includes(row.extra)?row.extra:'KGS'),opening:Number.isFinite(Number(row.fields?.balance))?Number(row.fields!.balance):0}));
 for(const row of rows){const id=moneyAccountId(row,accounts);if(!accounts.some(account=>account.id===id))accounts.push({id,name:row.account||'Сохранённый счёт',currency:row.currency||'KGS',type:'',opening:0,archived:true})}
 return accounts;
}
export function moneyRowCurrency(row:MoneyRow,accounts:MoneyAccount[]){return row.currency||accounts.find(account=>account.id===moneyAccountId(row,accounts))?.currency||'KGS'}
export function moneyAccountBalances(accounts:MoneyAccount[],rows:MoneyRow[]){
 return accounts.map(account=>{let income=0,expense=0;for(const row of rows){if(moneyStatus(row)!=='Проведена'||moneyAccountId(row,accounts)!==account.id||!Number.isFinite(row.amount))continue;if(row.direction==='Приход')income+=Math.round(row.amount*100);if(row.direction==='Расход')expense+=Math.round(row.amount*100)}return {...account,income:income/100,expense:expense/100,balance:(Math.round(account.opening*100)+income-expense)/100}});
}
export function moneyCounterpartyKey(row:MoneyRow){return row.counterpartyId||row.counterparty||'none'}
export function filterMoneyRows(rows:MoneyRow[],filters:MoneyFilters,accounts:MoneyAccount[]){
 const query=filters.query.trim().toLocaleLowerCase('ru');
 return rows.filter(row=>(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.direction||row.direction===filters.direction)&&(!filters.account||moneyAccountId(row,accounts)===filters.account)&&(!filters.counterparty||moneyCounterpartyKey(row)===filters.counterparty)&&(!filters.status||moneyStatus(row)===filters.status)&&(!query||[row.operation,row.category,row.counterparty,row.reference,row.note].join(' ').toLocaleLowerCase('ru').includes(query))).sort((a,b)=>b.date.localeCompare(a.date));
}
function requirePermission(permissions:ActionPermissions|undefined,action:'create'|'edit'|'remove'){
 if(permissions&&(!permissions.finance||!permissions[action]))throw new Error('Недостаточно прав для денежной операции.');
}
export function saveMoneyRow(rows:MoneyRow[],input:MoneyRow,accounts:MoneyAccount[],permissions?:ActionPermissions){
 const current=rows.find(row=>row.id===input.id);requirePermission(permissions,current?'edit':'create');
 const account=accounts.find(account=>account.id===input.accountId);
 if(!account||account.archived&&(!current||moneyAccountId(current,accounts)!==account.id))throw new Error('Выберите действующий счёт.');
 if(!input.operation.trim())throw new Error('Укажите назначение операции.');
 if(!['Приход','Расход'].includes(input.direction))throw new Error('Выберите тип операции.');
 if(!moneyStatuses.includes(input.status as MoneyStatus))throw new Error('Выберите статус операции.');
 if(!Number.isFinite(input.amount)||input.amount<=0||!Number.isSafeInteger(Math.round(input.amount*100))||Math.abs(input.amount-Math.round(input.amount*100)/100)>1e-8)throw new Error('Укажите сумму больше нуля, не более двух знаков после запятой.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw new Error('Укажите существующую дату операции.');
 if(!input.category.trim())throw new Error('Выберите категорию операции.');
 const row={...input,operation:input.operation.trim(),category:input.category.trim(),amount:Math.round(input.amount*100)/100,account:account.name,currency:account.currency,note:input.note?.trim()||'',reference:input.reference?.trim()||''};
 return current?rows.map(existing=>existing.id===row.id?row:existing):[row,...rows];
}
export function deleteMoneyRow(rows:MoneyRow[],id:string,permissions?:ActionPermissions){requirePermission(permissions,'remove');return rows.filter(row=>row.id!==id)}
export function pinMoneyAccountReferences(rows:MoneyRow[],accounts:MoneyAccount[]){
 return rows.map(row=>{if(row.accountId)return row;const id=moneyAccountId(row,accounts);const account=accounts.find(item=>item.id===id);return {...row,accountId:id,currency:row.currency||account?.currency||'KGS'}});
}
export function updateMoneyAccountReferences(rows:MoneyRow[],accounts:MoneyAccount[],next:{id:string;name:string;currency:string;opening:number}){
 if(!Number.isFinite(next.opening)||!Number.isSafeInteger(Math.round(next.opening*100))||Math.abs(next.opening-Math.round(next.opening*100)/100)>1e-8)throw new Error('Укажите начальный баланс не более чем с двумя знаками после запятой.');
 const previous=accounts.find(account=>account.id===next.id);
 const used=rows.some(row=>moneyAccountId(row,accounts)===next.id);
 if(used&&previous&&previous.currency!==next.currency)throw new Error('Нельзя изменить валюту счёта с денежными операциями. Создайте отдельный счёт в нужной валюте.');
 return pinMoneyAccountReferences(rows,accounts).map(row=>moneyAccountId(row,accounts)===next.id?{...row,accountId:next.id,account:next.name,currency:row.currency||previous?.currency||next.currency}:row);
}
export function assertMoneyAccountDeletion(rows:MoneyRow[],accounts:MoneyAccount[],id:string){
 if(rows.some(row=>moneyAccountId(row,accounts)===id))throw new Error('Счёт используется денежными операциями. Сначала перенесите их на другой счёт или удалите операции.');
}
