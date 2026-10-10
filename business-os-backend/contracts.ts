/** API /api/os/v1 contracts. These are backend DTOs, not the legacy frontend Entity. */
export type UUID = string;
export type DecimalMoney = string;
export type Action = 'create'|'edit'|'remove'|'export'|'ai'|'finance'|'inventory'|'manageTeam'|'password'|'production';
export type PagePermissions = Record<string, Record<Action, boolean>>;
export type Page<T> = {items:T[];nextCursor:string|null};
export type LoginInput = {email:string;password:string};
export type LoginOutput = {csrfToken:string;workspaces:{id:UUID;name:string;employeeId:UUID}[]};
export type Me = {employeeId:UUID;workspaceId:UUID;profile:{name:string;email:string;role:string;status:'Активен'};permissions:PagePermissions};
export type CustomerInput = {name:string;phone?:string;username?:string;city?:string;note?:string;tags?:string[];customFields?:Record<string,unknown>};
export type Customer = Required<CustomerInput> & {id:UUID;version:number;createdAt:string;updatedAt:string};
export type CustomerPatch = Partial<CustomerInput> & {version:number};
export type PosCustomerInput = Pick<CustomerInput,'name'|'phone'>;
export type CustomerPickerItem = {id:UUID;name:string;phone:string};
export type Stage = {id:UUID;name:string;color:string;sortOrder:number};
export type Pipeline = {id:UUID;name:string;stages:Stage[]};
export type DealInput = {customerId:UUID;pipelineId:UUID;stageId:UUID;employeeId?:UUID|null;title:string;amount?:DecimalMoney;currency?:'KGS'|'USD'|'RUB';note?:string;customFields?:Record<string,unknown>};
export type Deal = Required<DealInput> & {id:UUID;version:number;createdAt:string;updatedAt:string};
export type DealPatch = Partial<DealInput> & {version:number};
export type DealMove = {stageId:UUID;version:number};
export type ArchiveInput = {version:number};
export type DealEvent = {id:UUID;action:string;employeeId:UUID;details:Record<string,unknown>;createdAt:string};

/** Explicit future mapping: Customer.id → Entity.customerId; UUIDs must not be inferred from phone/name.
 * Deal pipelineId/stageId must be resolved through /pipelines to legacy pipeline/status labels.
 * employeeId is membership UUID; never send the frontend's owner display name as authority.
 * Money is serialized as decimal text; convert for display only.
 * Response.validation errors are field → string[]; auth/conflict errors have detail:string.
 */

// POS decimal strings are not JS floating-point balances. Mutations use request UUIDs, never receipt IDs.
export type DecimalQuantity = string;
export type ProductInput = {name:string;sku:string;price:DecimalMoney;cost?:DecimalMoney;barcode?:string;category?:string;minimum?:DecimalQuantity;unit?:string;productType?:'goods'|'service';weighted?:boolean;isFreePrice?:boolean};
export type Product = Required<ProductInput> & {id:UUID;version:number};
export type PosProduct = Omit<Product,'cost'>;
export type ProductPatch = Partial<ProductInput> & {version:number};
export type WarehouseInput = {name:string;address?:string};
export type Warehouse = Required<WarehouseInput> & {id:UUID;version:number};
export type RegisterInput = {name:string;warehouseId:UUID};
export type Register = RegisterInput & {id:UUID;version:number};
export type Stock = {id:UUID;productId:UUID;warehouseId:UUID;quantity:DecimalQuantity;version:number};
export type StockAdjustment = {requestId:UUID;productId:UUID;warehouseId:UUID;kind:'receipt'|'write_off'|'correction';quantity:DecimalQuantity;stockVersion:number;note?:string};
export type StockMovement = {id:UUID;productId:UUID;warehouseId:UUID;employeeId:UUID;kind:StockAdjustment['kind']|'sale'|'return';quantity:DecimalQuantity;balanceAfter:DecimalQuantity;referenceId:UUID;requestId:UUID|null;note:string;createdAt:string};
export type ShiftOpen = {registerId:UUID;openingCash?:DecimalMoney};
export type ShiftClose = {version:number;actualCash:DecimalMoney};
export type Shift = {id:UUID;employeeId:UUID;registerId:UUID;warehouseId:UUID;openingCash:DecimalMoney;actualCash:DecimalMoney|null;expectedCash:DecimalMoney;openedAt:string;closedAt:string|null;version:number};
export type CouponInput = {customerId:UUID;code:string;kind:'percent'|'fixed';value:DecimalMoney;expiresAt?:string|null;active?:boolean};
export type Coupon = Required<CouponInput> & {id:UUID;reusable:true;version:number};
export type CouponPatch = Partial<Omit<CouponInput,'customerId'>> & {version:number};
export type PaymentMethod = 'cash'|'card'|'qr';
export type Payment = {method:PaymentMethod;amount:DecimalMoney};
export type SaleLineInput = {productId:UUID;quantity:DecimalQuantity;freePrice?:DecimalMoney|null};
export type SaleComplete = {requestId:UUID;shiftId:UUID;customerId?:UUID|null;couponId?:UUID|null;discountAmount?:DecimalMoney;items:SaleLineInput[];payments:Payment[]};
export type SaleItem = {id:UUID;productId:UUID;name:string;sku:string;barcode:string;tracksStock:boolean;quantity:DecimalQuantity;price:DecimalMoney;discount:DecimalMoney;total:DecimalMoney;returned:DecimalQuantity;refunded:DecimalMoney};
export type RefundInput = {requestId:UUID;shiftId:UUID;version:number;items:{saleItemId:UUID;quantity:DecimalQuantity}[];reason:string;paymentMethod?:PaymentMethod};
export type Refund = {id:UUID;requestId:UUID;saleId:UUID;shiftId:UUID;employeeId:UUID;paymentMethod:PaymentMethod;reason:string;amount:DecimalMoney;createdAt:string;items:{saleItemId:UUID;quantity:DecimalQuantity;amount:DecimalMoney}[];version:number};
export type Sale = {id:UUID;requestId:UUID;shiftId:UUID;employeeId:UUID;warehouseId:UUID;customerId:UUID|null;customerName:string;customerPhone:string;couponId:UUID|null;couponCode:string;subtotal:DecimalMoney;discount:DecimalMoney;total:DecimalMoney;refunded:DecimalMoney;currency:string;status:'completed'|'partially_refunded'|'refunded';createdAt:string;items:SaleItem[];payments:Payment[];refunds:Refund[];version:number};
