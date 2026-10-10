"""Real row-lock checks: deliberately skipped on SQLite, never presented as concurrency evidence."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4
import pytest
from django.db import close_old_connections, connection
from core.models import Membership, Sale, Stock
from core.pos_services import complete_sale
from core.pos_serializers import CompleteSaleInput
from core.services import Conflict
from .test_api import setup  # noqa: F401
from .test_pos import cashier, pos, sale_data  # noqa: F401

pytestmark = [pytest.mark.django_db(transaction=True),
              pytest.mark.skipif(connection.vendor != 'postgresql', reason='Requires isolated PostgreSQL row locks')]


def perform_sale(actor_id, data, barrier):
    close_old_connections()
    try:
        actor = Membership.objects.select_related('workspace', 'role').get(pk=actor_id)
        serializer = CompleteSaleInput(data=data)
        serializer.is_valid(raise_exception=True)
        barrier.wait(timeout=10)
        try:
            record, created = complete_sale(actor, serializer.validated_data)
            return str(record.id), created
        except Conflict:
            return 'conflict', False
    finally:
        close_old_connections()


def test_postgres_last_item_two_registers_cannot_oversell(pos):  # noqa: F811
    _, second, second_shift = cashier(pos)
    Stock.objects.filter(product=pos['product']).update(quantity=1)
    barrier = Barrier(2)
    first = sale_data(pos, items=[{'productId': str(pos['product'].id), 'quantity': '1'}],
                      payments=[{'method': 'cash', 'amount': '10'}])
    second_data = {**first, 'requestId': str(uuid4()), 'shiftId': second_shift['id']}
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls = [pool.submit(perform_sale, pos['member'].id, first, barrier),
                 pool.submit(perform_sale, second.id, second_data, barrier)]
        results = [call.result(timeout=20) for call in calls]
    assert sum(created for _, created in results) == 1
    assert sum(id == 'conflict' for id, _ in results) == 1
    assert Sale.objects.count() == 1 and Stock.objects.get(product=pos['product']).quantity == 0


def test_postgres_repeated_request_concurrent_creates_one_sale(pos):  # noqa: F811
    barrier, data = Barrier(2), sale_data(pos)
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls = [pool.submit(perform_sale, pos['member'].id, data, barrier) for _ in range(2)]
        results = [call.result(timeout=20) for call in calls]
    assert results[0][0] == results[1][0]
    assert sum(created for _, created in results) == 1
    assert Sale.objects.count() == 1 and Stock.objects.get(product=pos['product']).quantity == 8
