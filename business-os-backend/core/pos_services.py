"""Adapted POS atomic/Decimal/locking invariants; all authority comes from a workspace actor."""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo
from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from .access import can, require
from .models import (Coupon, Customer, Payment, Product, Refund, RefundItem, Register,
                     Sale, SaleItem, Shift, Stock, StockMovement, Warehouse)
from .services import Conflict, audit

ZERO = Decimal("0")


def money(value):
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def payload_hash(data):
    normalized = {key: value for key, value in data.items() if key != "request_id"}
    for key in ("items", "payments"):
        if key in normalized:
            normalized[key] = sorted(normalized[key], key=lambda row: json.dumps(row, sort_keys=True, default=str))
    return hashlib.sha256(json.dumps(normalized, sort_keys=True, default=str).encode()).hexdigest()


def replay(record, actor, digest):
    if record:
        owner = record.actor_id if isinstance(record, StockMovement) else record.cashier_id
        if owner != actor.id or record.payload_hash != digest:
            raise Conflict("Этот requestId уже использован для другой операции.")
    return record


def financial_access(actor):
    require(actor, "pos", "finance")


def sales_scope(actor, queryset):
    require(actor, "pos")
    return queryset.filter(workspace=actor.workspace) if can(actor, "pos", "manageTeam") else queryset.filter(
        workspace=actor.workspace, cashier=actor)


def own_open_shift(actor, id):
    shift = Shift.objects.select_for_update().filter(pk=id, workspace=actor.workspace, cashier=actor).first()
    if shift is None or shift.closed_at:
        raise Conflict("Откройте собственную смену перед операцией.")
    return shift


def expected_cash(shift):
    received = Payment.objects.filter(sale__shift=shift, method="cash").aggregate(value=Sum("amount"))["value"] or ZERO
    returned = Refund.objects.filter(shift=shift, payment_method="cash").aggregate(value=Sum("amount"))["value"] or ZERO
    return money(shift.opening_cash + received - returned)


@transaction.atomic
def open_shift(actor, data):
    financial_access(actor)
    candidate = Register.objects.filter(pk=data["register_id"], workspace=actor.workspace, deleted_at=None).first()
    if not candidate:
        raise ValidationError({"registerId": "Касса недоступна."})
    warehouse = Warehouse.objects.select_for_update().filter(pk=candidate.warehouse_id, workspace=actor.workspace,
                                                            deleted_at=None).first()
    register = Register.objects.select_for_update().filter(pk=candidate.id, workspace=actor.workspace,
                                                           warehouse=warehouse, deleted_at=None).first() if warehouse else None
    if not register:
        raise ValidationError({"registerId": "Касса недоступна. Обновите список касс."})
    if Shift.objects.filter(workspace=actor.workspace, closed_at=None).filter(
        Q(cashier=actor) |
        Q(register=register)
    ).exists():
        raise Conflict("У сотрудника или кассы уже есть открытая смена.")
    shift = Shift.objects.create(workspace=actor.workspace, cashier=actor, register=register,
                                  warehouse=register.warehouse, opening_cash=data["opening_cash"])
    audit(actor, "shift.opened", shift)
    return shift


@transaction.atomic
def close_shift(actor, id, data):
    financial_access(actor)
    shift = own_open_shift(actor, id)
    if shift.version != data["version"]:
        raise Conflict()
    shift.expected_cash, shift.actual_cash = expected_cash(shift), data["actual_cash"]
    shift.closed_at, shift.version = timezone.now(), shift.version + 1
    shift.save()
    audit(actor, "shift.closed", shift, {"expectedCash": str(shift.expected_cash), "actualCash": str(shift.actual_cash)})
    return shift


def check_quantity(product, quantity):
    if product.product_type == "goods" and not product.weighted and quantity != quantity.to_integral_value():
        raise ValidationError({"quantity": "Для штучного товара укажите целое количество."})


def write_stock(actor, product, warehouse, delta, kind, reference_id, **extra):
    # Callers lock products in UUID order before stock rows. Missing balances are serialized by product lock.
    stock, _ = Stock.objects.select_for_update().get_or_create(product=product, warehouse=warehouse,
        defaults={"workspace": actor.workspace, "quantity": ZERO, "version": 0})
    if stock.workspace_id != actor.workspace_id:
        raise Conflict("Остаток не принадлежит workspace.")
    if stock.quantity + delta > Decimal("99999999999.999"):
        raise ValidationError("Остаток превышает допустимый.")
    if stock.quantity + delta < 0:
        raise Conflict("Недостаточно остатка товара: " + product.name)
    stock.quantity += delta
    stock.version += 1
    stock.save()
    return StockMovement.objects.create(workspace=actor.workspace, actor=actor, product=product,
        warehouse=warehouse, kind=kind, quantity=delta, balance_after=stock.quantity,
        reference_id=reference_id, **extra)


@transaction.atomic
def adjust_stock(actor, data):
    require(actor, "inventory", "inventory")
    digest = payload_hash(data)
    previous = replay(StockMovement.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    warehouse = Warehouse.objects.select_for_update().filter(pk=data["warehouse_id"], workspace=actor.workspace, deleted_at=None).first()
    product = Product.objects.select_for_update().filter(pk=data["product_id"], workspace=actor.workspace,
                                                          deleted_at=None, product_type="goods").first()
    if not product or not warehouse:
        raise ValidationError("Товар или склад недоступен.")
    previous = replay(StockMovement.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    check_quantity(product, data["quantity"])
    stock = Stock.objects.select_for_update().filter(product=product, warehouse=warehouse).first()
    if data["stock_version"] != (stock.version if stock else 0):
        raise Conflict("Остаток изменился. Обновите его перед проведением.")
    current = stock.quantity if stock else ZERO
    kind = data["kind"]
    delta = data["quantity"] - current if kind == "correction" else data["quantity"] * (-1 if kind == "write_off" else 1)
    movement = write_stock(actor, product, warehouse, delta, kind, data["request_id"],
        request_id=data["request_id"], payload_hash=digest, note=data["note"])
    audit(actor, "stock." + kind, movement, {"delta": str(delta), "balance": str(movement.balance_after)})
    return movement, True


def coupon_discount(actor, coupon, customer, subtotal):
    today = timezone.now().astimezone(ZoneInfo(actor.workspace.time_zone)).date()
    if not customer or coupon.customer_id != customer.id or not coupon.active or coupon.deleted_at:
        raise ValidationError({"couponId": "Купон недоступен этому клиенту."})
    if coupon.expires_at and coupon.expires_at < today:
        raise ValidationError({"couponId": "Срок купона истёк."})
    if coupon.value <= 0 or coupon.kind not in ("fixed", "percent") or coupon.kind == "percent" and coupon.value > 100:
        raise ValidationError({"couponId": "Некорректная скидка купона."})
    return money(min(subtotal, subtotal * coupon.value / 100 if coupon.kind == "percent" else coupon.value))


@transaction.atomic
def complete_sale(actor, data):
    financial_access(actor)
    digest = payload_hash(data)
    previous = replay(Sale.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    shift = own_open_shift(actor, data["shift_id"])
    previous = replay(Sale.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    inputs = {row["product_id"]: row for row in data["items"]}
    products = list(Product.objects.select_for_update().filter(id__in=inputs, workspace=actor.workspace,
                                                               deleted_at=None).order_by("id"))
    if len(products) != len(inputs):
        raise ValidationError({"items": "Один из товаров недоступен."})
    lines = []
    for product in products:
        line = inputs[product.id]
        check_quantity(product, line["quantity"])
        if line["free_price"] is not None and not product.is_free_price:
            raise ValidationError({"freePrice": "У товара не включена свободная цена."})
        price = line["free_price"] if line["free_price"] is not None else product.price
        lines.append({"product": product, "quantity": line["quantity"], "price": price,
                      "subtotal": money(price * line["quantity"])})
    subtotal = sum((row["subtotal"] for row in lines), ZERO)
    if subtotal > Decimal("999999999999.99"):
        raise ValidationError({"items": "Сумма чека превышает допустимую."})
    customer = None
    if data["customer_id"]:
        customer = Customer.objects.select_for_update().filter(pk=data["customer_id"], workspace=actor.workspace,
                                                                 deleted_at=None).first()
        if not customer:
            raise ValidationError({"customerId": "Клиент недоступен."})
    coupon = None
    discount = data["discount_amount"]
    if data["coupon_id"]:
        coupon = Coupon.objects.select_for_update().filter(pk=data["coupon_id"], workspace=actor.workspace).first()
        if not coupon:
            raise ValidationError({"couponId": "Купон недоступен."})
        discount = coupon_discount(actor, coupon, customer, subtotal)
    if discount > subtotal:
        raise ValidationError({"discountAmount": "Скидка превышает сумму чека."})
    total = money(subtotal - discount)
    if sum((row["amount"] for row in data["payments"]), ZERO) != total:
        raise ValidationError({"payments": "Сумма оплат должна совпадать с итогом чека."})
    sale = Sale.objects.create(workspace=actor.workspace, request_id=data["request_id"], payload_hash=digest,
        shift=shift, cashier=actor, warehouse=shift.warehouse, customer=customer,
        customer_name=customer.name if customer else "", customer_phone=customer.phone if customer else "",
        coupon=coupon, coupon_code=coupon.code if coupon else "", subtotal=subtotal, discount=discount,
        total=total, currency=actor.workspace.currency)
    allocated_total, cumulative_subtotal = ZERO, ZERO
    for line in lines:
        product = line["product"]
        cumulative_subtotal += line["subtotal"]
        cumulative_discount = money(discount * cumulative_subtotal / subtotal) if subtotal else ZERO
        allocated = cumulative_discount - allocated_total
        allocated_total = cumulative_discount
        SaleItem.objects.create(sale=sale, product=product, name=product.name, sku=product.sku,
            barcode=product.barcode, tracks_stock=product.product_type != "service", quantity=line["quantity"],
            price=line["price"], cost=product.cost, discount=allocated, total=line["subtotal"] - allocated)
        if product.product_type != "service":
            write_stock(actor, product, shift.warehouse, -line["quantity"], "sale", sale.id)
    Payment.objects.bulk_create([Payment(sale=sale, **row) for row in data["payments"]])
    shift.version += 1
    shift.save(update_fields=["version", "updated_at"])
    audit(actor, "sale.completed", sale, {"total": str(total), "customerId": str(customer.id) if customer else None})
    return sale, True


@transaction.atomic
def refund_sale(actor, sale_id, data):
    financial_access(actor)
    digest = payload_hash({**data, "sale_id": sale_id})
    previous = replay(Refund.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    shift = own_open_shift(actor, data["shift_id"])
    sale = Sale.objects.select_for_update().filter(pk=sale_id, workspace=actor.workspace).first()
    if not sale or sale.cashier_id != actor.id and not can(actor, "pos", "manageTeam"):
        raise PermissionDenied("Нет доступа к возврату этого чека.")
    previous = replay(Refund.objects.filter(workspace=actor.workspace, request_id=data["request_id"]).first(), actor, digest)
    if previous:
        return previous, False
    if sale.version != data["version"]:
        raise Conflict()
    if sale.status not in ("completed", "partially_refunded"):
        raise Conflict("Этот чек уже возвращён.")
    requested = {row["sale_item_id"]: row["quantity"] for row in data["items"]}
    items = list(sale.items.filter(id__in=requested).order_by("product_id"))
    if len(items) != len(requested):
        raise ValidationError({"items": "Позиция не принадлежит чеку."})
    products = {product.id: product for product in Product.objects.select_for_update().filter(
        id__in=[item.product_id for item in items], workspace=actor.workspace).order_by("id")}
    refund_rows, total = [], ZERO
    for item in items:
        quantity = requested[item.id]
        check_quantity(products[item.product_id], quantity)
        if item.returned + quantity > item.quantity:
            raise ValidationError({"items": "Возврат превышает невозвращённое количество."})
        cumulative = money(item.total * (item.returned + quantity) / item.quantity)
        amount = cumulative - item.refunded
        refund_rows.append((item, quantity, amount))
        total += amount
    refund = Refund.objects.create(workspace=actor.workspace, request_id=data["request_id"], payload_hash=digest,
        sale=sale, shift=shift, cashier=actor, reason=data["reason"], amount=total, payment_method=data["payment_method"])
    for item, quantity, amount in refund_rows:
        RefundItem.objects.create(refund=refund, sale_item=item, quantity=quantity, amount=amount)
        item.returned += quantity
        item.refunded += amount
        item.save(update_fields=["returned", "refunded"])
        if item.tracks_stock:
            write_stock(actor, products[item.product_id], sale.warehouse, quantity, "return", refund.id)
    sale.refunded += total
    sale.status = "refunded" if not sale.items.exclude(returned=F("quantity")).exists() else "partially_refunded"
    sale.version += 1
    sale.save(update_fields=["refunded", "status", "version", "updated_at"])
    shift.version += 1
    shift.save(update_fields=["version", "updated_at"])
    audit(actor, "sale.refunded", sale, {"refundId": str(refund.id), "amount": str(total), "paymentMethod": refund.payment_method})
    return refund, True


@transaction.atomic
def save_catalog(actor, model, data, record=None, delete=False):
    from .services import update_record
    if model is Coupon:
        from .access import require_customers
        require_customers(actor, 'edit')
        customer_id = data.get('customer_id', record.customer_id if record else None)
        if not Customer.objects.select_for_update().filter(pk=customer_id, workspace=actor.workspace,
                                                           deleted_at=None).first():
            raise ValidationError({'customerId': 'Клиент недоступен.'})
        if record and customer_id != record.customer_id:
            raise ValidationError({'customerId': 'Создайте отдельный купон для другого клиента.'})
        kind, value = data.get('kind', record.kind if record else None), data.get('value', record.value if record else ZERO)
        if kind == 'percent' and value > 100:
            raise ValidationError({'value': 'Процент не может превышать 100.'})
    else:
        require(actor, 'inventory', 'remove' if delete else 'edit' if record else 'create')
    if model is Register and 'warehouse_id' in data:
        if not Warehouse.objects.select_for_update().filter(pk=data['warehouse_id'], workspace=actor.workspace,
                                                             deleted_at=None).first():
            raise ValidationError({'warehouseId': 'Склад недоступен.'})
    if record:
        record = model.objects.select_for_update().get(pk=record.id)
        if isinstance(record, Product):
            if any(data.get(field, getattr(record, field)) != getattr(record, field) for field in ('product_type', 'weighted')):
                if record.stocks.exclude(quantity=0).exists() or SaleItem.objects.filter(product=record).exists():
                    raise Conflict('Нельзя изменить тип или единицу учёта товара с остатками или продажами.')
            if delete and record.stocks.exclude(quantity=0).exists():
                raise Conflict('Перед архивированием товара проведите остатки.')
        if isinstance(record, (Register, Warehouse)):
            field = 'register' if isinstance(record, Register) else 'warehouse'
            if (delete or 'warehouse_id' in data) and Shift.objects.filter(**{field: record}, closed_at=None).exists():
                raise Conflict('Сначала закройте связанную смену.')
            if delete and isinstance(record, Warehouse) and Stock.objects.filter(warehouse=record).exclude(quantity=0).exists():
                raise Conflict('Перед архивированием склада проведите остатки.')
        return update_record(actor, record, data, model.__name__.lower() + ('.archived' if delete else '.updated'), delete)
    if 'version' in data:
        raise ValidationError({'version': 'Не передавайте версию при создании.'})
    record = model.objects.create(workspace=actor.workspace, **data)
    audit(actor, model.__name__.lower() + '.created', record)
    return record
