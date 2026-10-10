from uuid import UUID
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response
from .access import can, require, require_customers
from .models import Coupon, Product, Register, Sale, Shift, Stock, StockMovement, Warehouse
from .pos_serializers import (CloseShiftInput, CompleteSaleInput, CouponInput, CouponOutput,
    OpenShiftInput, ProductInput, ProductOutput, ProductPickerOutput, RefundInput, RefundOutput,
    RegisterInput, RegisterOutput, SaleOutput, ShiftOutput, StockAdjustmentInput,
    StockMovementOutput, StockOutput, WarehouseInput, WarehouseOutput)
from .pos_services import (adjust_stock, close_shift, complete_sale, open_shift, refund_sale,
                           sales_scope, save_catalog)
from .serializers import VersionInput
from .services import Conflict
from .views import WorkspaceView, paginated, validated


def unique_write(operation):
    try:
        return operation()
    except IntegrityError:
        raise Conflict('Запись с таким идентификатором уже существует или операция конфликтует с текущим состоянием.') from None


def id_filter(request, rows, name, field):
    value = request.query_params.get(name)
    if value:
        try:
            rows = rows.filter(**{field: UUID(value)})
        except ValueError:
            raise ValidationError({name: 'Некорректный ID.'}) from None
    return rows


def catalog_read(actor):
    if not can(actor, 'inventory'):
        require(actor, 'pos')


class CatalogView(WorkspaceView):
    model = Product
    input = ProductInput
    output = ProductOutput

    def read_guard(self):
        require(self.actor, 'inventory')

    def rows(self):
        return self.model.objects.filter(workspace=self.actor.workspace, deleted_at=None)

    def get(self, request, id=None):
        self.read_guard()
        rows = self.rows()
        if id:
            return Response(self.output(get_object_or_404(rows, pk=id)).data)
        query = request.query_params.get('q', '').strip()
        if query:
            search = Q(name__icontains=query)
            if self.model is Product:
                search |= Q(sku__icontains=query) | Q(barcode__icontains=query)
            rows = rows.filter(search)
        return paginated(request, rows, self.output, f'{self.actor.workspace_id}:{self.model.__name__}')

    def post(self, request, id=None):
        if id:
            raise MethodNotAllowed('POST')
        require(self.actor, 'inventory', 'create')
        data = validated(self.input, request)
        record = unique_write(lambda: save_catalog(self.actor, self.model, data))
        return Response(self.output(record).data, status=201)

    def patch(self, request, id=None):
        if not id:
            raise MethodNotAllowed('PATCH')
        require(self.actor, 'inventory', 'edit')
        record = get_object_or_404(self.rows(), pk=id)
        data = validated(self.input, request, True)
        result = unique_write(lambda: save_catalog(self.actor, self.model, data, record))
        return Response(self.output(result).data)

    def delete(self, request, id=None):
        if not id:
            raise MethodNotAllowed('DELETE')
        require(self.actor, 'inventory', 'remove')
        save_catalog(self.actor, self.model, validated(VersionInput, request), get_object_or_404(self.rows(), pk=id), True)
        return Response(status=204)


class PosProductsView(CatalogView):
    http_method_names = ['get', 'options']
    output = ProductPickerOutput

    def read_guard(self):
        require(self.actor, 'pos')


class WarehousesView(CatalogView):
    model, input, output = Warehouse, WarehouseInput, WarehouseOutput

    def read_guard(self):
        catalog_read(self.actor)


class RegistersView(CatalogView):
    model, input, output = Register, RegisterInput, RegisterOutput

    def read_guard(self):
        catalog_read(self.actor)


class StocksView(WorkspaceView):
    def get(self, request):
        catalog_read(self.actor)
        rows = Stock.objects.filter(workspace=self.actor.workspace)
        rows = id_filter(request, rows, 'warehouseId', 'warehouse_id')
        rows = id_filter(request, rows, 'productId', 'product_id')
        return paginated(request, rows, StockOutput,
            f'{self.actor.workspace_id}:stocks:{request.query_params.get("warehouseId", "")}:{request.query_params.get("productId", "")}')


class StockMovementsView(WorkspaceView):
    def get(self, request):
        require(self.actor, 'inventory')
        rows = StockMovement.objects.filter(workspace=self.actor.workspace)
        rows = id_filter(request, rows, 'productId', 'product_id')
        return paginated(request, rows, StockMovementOutput,
                         f'{self.actor.workspace_id}:movements:{request.query_params.get("productId", "")}')

    def post(self, request):
        require(self.actor, 'inventory', 'inventory')
        record, created = unique_write(lambda: adjust_stock(self.actor, validated(StockAdjustmentInput, request)))
        return Response(StockMovementOutput(record).data, status=201 if created else 200)


class ShiftsView(WorkspaceView):
    def get(self, request):
        return paginated(request, sales_scope(self.actor, Shift.objects.all()), ShiftOutput,
                         f'{self.actor.workspace_id}:shifts:{self.actor.id}')

    def post(self, request):
        record = unique_write(lambda: open_shift(self.actor, validated(OpenShiftInput, request)))
        return Response(ShiftOutput(record).data, status=201)


class CurrentShiftView(WorkspaceView):
    def get(self, request):
        require(self.actor, 'pos')
        record = Shift.objects.filter(workspace=self.actor.workspace, cashier=self.actor, closed_at=None).first()
        return Response({'shift': ShiftOutput(record).data if record else None})


class CloseShiftView(WorkspaceView):
    def post(self, request, id):
        record = close_shift(self.actor, id, validated(CloseShiftInput, request))
        return Response(ShiftOutput(record).data)


class SalesView(WorkspaceView):
    def get(self, request, id=None):
        rows = sales_scope(self.actor, Sale.objects.all()).prefetch_related('items', 'payments', 'refunds__items')
        if id:
            return Response(SaleOutput(get_object_or_404(rows, pk=id)).data)
        rows = id_filter(request, rows, 'customerId', 'customer_id')
        rows = id_filter(request, rows, 'shiftId', 'shift_id')
        return paginated(request, rows, SaleOutput,
            f'{self.actor.workspace_id}:sales:{self.actor.id}:{request.query_params.get("customerId", "")}:{request.query_params.get("shiftId", "")}')


class CompleteSaleView(WorkspaceView):
    def post(self, request):
        record, created = unique_write(lambda: complete_sale(self.actor, validated(CompleteSaleInput, request)))
        return Response(SaleOutput(record).data, status=201 if created else 200)


class RefundSaleView(WorkspaceView):
    def post(self, request, id):
        record, created = unique_write(lambda: refund_sale(self.actor, id, validated(RefundInput, request)))
        return Response(RefundOutput(record).data, status=201 if created else 200)


class CouponsView(WorkspaceView):
    def get(self, request, id=None):
        require_customers(self.actor)
        rows = id_filter(request, Coupon.objects.filter(workspace=self.actor.workspace, deleted_at=None), 'customerId', 'customer_id')
        if id:
            return Response(CouponOutput(get_object_or_404(rows, pk=id)).data)
        return paginated(request, rows, CouponOutput,
                         f'{self.actor.workspace_id}:coupons:{request.query_params.get("customerId", "")}')

    def post(self, request, id=None):
        if id:
            raise MethodNotAllowed('POST')
        require_customers(self.actor, 'edit')
        record = unique_write(lambda: save_catalog(self.actor, Coupon, validated(CouponInput, request)))
        return Response(CouponOutput(record).data, status=201)

    def patch(self, request, id=None):
        if not id:
            raise MethodNotAllowed('PATCH')
        require_customers(self.actor, 'edit')
        record = get_object_or_404(Coupon, pk=id, workspace=self.actor.workspace, deleted_at=None)
        record = unique_write(lambda: save_catalog(self.actor, Coupon, validated(CouponInput, request, True), record))
        return Response(CouponOutput(record).data)


class PosCouponsView(WorkspaceView):
    def get(self, request, id):
        require(self.actor, 'pos')
        rows = Coupon.objects.filter(workspace=self.actor.workspace, customer_id=id, customer__deleted_at=None,
                                     deleted_at=None, active=True)
        return paginated(request, rows, CouponOutput, f'{self.actor.workspace_id}:pos-coupons:{id}')
