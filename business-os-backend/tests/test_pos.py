from decimal import Decimal
from uuid import uuid4
import pytest
from core.models import (AuditEvent, Coupon, Membership, Payment, Product, Register, Role,
                         Sale, Shift, Stock, StockMovement, User, Warehouse)
from .test_api import BASE, PASSWORD, customer, login, setup  # noqa: F401

pytestmark = pytest.mark.django_db


@pytest.fixture
def pos(setup):  # noqa: F811
    role = setup['role']
    role.pages.append('inventory')
    role.actions.append('inventory')
    role.save()
    client = login(setup['user'])
    warehouse = Warehouse.objects.create(workspace=setup['workspace'], name='Main')
    register = Register.objects.create(workspace=setup['workspace'], name='Main', warehouse=warehouse)
    product = Product.objects.create(workspace=setup['workspace'], name='Original', sku='ONE', price='10.00', cost='4.00')
    result = client.post(BASE + '/stock-movements', {'requestId': str(uuid4()), 'productId': str(product.id),
        'warehouseId': str(warehouse.id), 'kind': 'receipt', 'quantity': '10', 'stockVersion': 0}, format='json')
    assert result.status_code == 201, result.content
    result = client.post(BASE + '/shifts', {'registerId': str(register.id), 'openingCash': '100'}, format='json')
    assert result.status_code == 201, result.content
    return {**setup, 'client': client, 'warehouse': warehouse, 'register': register, 'product': product, 'shift': result.json()}


def sale_data(pos, **extra):
    return {'requestId': str(uuid4()), 'shiftId': pos['shift']['id'],
            'items': [{'productId': str(pos['product'].id), 'quantity': '2'}],
            'payments': [{'method': 'cash', 'amount': '20.00'}], **extra}


def sell(pos, **extra):
    response = pos['client'].post(BASE + '/sales/complete', sale_data(pos, **extra), format='json')
    assert response.status_code == 201, response.content
    return response.json()


def refund_data(pos, sale, **extra):
    return {'requestId': str(uuid4()), 'shiftId': pos['shift']['id'], 'version': sale['version'],
        'items': [{'saleItemId': sale['items'][0]['id'], 'quantity': '1'}], 'reason': 'Customer return', **extra}


def cashier(pos, name='second'):
    role = Role.objects.create(workspace=pos['workspace'], name=name, slug=name, pages=['pos'], actions=['finance'])
    user = User.objects.create_user(name + '@example.test', PASSWORD, name=name)
    member = Membership.objects.create(workspace=pos['workspace'], role=role, user=user)
    register = Register.objects.create(workspace=pos['workspace'], name=name, warehouse=pos['warehouse'])
    client = login(user)
    result = client.post(BASE + '/shifts', {'registerId': str(register.id)}, format='json')
    assert result.status_code == 201, result.content
    return client, member, result.json()


def test_sale_server_prices_customer_and_product_snapshots(pos):
    client = pos['client']
    person = customer(client, name='Before', phone='+996 555 111 222')
    receipt = sell(pos, customerId=person['id'])
    assert receipt['customerId'] == person['id'] and receipt['customerName'] == 'Before'
    assert receipt['customerPhone'] == '996555111222'
    assert receipt['employeeId'] == str(pos['member'].id)
    assert receipt['total'] == '20.00' and receipt['items'][0]['name'] == 'Original'
    assert 'cost' not in receipt['items'][0]
    client.patch(BASE + '/customers/' + person['id'], {'name': 'After', 'version': 1}, format='json')
    changed = client.patch(BASE + '/products/' + str(pos['product'].id), {'name': 'After', 'price': '15', 'version': 1}, format='json')
    assert changed.status_code == 200, changed.content
    assert client.get(BASE + '/sales/' + receipt['id']).json() == receipt
    assert Stock.objects.get(product=pos['product']).quantity == 8
    assert client.delete(BASE + '/customers/' + person['id'], {'version': 2}, format='json').status_code == 409


def test_sale_idempotent_after_shift_close_and_payload_conflict(pos):
    client, data = pos['client'], sale_data(pos)
    first = client.post(BASE + '/sales/complete', data, format='json')
    assert first.status_code == 201
    current = client.get(BASE + '/shifts/current').json()['shift']
    assert client.post(BASE + '/shifts/' + current['id'] + '/close', {'version': current['version'], 'actualCash': '120'}, format='json').status_code == 200
    repeated = client.post(BASE + '/sales/complete', data, format='json')
    assert repeated.status_code == 200 and repeated.json()['id'] == first.json()['id']
    assert Sale.objects.count() == Payment.objects.count() == 1
    assert Stock.objects.get(product=pos['product']).quantity == 8
    data['payments'][0]['amount'] = '21'
    assert client.post(BASE + '/sales/complete', data, format='json').status_code == 409


@pytest.mark.parametrize('change', [
    {'items': []}, {'items': [{'quantity': '1', 'productId': 'invalid'}]},
    {'items': 'oops'}, {'payments': [{'method': 'cash', 'amount': '19'}]},
    {'cashierId': str(uuid4())}, {'discountAmount': '21'},
])
def test_sale_rejects_invalid_input_atomically(pos, change):
    response = pos['client'].post(BASE + '/sales/complete', sale_data(pos, **change), format='json')
    assert response.status_code == 400, response.content
    assert Sale.objects.count() == Payment.objects.count() == 0
    assert Stock.objects.get(product=pos['product']).quantity == 10


def test_duplicates_free_price_fraction_and_insufficient_stock(pos):
    client = pos['client']
    line = {'productId': str(pos['product'].id), 'quantity': '2'}
    for items in [[line, line], [{**line, 'freePrice': '0.01'}], [{**line, 'quantity': '0.5'}], [{**line, 'price': '1'}]]:
        assert client.post(BASE + '/sales/complete', sale_data(pos, items=items), format='json').status_code == 400
    response = client.post(BASE + '/sales/complete', sale_data(pos,
        items=[{**line, 'quantity': '11'}], payments=[{'method': 'cash', 'amount': '110'}]), format='json')
    assert response.status_code == 409
    assert Sale.objects.count() == Payment.objects.count() == 0
    assert Stock.objects.get(product=pos['product']).quantity == 10


def test_audit_failure_rolls_back_sale_stock_payment_and_shift_version(pos, monkeypatch):
    from core import pos_services
    def broken(*args, **kwargs):
        raise RuntimeError('fixture audit unavailable')
    monkeypatch.setattr(pos_services, 'audit', broken)
    with pytest.raises(RuntimeError):
        sell(pos)
    assert Sale.objects.count() == Payment.objects.count() == 0
    assert Stock.objects.get(product=pos['product']).quantity == 10
    assert Shift.objects.get(pk=pos['shift']['id']).version == 1
    assert StockMovement.objects.count() == 1


def test_coupon_reusable_replaces_manual_discount_and_zero_payment(pos):
    client = pos['client']
    person = customer(client)
    response = client.post(BASE + '/coupons', {'customerId': person['id'], 'code': 'GIFT', 'kind': 'percent', 'value': '100'}, format='json')
    assert response.status_code == 201, response.content
    coupon = response.json()
    assert coupon['reusable'] is True
    for _ in range(2):
        receipt = sell(pos, customerId=person['id'], couponId=coupon['id'], discountAmount='1', payments=[])
        assert receipt['discount'] == '20.00' and receipt['total'] == '0.00' and receipt['couponCode'] == 'GIFT'
    assert Payment.objects.count() == 0 and Sale.objects.count() == 2
    assert client.patch(BASE + '/coupons/' + coupon['id'], {'kind': 'percent', 'value': '101', 'version': 1}, format='json').status_code == 400
    assert client.patch(BASE + '/coupons/' + coupon['id'], {'active': False, 'version': 1}, format='json').status_code == 200
    result = client.post(BASE + '/sales/complete', sale_data(pos, customerId=person['id'], couponId=coupon['id'], payments=[]), format='json')
    assert result.status_code == 400


def test_coupon_customer_expiry_workspace_and_partial_patch_validation(pos):
    client = pos['client']
    person, other = customer(client), customer(client)
    coupon = Coupon.objects.create(workspace=pos['workspace'], customer_id=person['id'], code='OLD', kind='fixed', value='5', expires_at='2000-01-01')
    data = sale_data(pos, customerId=person['id'], couponId=str(coupon.id))
    assert client.post(BASE + '/sales/complete', data, format='json').status_code == 400
    coupon.expires_at = None
    coupon.save()
    data['customerId'] = other['id']
    assert client.post(BASE + '/sales/complete', data, format='json').status_code == 400
    assert client.patch(BASE + '/coupons/' + str(coupon.id), {'customerId': other['id'], 'version': 1}, format='json').status_code == 400
    data['customerId'] = None
    assert client.post(BASE + '/sales/complete', data, format='json').status_code == 400
    assert client.get(BASE + '/pos/customers/' + person['id'] + '/coupons').json()['items'][0]['id'] == str(coupon.id)


def test_refunds_idempotence_remaining_quantity_version_and_cash_close(pos):
    client = pos['client']
    receipt = sell(pos, payments=[{'method': 'cash', 'amount': '5'}, {'method': 'card', 'amount': '15'}])
    data = refund_data(pos, receipt, paymentMethod='card')
    result = client.post(BASE + '/sales/' + receipt['id'] + '/refunds', data, format='json')
    assert result.status_code == 201 and result.json()['amount'] == '10.00'
    assert client.post(BASE + '/sales/' + receipt['id'] + '/refunds', data, format='json').status_code == 200
    assert client.post(BASE + '/sales/' + receipt['id'] + '/refunds', {**data, 'reason': 'changed'}, format='json').status_code == 409
    assert client.post(BASE + '/sales/' + receipt['id'] + '/refunds', {**data, 'requestId': str(uuid4())}, format='json').status_code == 409
    updated = client.get(BASE + '/sales/' + receipt['id']).json()
    assert updated['status'] == 'partially_refunded' and updated['version'] == 2
    excessive = refund_data(pos, updated, items=[{'saleItemId': receipt['items'][0]['id'], 'quantity': '2'}])
    assert client.post(BASE + '/sales/' + receipt['id'] + '/refunds', excessive, format='json').status_code == 400
    second = client.post(BASE + '/sales/' + receipt['id'] + '/refunds', refund_data(pos, updated), format='json')
    assert second.status_code == 201
    assert Stock.objects.get(product=pos['product']).quantity == 10
    final = client.get(BASE + '/sales/' + receipt['id']).json()
    assert final['status'] == 'refunded' and final['refunded'] == '20.00'
    current = client.get(BASE + '/shifts/current').json()['shift']
    assert current['expectedCash'] == '95.00' # Opening 100 + cash 5 - cash refund 10; card refund excluded.
    assert client.post(BASE + '/shifts/' + current['id'] + '/close', {'version': 1, 'actualCash': '95'}, format='json').status_code == 409
    closed = client.post(BASE + '/shifts/' + current['id'] + '/close', {'version': current['version'], 'actualCash': '95'}, format='json')
    assert closed.status_code == 200 and closed.json()['expectedCash'] == '95.00'
    assert client.post(BASE + '/sales/complete', sale_data(pos), format='json').status_code == 409


def test_cumulative_refund_rounding_restores_exact_discounted_total(pos):
    client = pos['client']
    product = pos['product']
    product.price = Decimal('0.01')
    product.save()
    receipt = sell(pos, items=[{'productId': str(product.id), 'quantity': '3'}], discountAmount='0.01', payments=[{'method': 'cash', 'amount': '0.02'}])
    amounts = []
    for _ in range(3):
        result = client.post(BASE + '/sales/' + receipt['id'] + '/refunds', refund_data(pos, receipt), format='json')
        assert result.status_code == 201, result.content
        amounts.append(result.json()['amount'])
        receipt = client.get(BASE + '/sales/' + receipt['id']).json()
    assert amounts == ['0.01', '0.00', '0.01']
    assert receipt['refunded'] == receipt['total'] == '0.02'
    assert Stock.objects.get(product=product).quantity == 10


def test_service_free_price_discount_distribution_and_refund_no_stock(pos):
    products = [Product.objects.create(workspace=pos['workspace'], name='Service', sku='S' + str(i), price='0.01',
                                     product_type='service', is_free_price=True) for i in range(4)]
    receipt = sell(pos, items=[{'productId': str(p.id), 'quantity': '1', 'freePrice': '0.01'} for p in products],
                   discountAmount='0.02', payments=[{'method': 'cash', 'amount': '0.02'}])
    assert sum(Decimal(row['total']) for row in receipt['items']) == Decimal('0.02')
    assert all(Decimal(row['total']) >= 0 and not row['tracksStock'] for row in receipt['items'])
    data = refund_data(pos, receipt, items=[{'saleItemId': row['id'], 'quantity': '1'} for row in receipt['items']])
    result = pos['client'].post(BASE + '/sales/' + receipt['id'] + '/refunds', data, format='json')
    assert result.status_code == 201 and result.json()['amount'] == '0.02'
    assert Stock.objects.count() == 1 and StockMovement.objects.count() == 1
    assert pos['client'].patch(BASE + '/products/' + str(products[0].id), {'version': 1, 'productType': 'goods'}, format='json').status_code == 409


def test_stock_cas_idempotent_and_own_workspace(pos):
    client = pos['client']
    data = {'requestId': str(uuid4()), 'productId': str(pos['product'].id), 'warehouseId': str(pos['warehouse'].id),
            'kind': 'correction', 'quantity': '3', 'stockVersion': 1}
    first = client.post(BASE + '/stock-movements', data, format='json')
    assert first.status_code == 201
    assert client.post(BASE + '/stock-movements', data, format='json').json()['id'] == first.json()['id']
    assert client.post(BASE + '/stock-movements', {**data, 'quantity': '2'}, format='json').status_code == 409
    assert client.post(BASE + '/stock-movements', {**data, 'requestId': str(uuid4())}, format='json').status_code == 409
    assert Stock.objects.get(product=pos['product']).quantity == 3
    foreign = Warehouse.objects.create(workspace=pos['foreign'], name='Foreign')
    assert client.post(BASE + '/stock-movements', {**data, 'requestId': str(uuid4()), 'warehouseId': str(foreign.id)}, format='json').status_code == 400
    assert client.post(BASE + '/registers', {'name': 'No', 'warehouseId': str(foreign.id)}, format='json').status_code == 400


def test_rbac_own_sales_register_shift_and_finance_override(pos):
    receipt = sell(pos)
    other, member, shift = cashier(pos)
    assert other.get(BASE + '/sales').json()['items'] == []
    assert other.get(BASE + '/sales/' + receipt['id']).status_code == 404
    assert len(other.get(BASE + '/shifts').json()['items']) == 1
    assert 'cost' not in other.get(BASE + '/pos/products').json()['items'][0]
    assert other.get(BASE + '/products').status_code == 403
    assert other.post(BASE + '/products', {'name': 'No'}, format='json').status_code == 403
    assert other.post(BASE + '/coupons', {}, format='json').status_code == 403
    assert other.post(BASE + '/sales/complete', sale_data(pos), format='json').status_code == 409
    assert other.post(BASE + '/sales/' + receipt['id'] + '/refunds', refund_data(pos, receipt, shiftId=shift['id']), format='json').status_code == 403
    assert other.post(BASE + '/shifts', {'registerId': str(pos['register'].id)}, format='json').status_code == 409
    role = member.role
    role.page_actions = {'pos': []}
    role.save()
    assert other.post(BASE + '/sales/complete', sale_data(pos, shiftId=shift['id']), format='json').status_code == 403
    assert other.post(BASE + '/shifts/' + shift['id'] + '/close', {'version': 1, 'actualCash': '0'}, format='json').status_code == 403
    role.page_actions = {'pos': ['finance', 'manageTeam']}
    role.save()
    assert len(other.get(BASE + '/sales').json()['items']) == 1
    assert len(other.get(BASE + '/shifts').json()['items']) == 2


def test_catalog_versions_archive_and_route_method_errors(pos):
    client = pos['client']
    for url in ['/products', '/warehouses', '/registers']:
        assert client.patch(BASE + url, {}, format='json').status_code == 405
    assert client.post(BASE + '/products/' + str(pos['product'].id), {}, format='json').status_code == 405
    assert client.delete(BASE + '/products/' + str(pos['product'].id), {'version': 1}, format='json').status_code == 409
    assert client.delete(BASE + '/warehouses/' + str(pos['warehouse'].id), {'version': 1}, format='json').status_code == 409
    assert client.delete(BASE + '/registers/' + str(pos['register'].id), {'version': 1}, format='json').status_code == 409
    changed = client.patch(BASE + '/products/' + str(pos['product'].id), {'price': '11', 'version': 1}, format='json')
    assert changed.status_code == 200
    assert client.patch(BASE + '/products/' + str(pos['product'].id), {'price': '12', 'version': 1}, format='json').status_code == 409
    assert Product.objects.get(pk=pos['product'].id).price == 11
    assert AuditEvent.objects.filter(action='product.updated').count() == 1


def test_catalog_to_receipt_and_refund_new_shift_original_warehouse(pos):
    client = pos['client']
    warehouse_response = client.post(BASE + '/warehouses', {'name': 'Second'}, format='json')
    assert warehouse_response.status_code == 201
    warehouse = warehouse_response.json()
    register_response = client.post(BASE + '/registers', {'name': 'Second', 'warehouseId': warehouse['id']}, format='json')
    assert register_response.status_code == 201
    product_response = client.post(BASE + '/products', {'name': 'API product', 'sku': 'API', 'price': '2.50', 'weighted': True}, format='json')
    assert product_response.status_code == 201
    product = product_response.json()
    assert client.post(BASE + '/stock-movements', {'requestId': str(uuid4()), 'productId': product['id'],
        'warehouseId': str(pos['warehouse'].id), 'kind': 'receipt', 'quantity': '1.5', 'stockVersion': 0}, format='json').status_code == 201
    receipt = sell(pos, items=[{'productId': product['id'], 'quantity': '0.5'}], payments=[{'method': 'qr', 'amount': '1.25'}])
    current = client.get(BASE + '/shifts/current').json()['shift']
    assert client.post(BASE + '/shifts/' + current['id'] + '/close', {'version': current['version'], 'actualCash': '100'}, format='json').status_code == 200
    next_shift = client.post(BASE + '/shifts', {'registerId': register_response.json()['id'], 'openingCash': '10'}, format='json').json()
    data = refund_data(pos, receipt, shiftId=next_shift['id'], items=[{'saleItemId': receipt['items'][0]['id'], 'quantity': '0.5'}])
    result = client.post(BASE + '/sales/' + receipt['id'] + '/refunds', data, format='json')
    assert result.status_code == 201 and result.json()['amount'] == '1.25'
    assert Stock.objects.get(product_id=product['id'], warehouse=pos['warehouse']).quantity == Decimal('1.5')
    assert not Stock.objects.filter(product_id=product['id'], warehouse_id=warehouse['id']).exists()
    assert client.get(BASE + '/shifts/current').json()['shift']['expectedCash'] == '8.75'


def test_cross_workspace_product_customer_coupon_and_shift_are_rejected(pos):
    from core.models import Customer
    client = pos['client']
    foreign = pos['foreign']
    product = Product.objects.create(workspace=foreign, sku='OTHER', name='Other', price=10)
    person = Customer.objects.create(workspace=foreign, name='Other')
    coupon = Coupon.objects.create(workspace=foreign, customer=person, code='PRIVATE', kind='fixed', value=1)
    changes = [
        {'items': [{'productId': str(product.id), 'quantity': '2'}]},
        {'customerId': str(person.id)}, {'couponId': str(coupon.id)},
    ]
    for change in changes:
        assert client.post(BASE + '/sales/complete', sale_data(pos, **change), format='json').status_code == 400
    assert client.get(BASE + '/pos/customers/' + str(person.id) + '/coupons').json()['items'] == []
    assert client.get(BASE + '/products/' + str(product.id)).status_code == 404
    assert Sale.objects.count() == 0


def test_coupon_valid_through_business_date_inclusive(pos, monkeypatch):
    from datetime import datetime, timezone
    from core import pos_services
    monkeypatch.setattr(pos_services.timezone, 'now', lambda: datetime(2026, 10, 10, 20, tzinfo=timezone.utc))
    pos['client'] = login(pos['user'])
    person = customer(pos['client'])
    coupon = Coupon.objects.create(workspace=pos['workspace'], customer_id=person['id'], code='TODAY',
                                   kind='fixed', value=5, expires_at='2026-10-11')
    receipt = sell(pos, customerId=person['id'], couponId=str(coupon.id), payments=[{'method': 'cash', 'amount': '15'}])
    assert receipt['discount'] == '5.00'
    coupon.expires_at = '2026-10-10'
    coupon.save()
    result = pos['client'].post(BASE + '/sales/complete', sale_data(pos, customerId=person['id'], couponId=str(coupon.id)), format='json')
    assert result.status_code == 400
