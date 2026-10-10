from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from .models import AuditEvent, Customer, Deal, Membership, Pipeline, Stage


class Conflict(APIException):
    status_code = 409
    default_detail = "Запись изменилась. Обновите данные и повторите действие."
    default_code = "conflict"


def audit(actor, action, record, details=None):
    AuditEvent.objects.create(workspace=actor.workspace, actor=actor, action=action,
                              entity_id=record.id, details=details or {})


@transaction.atomic
def create_customer(actor, data):
    if "version" in data:
        raise ValidationError({"version": "Не передавайте версию при создании."})
    customer = Customer.objects.create(workspace=actor.workspace, **data)
    audit(actor, "customer.created", customer)
    return customer


def validate_deal_relations(actor, data, previous=None):
    def value(field):
        return data.get(field, getattr(previous, field, None))
    if not Customer.objects.select_for_update().filter(
        pk=value("customer_id"), workspace=actor.workspace, deleted_at=None
    ).first():
        raise ValidationError({"customerId": "Клиент недоступен."})
    if not Pipeline.objects.filter(pk=value("pipeline_id"), workspace=actor.workspace).exists():
        raise ValidationError({"pipelineId": "Воронка недоступна."})
    if not Stage.objects.filter(pk=value("stage_id"), pipeline_id=value("pipeline_id")).exists():
        raise ValidationError({"stageId": "Этап не принадлежит выбранной воронке."})
    employee = value("employee_id")
    if employee and not Membership.objects.filter(pk=employee, workspace=actor.workspace, status="active",
                                                   user__is_active=True).exists():
        raise ValidationError({"employeeId": "Сотрудник недоступен."})


@transaction.atomic
def create_deal(actor, data):
    if "version" in data:
        raise ValidationError({"version": "Не передавайте версию при создании."})
    validate_deal_relations(actor, data)
    record = Deal.objects.create(workspace=actor.workspace, **data)
    audit(actor, "deal.created", record, {"stageId": str(record.stage_id)})
    return record


@transaction.atomic
def update_record(actor, record, data, action, delete=False):
    version = data.pop("version", None)
    if version is None:
        raise ValidationError({"version": "Укажите текущую версию записи."})
    record = type(record).objects.select_for_update().filter(
        pk=record.pk, workspace=actor.workspace, deleted_at=None).first()
    if record is None or record.version != version:
        raise Conflict()
    if isinstance(record, Deal) and not delete:
        validate_deal_relations(actor, data, record)
    if isinstance(record, Customer) and delete and (record.deals.exists() or record.sales.exists()):
        raise Conflict("У клиента есть сделки или продажи. Исторические связи должны сохраняться.")
    details = {"fields": sorted(data), "previousVersion": version}
    if isinstance(record, Deal) and "stage_id" in data:
        details.update({"beforeStageId": str(record.stage_id), "stageId": str(data["stage_id"])})
    if delete:
        data["deleted_at"] = timezone.now()
    changed = type(record).objects.filter(pk=record.pk, workspace=actor.workspace,
        version=version, deleted_at=None).update(**data, version=version + 1, updated_at=timezone.now())
    if changed != 1:
        raise Conflict()
    record.refresh_from_db()
    audit(actor, action, record, details)
    return record
