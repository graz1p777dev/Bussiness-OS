import type {Entity} from './data.ts';
export function resolveTaskLinks(deals:Entity[],clientId:string,dealId:string){
 const deal=dealId?deals.find(deal=>deal.id===dealId):undefined;
 if(dealId&&!deal)throw new Error('Выбранная сделка больше не существует.');
 const customerId=deal?(deal.customerId||deal.id):undefined;
 if(clientId&&!deals.some(deal=>(deal.customerId||deal.id)===clientId))throw new Error('Выбранный клиент больше не существует.');
 if(clientId&&customerId&&clientId!==customerId)throw new Error('Сделка принадлежит другому клиенту. Выберите связанные записи.');
 return {clientId:clientId||customerId||undefined,dealId:deal?.id};
}
