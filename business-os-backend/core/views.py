import re
from uuid import UUID
from django.contrib.auth import logout
from django.core import signing
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .access import ACTIONS, actor_for, can, require, require_customers
from .models import AuditEvent, Customer, Deal, Pipeline
from .serializers import (CustomerInput, CustomerOutput, CustomerPickerOutput, DealInput,
                          DealOutput, MoveInput, PosCustomerInput, VersionInput)
from .services import Conflict, create_customer, create_deal, update_record


def validated(serializer_class, request, partial=False):
    serializer = serializer_class(data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def paginated(request, queryset, output, scope):
    query = request.query_params.get("q", "")
    if len(query) > 200:
        raise ValidationError({"q": "Слишком длинный поисковый запрос."})
    try:
        limit = int(request.query_params.get("limit", "50"))
        if not 1 <= limit <= 100:
            raise ValueError
    except ValueError:
        raise ValidationError({"limit": "Используйте число от 1 до 100."}) from None
    cursor = request.query_params.get("cursor")
    if cursor:
        try:
            payload = signing.loads(cursor, salt="bos-list", max_age=86400)
            if payload["scope"] != scope or payload["query"] != query:
                raise ValueError
            queryset = queryset.filter(id__gt=UUID(payload["after"]))
        except (signing.BadSignature, KeyError, TypeError, ValueError):
            raise ValidationError({"cursor": "Курсор недействителен для этого списка."}) from None
    rows = list(queryset.order_by("id")[:limit + 1])
    next_cursor = signing.dumps({"scope": scope, "query": query, "after": str(rows[limit - 1].id)},
                                salt="bos-list") if len(rows) > limit else None
    return Response({"items": output(rows[:limit], many=True).data, "nextCursor": next_cursor})


class WorkspaceView(APIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.actor = actor_for(request)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class MeView(WorkspaceView):
    def get(self, request):
        actor = self.actor
        pages = actor.role.pages if isinstance(actor.role.pages, list) else []
        return Response({"employeeId": str(actor.id), "workspaceId": str(actor.workspace_id),
            "profile": {"name": actor.user.name, "email": actor.user.email, "role": actor.role.slug,
                        "status": "Активен"},
            "permissions": {page: {action: can(actor, page, action) for action in ACTIONS} for page in pages}})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)


class CustomersView(WorkspaceView):
    picker = False

    def guard(self, action=None):
        if self.picker:
            require(self.actor, "pos", action)
        else:
            require_customers(self.actor, action)

    def get(self, request):
        self.guard()
        rows = Customer.objects.filter(workspace=self.actor.workspace, deleted_at=None)
        query = request.query_params.get("q", "").strip()
        if query:
            search = Q(name__icontains=query)
            phone = re.sub(r"\D", "", query)
            if phone:
                search |= Q(phone__contains=phone)
            rows = rows.filter(search)
        return paginated(request, rows, CustomerPickerOutput if self.picker else CustomerOutput,
                         f"{self.actor.workspace_id}:customers:{self.picker}")

    def post(self, request):
        self.guard("create")
        data = validated(PosCustomerInput if self.picker else CustomerInput, request)
        try:
            record = create_customer(self.actor, data)
        except IntegrityError:
            raise Conflict("Клиент с этим телефоном уже существует. Найдите и выберите его.") from None
        output = CustomerPickerOutput if self.picker else CustomerOutput
        return Response(output(record).data, status=201)


class PosCustomersView(CustomersView):
    picker = True


class CustomerView(WorkspaceView):
    def record(self, id):
        return get_object_or_404(Customer, pk=id, workspace=self.actor.workspace, deleted_at=None)

    def get(self, request, id):
        require_customers(self.actor)
        return Response(CustomerOutput(self.record(id)).data)

    def patch(self, request, id):
        require_customers(self.actor, "edit")
        try:
            record = update_record(self.actor, self.record(id), validated(CustomerInput, request, True),
                                   "customer.updated")
        except IntegrityError:
            raise Conflict("Клиент с этим телефоном уже существует.") from None
        return Response(CustomerOutput(record).data)

    def delete(self, request, id):
        require_customers(self.actor, "remove")
        update_record(self.actor, self.record(id), validated(VersionInput, request), "customer.archived", True)
        return Response(status=204)


class PipelinesView(WorkspaceView):
    def get(self, request):
        require(self.actor, "crm")
        return Response({"items": [{"id": str(pipeline.id), "name": pipeline.name, "stages": [
            {"id": str(stage.id), "name": stage.name, "color": stage.color, "sortOrder": stage.sort_order}
            for stage in pipeline.stages.order_by("sort_order", "id")]}
            for pipeline in Pipeline.objects.filter(workspace=self.actor.workspace).prefetch_related("stages")]})


class DealsView(WorkspaceView):
    def get(self, request):
        require(self.actor, "crm")
        rows = Deal.objects.filter(workspace=self.actor.workspace, deleted_at=None)
        if request.query_params.get("customerId"):
            try:
                customer = UUID(request.query_params["customerId"])
            except ValueError:
                raise ValidationError({"customerId": "Некорректный ID."}) from None
            rows = rows.filter(customer_id=customer)
        query = request.query_params.get("q", "").strip()
        if query:
            rows = rows.filter(title__icontains=query)
        return paginated(request, rows, DealOutput,
            f"{self.actor.workspace_id}:deals:{request.query_params.get('customerId', '')}")

    def post(self, request):
        require(self.actor, "crm", "create")
        record = create_deal(self.actor, validated(DealInput, request))
        return Response(DealOutput(record).data, status=201)


class DealView(WorkspaceView):
    def record(self, id):
        return get_object_or_404(Deal, pk=id, workspace=self.actor.workspace, deleted_at=None)

    def get(self, request, id):
        require(self.actor, "crm")
        return Response(DealOutput(self.record(id)).data)

    def patch(self, request, id):
        require(self.actor, "crm", "edit")
        record = update_record(self.actor, self.record(id), validated(DealInput, request, True), "deal.updated")
        return Response(DealOutput(record).data)

    def delete(self, request, id):
        require(self.actor, "crm", "remove")
        update_record(self.actor, self.record(id), validated(VersionInput, request), "deal.archived", True)
        return Response(status=204)


class MoveDealView(DealView):
    http_method_names = ["post", "options"]

    def post(self, request, id):
        require(self.actor, "crm", "edit")
        record = update_record(self.actor, self.record(id), validated(MoveInput, request), "deal.moved")
        return Response(DealOutput(record).data)


class DealEventsView(DealView):
    http_method_names = ["get", "options"]

    def get(self, request, id):
        require(self.actor, "crm")
        record = self.record(id)
        return Response({"items": [{"id": str(event.id), "action": event.action,
            "employeeId": str(event.actor_id), "details": event.details, "createdAt": event.created_at}
            for event in AuditEvent.objects.filter(workspace=self.actor.workspace, entity_id=record.id,
                action__startswith="deal.").order_by("-created_at")[:100]]})
