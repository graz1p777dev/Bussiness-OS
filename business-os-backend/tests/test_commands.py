from io import StringIO
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from core.models import Customer, Deal, Membership, Pipeline, User, Workspace
from .test_api import BASE, PASSWORD, login

pytestmark = pytest.mark.django_db


def test_bootstrap_and_member_commands_produce_usable_accounts_without_business_fixtures(monkeypatch):
    monkeypatch.setattr("core.management.commands.bootstrap.getpass", lambda prompt: PASSWORD)
    output = StringIO()
    call_command("bootstrap", name="Local business", email="OWNER@example.test", owner_name="Owner", stdout=output)
    workspace = Workspace.objects.get()
    assert PASSWORD not in output.getvalue()
    assert Customer.objects.count() == Deal.objects.count() == 0
    assert Pipeline.objects.filter(workspace=workspace).count() == 2
    assert login(User.objects.get(email="owner@example.test")).get(BASE + "/pipelines").status_code == 200
    monkeypatch.setattr("core.management.commands.add_member.getpass", lambda prompt: PASSWORD)
    call_command("add_member", workspace=str(workspace.id), role="cashier", email="cashier@example.test",
                 name="Cashier", stdout=StringIO())
    client = login(User.objects.get(email="cashier@example.test"))
    assert client.post(BASE + "/pos/customers", {"name": "POS created"}, format="json").status_code == 201
    assert client.post(BASE + "/deals", {}, format="json").status_code == 403
    assert Membership.objects.count() == 2
    with pytest.raises(CommandError):
        call_command("bootstrap", name="Must not duplicate", email="owner@example.test", owner_name="Other")
    assert Workspace.objects.count() == 1


def test_bootstrap_weak_password_rolls_back_all_rows(monkeypatch):
    monkeypatch.setattr("core.management.commands.bootstrap.getpass", lambda prompt: "123")
    with pytest.raises(CommandError):
        call_command("bootstrap", name="Test", email="owner@example.test", owner_name="Owner")
    assert User.objects.count() == Workspace.objects.count() == 0
