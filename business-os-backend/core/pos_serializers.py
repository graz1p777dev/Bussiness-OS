from decimal import Decimal
from rest_framework import serializers as s
from .models import (Coupon, Payment, Product, Refund, RefundItem, Register, Sale, SaleItem,
                     Shift, Stock, StockMovement, Warehouse)
from .pos_services import expected_cash
from .serializers import StrictInput, VersionInput


def amount(**kwargs):
    return s.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal('0'), **kwargs)


def quantity(**kwargs):
    return s.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0.001'), **kwargs)


class ProductInput(StrictInput):
    name = s.CharField(max_length=255)
    sku = s.CharField(max_length=80)
    barcode = s.CharField(max_length=80, required=False, allow_blank=True)
    category = s.CharField(max_length=120, required=False, allow_blank=True)
    price = amount()
    cost = amount(required=False)
    minimum = s.DecimalField(max_digits=14, decimal_places=3, min_value=0, required=False)
    unit = s.CharField(max_length=24, required=False)
    productType = s.ChoiceField(source='product_type', choices=['goods', 'service'], required=False)
    weighted = s.BooleanField(required=False)
    isFreePrice = s.BooleanField(source='is_free_price', required=False)
    version = s.IntegerField(min_value=1, required=False)


class WarehouseInput(StrictInput):
    name = s.CharField(max_length=160)
    address = s.CharField(max_length=255, required=False, allow_blank=True)
    version = s.IntegerField(min_value=1, required=False)


class RegisterInput(StrictInput):
    name = s.CharField(max_length=120)
    warehouseId = s.UUIDField(source='warehouse_id')
    version = s.IntegerField(min_value=1, required=False)


class StockAdjustmentInput(StrictInput):
    requestId = s.UUIDField(source='request_id')
    productId = s.UUIDField(source='product_id')
    warehouseId = s.UUIDField(source='warehouse_id')
    kind = s.ChoiceField(choices=['receipt', 'write_off', 'correction'])
    quantity = s.DecimalField(max_digits=14, decimal_places=3, min_value=0)
    stockVersion = s.IntegerField(source='stock_version', min_value=0)
    note = s.CharField(max_length=1000, allow_blank=True, default='')

    def validate(self, data):
        if data['kind'] != 'correction' and data['quantity'] == 0:
            raise s.ValidationError({'quantity': 'Укажите положительное количество.'})
        return data


class OpenShiftInput(StrictInput):
    registerId = s.UUIDField(source='register_id')
    openingCash = amount(source='opening_cash', default=Decimal('0'))


class CloseShiftInput(VersionInput):
    actualCash = amount(source='actual_cash')


class CouponInput(StrictInput):
    customerId = s.UUIDField(source='customer_id')
    code = s.CharField(max_length=80)
    kind = s.ChoiceField(choices=['percent', 'fixed'])
    value = s.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal('0.01'))
    expiresAt = s.DateField(source='expires_at', allow_null=True, required=False)
    active = s.BooleanField(required=False)
    version = s.IntegerField(min_value=1, required=False)


class SaleLineInput(StrictInput):
    productId = s.UUIDField(source='product_id')
    quantity = quantity()
    freePrice = amount(source='free_price', default=None, allow_null=True)


class PaymentInput(StrictInput):
    method = s.ChoiceField(choices=['cash', 'card', 'qr'])
    amount = s.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal('0.01'))


class CompleteSaleInput(StrictInput):
    requestId = s.UUIDField(source='request_id')
    shiftId = s.UUIDField(source='shift_id')
    customerId = s.UUIDField(source='customer_id', default=None, allow_null=True)
    couponId = s.UUIDField(source='coupon_id', default=None, allow_null=True)
    discountAmount = amount(source='discount_amount', default=Decimal('0'))
    items = SaleLineInput(many=True, min_length=1, max_length=200)
    payments = PaymentInput(many=True, max_length=3)

    def validate(self, data):
        if len({row['product_id'] for row in data['items']}) != len(data['items']):
            raise s.ValidationError({'items': 'Объедините повторяющиеся товары в одну позицию.'})
        if len({row['method'] for row in data['payments']}) != len(data['payments']):
            raise s.ValidationError({'payments': 'Способ оплаты не должен повторяться.'})
        return data


class RefundLineInput(StrictInput):
    saleItemId = s.UUIDField(source='sale_item_id')
    quantity = quantity()


class RefundInput(VersionInput):
    requestId = s.UUIDField(source='request_id')
    shiftId = s.UUIDField(source='shift_id')
    items = RefundLineInput(many=True, min_length=1, max_length=200)
    reason = s.CharField(max_length=1000)
    paymentMethod = s.ChoiceField(source='payment_method', choices=['cash', 'card', 'qr'], default='cash')

    def validate(self, data):
        if len({row['sale_item_id'] for row in data['items']}) != len(data['items']):
            raise s.ValidationError({'items': 'Позиция возврата повторяется.'})
        return data


class ProductPickerOutput(s.ModelSerializer):
    productType = s.CharField(source='product_type')
    isFreePrice = s.BooleanField(source='is_free_price')

    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'barcode', 'category', 'price', 'minimum', 'unit', 'productType',
                  'weighted', 'isFreePrice', 'version']


class ProductOutput(ProductPickerOutput):
    class Meta(ProductPickerOutput.Meta):
        fields = [*ProductPickerOutput.Meta.fields, 'cost']


class WarehouseOutput(s.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'address', 'version']


class RegisterOutput(s.ModelSerializer):
    warehouseId = s.UUIDField(source='warehouse_id')

    class Meta:
        model = Register
        fields = ['id', 'name', 'warehouseId', 'version']


class StockOutput(s.ModelSerializer):
    productId = s.UUIDField(source='product_id')
    warehouseId = s.UUIDField(source='warehouse_id')

    class Meta:
        model = Stock
        fields = ['id', 'productId', 'warehouseId', 'quantity', 'version']


class StockMovementOutput(s.ModelSerializer):
    productId = s.UUIDField(source='product_id')
    warehouseId = s.UUIDField(source='warehouse_id')
    employeeId = s.UUIDField(source='actor_id')
    referenceId = s.UUIDField(source='reference_id')
    requestId = s.UUIDField(source='request_id', allow_null=True)
    balanceAfter = s.DecimalField(source='balance_after', max_digits=14, decimal_places=3)
    createdAt = s.DateTimeField(source='created_at')

    class Meta:
        model = StockMovement
        fields = ['id', 'productId', 'warehouseId', 'employeeId', 'kind', 'quantity', 'balanceAfter',
                  'referenceId', 'requestId', 'note', 'createdAt']


class ShiftOutput(s.ModelSerializer):
    employeeId = s.UUIDField(source='cashier_id')
    registerId = s.UUIDField(source='register_id')
    warehouseId = s.UUIDField(source='warehouse_id')
    openingCash = amount(source='opening_cash')
    actualCash = amount(source='actual_cash', allow_null=True)
    expectedCash = s.SerializerMethodField()
    openedAt = s.DateTimeField(source='created_at')
    closedAt = s.DateTimeField(source='closed_at', allow_null=True)

    def get_expectedCash(self, record):
        return str(record.expected_cash if record.closed_at else expected_cash(record))

    class Meta:
        model = Shift
        fields = ['id', 'employeeId', 'registerId', 'warehouseId', 'openingCash', 'actualCash',
                  'expectedCash', 'openedAt', 'closedAt', 'version']


class CouponOutput(s.ModelSerializer):
    customerId = s.UUIDField(source='customer_id')
    expiresAt = s.DateField(source='expires_at', allow_null=True)
    reusable = s.SerializerMethodField()

    def get_reusable(self, record):
        return True

    class Meta:
        model = Coupon
        fields = ['id', 'customerId', 'code', 'kind', 'value', 'expiresAt', 'active', 'reusable', 'version']


class SaleItemOutput(s.ModelSerializer):
    productId = s.UUIDField(source='product_id')
    tracksStock = s.BooleanField(source='tracks_stock')

    class Meta:
        model = SaleItem
        fields = ['id', 'productId', 'name', 'sku', 'barcode', 'tracksStock', 'quantity', 'price',
                  'discount', 'total', 'returned', 'refunded']


class PaymentOutput(s.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['method', 'amount']


class RefundItemOutput(s.ModelSerializer):
    saleItemId = s.UUIDField(source='sale_item_id')

    class Meta:
        model = RefundItem
        fields = ['saleItemId', 'quantity', 'amount']


class RefundOutput(s.ModelSerializer):
    requestId = s.UUIDField(source='request_id')
    saleId = s.UUIDField(source='sale_id')
    shiftId = s.UUIDField(source='shift_id')
    employeeId = s.UUIDField(source='cashier_id')
    paymentMethod = s.CharField(source='payment_method')
    createdAt = s.DateTimeField(source='created_at')
    items = RefundItemOutput(many=True)

    class Meta:
        model = Refund
        fields = ['id', 'requestId', 'saleId', 'shiftId', 'employeeId', 'paymentMethod', 'reason',
                  'amount', 'createdAt', 'items', 'version']


class SaleOutput(s.ModelSerializer):
    requestId = s.UUIDField(source='request_id')
    shiftId = s.UUIDField(source='shift_id')
    employeeId = s.UUIDField(source='cashier_id')
    warehouseId = s.UUIDField(source='warehouse_id')
    customerId = s.UUIDField(source='customer_id', allow_null=True)
    customerName = s.CharField(source='customer_name')
    customerPhone = s.CharField(source='customer_phone')
    couponId = s.UUIDField(source='coupon_id', allow_null=True)
    couponCode = s.CharField(source='coupon_code')
    createdAt = s.DateTimeField(source='created_at')
    items = SaleItemOutput(many=True)
    payments = PaymentOutput(many=True)
    refunds = RefundOutput(many=True)

    class Meta:
        model = Sale
        fields = ['id', 'requestId', 'shiftId', 'employeeId', 'warehouseId', 'customerId', 'customerName',
                  'customerPhone', 'couponId', 'couponCode', 'subtotal', 'discount', 'total', 'refunded',
                  'currency', 'status', 'createdAt', 'items', 'payments', 'refunds', 'version']
