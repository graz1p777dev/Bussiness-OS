import type {InventoryState,Sale} from './inventory-model.ts';
import type {Employee} from './team.ts';
import {employeeShifts} from './employee-reports.ts';

export type PosScope={actorId:string;ownOnly:boolean;canReadCompanyFinance:boolean;canViewCustomers:boolean};
export function posRecords(state:InventoryState,employees:Employee[],scope:PosScope){
 const actor=employees.find(employee=>employee.id===scope.actorId&&employee.status==='Активен');
 const restricted=scope.ownOnly||!scope.canReadCompanyFinance;
 const shifts=actor?(restricted?employeeShifts(actor,employees,state.shifts):state.shifts):[];
 const shiftIds=new Set(shifts.map(shift=>shift.id));
 const sales=actor?state.sales.filter(sale=>!restricted||shiftIds.has(sale.shiftId)).map(sale=>{
  if(scope.canViewCustomers)return sale;
  const redacted={...sale};
  for(const key of ['customerId','customerName','customerPhone','couponId','couponCode'] as const)delete redacted[key];
  return redacted;
 }):[];
 return {restricted,shifts,sales,canReadCompanyFinance:Boolean(actor&&scope.canReadCompanyFinance)};
}
export function assertPosOperation(state:InventoryState,employees:Employee[],scope:PosScope,canFinance:boolean,saleId?:Sale['id']){
 if(!canFinance)throw new Error('Кассовые операции запрещены вашей ролью.');
 const records=posRecords(state,employees,scope),active=state.shifts.find(shift=>!shift.closed);
 if(!active||!records.shifts.some(shift=>shift.id===active.id))throw new Error('Для операции нужна ваша открытая смена.');
 if(saleId&&!records.sales.some(sale=>sale.id===saleId))throw new Error('Этот чек недоступен вашей роли.');
 return active;
}
export function posOpeningCashier(employees:Employee[],scope:PosScope,requestedId:string,canFinance:boolean){
 if(!canFinance)throw new Error('Кассовые операции запрещены вашей ролью.');
 if(!employees.some(employee=>employee.id===scope.actorId&&employee.status==='Активен'))throw new Error('Аккаунт сотрудника недоступен.');
 const restricted=scope.ownOnly||!scope.canReadCompanyFinance;
 if(restricted&&requestedId!==scope.actorId)throw new Error('Можно открыть смену только на своё имя.');
 const cashier=employees.find(employee=>employee.id===requestedId&&employee.status==='Активен');
 if(!cashier)throw new Error('Выберите активного кассира.');
 return cashier;
}
