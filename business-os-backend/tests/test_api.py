import pytest
from django.contrib.sessions.models import Session
from rest_framework.test import APIClient
from core.models import AuditEvent, Customer, Deal, Membership, Pipeline, Role, Stage, User, Workspace

BASE = "/api/os/v1"
PASSWORD = "test-fixture-only-Strong-927!"
pytestmark = pytest.mark.django_db


@pytest.fixture
def setup():
    workspace = Workspace.objects.create(name="Test A")
    foreign = Workspace.objects.create(name="Test B")
    role = Role.objects.create(workspace=workspace, slug="owner", name="Owner", pages=["crm", "customers", "pos"],
                               actions=["create", "edit", "remove", "finance"])
    user = User.objects.create_user("owner@example.test", PASSWORD, name="Test Owner")
    member = Membership.objects.create(workspace=workspace, user=user, role=role)
    pipeline = Pipeline.objects.create(workspace=workspace, name="Sales")
    stage = Stage.objects.create(pipeline=pipeline, name="New")
    next_stage = Stage.objects.create(pipeline=pipeline, name="Payment", sort_order=1)
    foreign_pipeline = Pipeline.objects.create(workspace=foreign, name="Other")
    foreign_stage = Stage.objects.create(pipeline=foreign_pipeline, name="Other")
    return {"workspace": workspace, "foreign": foreign, "role": role, "user": user, "member": member,
            "pipeline": pipeline, "stage": stage, "next_stage": next_stage, "foreign_stage": foreign_stage}


def login(user):
    client = APIClient(enforce_csrf_checks=True)
    token = client.get(BASE + "/auth/csrf").json()["csrfToken"]
    result = client.post(BASE + "/auth/login", {"email": user.email, "password": PASSWORD},
                         format="json", HTTP_X_CSRFTOKEN=token)
    assert result.status_code == 200, result.content
    client.credentials(HTTP_X_CSRFTOKEN=result.json()["csrfToken"])
    return client


def customer(client, **extra):
    result = client.post(BASE + "/customers", {"name": "Customer", **extra}, format="json")
    assert result.status_code == 201, result.content
    return result.json()


def deal(client, setup, customer_id, **extra):
    result = client.post(BASE + "/deals", {"title": "Deal", "customerId": customer_id,
        "pipelineId": str(setup["pipeline"].id), "stageId": str(setup["stage"].id), **extra}, format="json")
    assert result.status_code == 201, result.content
    return result.json()


def test_real_login_requires_password_and_csrf(setup):
    client = APIClient(enforce_csrf_checks=True)
    assert client.get(BASE + "/customers").status_code == 403
    assert client.post(BASE + "/auth/login", {"email": setup["user"].email, "password": PASSWORD},
                       format="json").status_code == 403
    token = client.get(BASE + "/auth/csrf").json()["csrfToken"]
    assert client.post(BASE + "/auth/login", {"email": setup["user"].email, "password": "wrong"},
                       format="json", HTTP_X_CSRFTOKEN=token).status_code == 401
    client = login(setup["user"])
    assert Session.objects.count() == 1
    assert setup["user"].password.startswith("pbkdf2_sha256$")
    me = client.get(BASE + "/me").json()
    assert me["employeeId"] == str(setup["member"].id)
    assert me["permissions"]["pos"]["finance"] is True
    assert "salary" not in me["profile"]


def test_csrf_blocks_authenticated_mutations_and_logout_revokes_cookie(setup):
    client = login(setup["user"])
    client.credentials()
    assert client.post(BASE + "/customers", {"name": "No CSRF"}, format="json").status_code == 403
    token = client.get(BASE + "/auth/csrf").json()["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN=token)
    old_cookie = client.cookies["bos_session"].value
    assert client.post(BASE + "/auth/logout", {}, format="json").status_code == 204
    client.cookies["bos_session"] = old_cookie
    assert client.get(BASE + "/me").status_code == 403


@pytest.mark.parametrize("target", ["user", "member"])
def test_blocking_revokes_old_session_even_after_reactivation(setup, target):
    client = login(setup["user"])
    record = setup[target]
    if target == "user":
        record.is_active = False
    else:
        record.status = "blocked"
    record.save()
    # Re-enable before the next request: an old cookie must still not regain access.
    if target == "user":
        record.is_active = True
    else:
        record.status = "active"
    record.save()
    assert client.get(BASE + "/customers").status_code == 403
    assert login(setup["user"]).get(BASE + "/customers").status_code == 200


def test_cashier_uses_same_customer_store_but_cannot_edit_crm(setup):
    role = setup["role"]
    role.slug, role.page_actions = "cashier", {"crm": [], "customers": []}
    role.save()
    client = login(setup["user"])
    result = client.post(BASE + "/pos/customers", {"name": "POS Client", "phone": "+996 (555) 123-456"}, format="json")
    assert result.status_code == 201
    created = result.json()
    assert set(created) == {"id", "name", "phone"}
    assert created["phone"] == "996555123456"
    assert client.get(BASE + "/customers/" + created["id"]).json()["name"] == "POS Client"
    assert client.post(BASE + "/customers", {"name": "Unauthorized"}, format="json").status_code == 403
    assert client.patch(BASE + "/customers/" + created["id"], {"name": "Changed", "version": 1},
                        format="json").status_code == 403
    assert client.post(BASE + "/pos/customers", {"name": "Secret", "note": "hidden"}, format="json").status_code == 400


def test_page_is_mandatory_and_owner_slug_is_not_authority(setup):
    client = login(setup["user"])
    role = setup["role"]
    role.pages = ["pos"]
    role.save()
    assert client.get(BASE + "/customers").status_code == 403
    role.pages, role.actions = ["customers"], []
    role.save()
    assert client.get(BASE + "/customers").status_code == 200
    assert client.post(BASE + "/customers", {"name": "No grant"}, format="json").status_code == 403


def test_cross_workspace_reads_mutations_and_foreign_role_are_denied(setup):
    client = login(setup["user"])
    foreign = Customer.objects.create(workspace=setup["foreign"], name="Hidden", phone="12345")
    assert client.get(BASE + "/customers/" + str(foreign.id)).status_code == 404
    assert client.patch(BASE + "/customers/" + str(foreign.id), {"name": "Attack", "version": 1},
                        format="json").status_code == 404
    assert client.get(BASE + "/customers", HTTP_X_WORKSPACE_ID=str(setup["foreign"].id)).status_code == 403
    assert client.get(BASE + "/customers", HTTP_X_WORKSPACE_ID="not-an-id").status_code == 400
    foreign_role = Role.objects.create(workspace=setup["foreign"], name="Bad link", slug="other", pages=["customers"])
    setup["member"].role = foreign_role
    setup["member"].save()
    assert client.get(BASE + "/customers").status_code == 403


def test_stable_customer_uuid_no_phone_merge_and_partial_fields_preserved(setup):
    client = login(setup["user"])
    first = customer(client, name="Same", phone="+996 555 123456", tags=["VIP"], customFields={"ref": "one"})
    second = customer(client, name="Same")
    assert first["id"] != second["id"]
    duplicate = client.post(BASE + "/customers", {"name": "Other", "phone": "996555123456"}, format="json")
    assert duplicate.status_code == 409
    updated = client.patch(BASE + "/customers/" + first["id"], {"name": "Renamed", "version": 1}, format="json")
    assert updated.status_code == 200
    assert updated.json()["id"] == first["id"]
    assert updated.json()["customFields"] == {"ref": "one"}
    assert updated.json()["tags"] == ["VIP"]
    assert updated.json()["version"] == 2
    assert client.patch(BASE + "/customers/" + first["id"], {"name": "Stale", "version": 1},
                        format="json").status_code == 409
    assert client.get(BASE + "/pos/customers", {"q": "+996 555"}).json()["items"][0]["id"] == first["id"]


def test_unknown_authority_fields_and_invalid_money_rejected(setup):
    client = login(setup["user"])
    assert client.post(BASE + "/customers", {"name": "X", "workspaceId": str(setup["foreign"].id)},
                       format="json").status_code == 400
    c = customer(client)
    payload = {"customerId": c["id"], "pipelineId": str(setup["pipeline"].id),
               "stageId": str(setup["stage"].id), "title": "Bad", "amount": "-1"}
    assert client.post(BASE + "/deals", payload, format="json").status_code == 400
    assert client.patch(BASE + "/customers/" + c["id"], {"name": "Missing version"}, format="json").status_code == 400


def test_two_deals_share_customer_and_move_writes_atomic_history(setup):
    client = login(setup["user"])
    c = customer(client)
    first = deal(client, setup, c["id"], amount="125.50")
    second = deal(client, setup, c["id"])
    assert first["customerId"] == second["customerId"]
    moved = client.post(BASE + "/deals/" + first["id"] + "/move",
                        {"stageId": str(setup["next_stage"].id), "version": 1}, format="json")
    assert moved.status_code == 200
    assert moved.json()["amount"] == "125.50"
    assert moved.json()["version"] == 2
    events = client.get(BASE + "/deals/" + first["id"] + "/events").json()["items"]
    assert events[0]["action"] == "deal.moved"
    assert events[0]["details"]["beforeStageId"] == str(setup["stage"].id)
    assert events[0]["employeeId"] == str(setup["member"].id)
    assert client.get(BASE + "/deals", {"customerId": c["id"]}).json()["items"]


def test_deal_foreign_customer_stage_and_employee_cannot_be_attached(setup):
    client = login(setup["user"])
    c = customer(client)
    d = deal(client, setup, c["id"])
    other_pipeline = Pipeline.objects.create(workspace=setup["workspace"], name="Another")
    other_stage = Stage.objects.create(pipeline=other_pipeline, name="Other stage")
    for stage in [setup["foreign_stage"], other_stage]:
        assert client.post(BASE + "/deals/" + d["id"] + "/move", {"stageId": str(stage.id), "version": 1},
                           format="json").status_code == 400
    foreign = Customer.objects.create(workspace=setup["foreign"], name="Foreign")
    assert client.patch(BASE + "/deals/" + d["id"], {"customerId": str(foreign.id), "version": 1},
                        format="json").status_code == 400
    setup["member"].status = "terminated"
    setup["member"].save()
    # A new actor may not assign the terminated employee.
    user = User.objects.create_user("second@example.test", PASSWORD, name="Second")
    Membership.objects.create(workspace=setup["workspace"], user=user, role=setup["role"])
    other = login(user)
    assert other.patch(BASE + "/deals/" + d["id"], {"employeeId": str(setup["member"].id), "version": 1},
                       format="json").status_code == 400


def test_failed_audit_rolls_back_deal_mutation(setup, monkeypatch):
    from core import services
    client = login(setup["user"])
    d = deal(client, setup, customer(client)["id"])
    def fail(*args, **kwargs):
        raise RuntimeError("test audit unavailable")
    monkeypatch.setattr(services, "audit", fail)
    with pytest.raises(RuntimeError):
        client.post(BASE + "/deals/" + d["id"] + "/move",
                    {"stageId": str(setup["next_stage"].id), "version": 1}, format="json")
    record = Deal.objects.get(pk=d["id"])
    assert record.version == 1
    assert record.stage_id == setup["stage"].id


def test_archive_preserves_linked_customer_and_history(setup):
    client = login(setup["user"])
    c = customer(client)
    d = deal(client, setup, c["id"])
    assert client.delete(BASE + "/customers/" + c["id"], {"version": 1}, format="json").status_code == 409
    assert client.delete(BASE + "/deals/" + d["id"], {"version": 1}, format="json").status_code == 204
    assert client.get(BASE + "/deals/" + d["id"]).status_code == 404
    assert Customer.objects.filter(pk=c["id"]).exists()
    assert AuditEvent.objects.filter(entity_id=d["id"], action="deal.archived").exists()
    standalone = customer(client)
    assert client.delete(BASE + "/customers/" + standalone["id"], {"version": 1}, format="json").status_code == 204
    assert client.get(BASE + "/customers/" + standalone["id"]).status_code == 404


def test_cursor_pagination_is_signed_and_bound_to_search(setup):
    client = login(setup["user"])
    customer(client, name="Alice")
    customer(client, name="Bob")
    first = client.get(BASE + "/customers", {"limit": 1}).json()
    second = client.get(BASE + "/customers", {"limit": 1, "cursor": first["nextCursor"]}).json()
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert second["nextCursor"] is None
    assert client.get(BASE + "/customers", {"cursor": "modified"}).status_code == 400
    assert client.get(BASE + "/customers", {"cursor": first["nextCursor"], "q": "Alice"}).status_code == 400


def test_login_attempt_limit_is_persistent(setup):
    client = APIClient(enforce_csrf_checks=True)
    token = client.get(BASE + "/auth/csrf").json()["csrfToken"]
    for _ in range(10):
        assert client.post(BASE + "/auth/login", {"email": setup["user"].email, "password": "wrong"},
                           format="json", HTTP_X_CSRFTOKEN=token).status_code == 401
    assert client.post(BASE + "/auth/login", {"email": setup["user"].email, "password": PASSWORD},
                       format="json", HTTP_X_CSRFTOKEN=token).status_code == 429
