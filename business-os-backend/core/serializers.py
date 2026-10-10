import json
import re
from decimal import Decimal
from rest_framework import serializers
from .models import Customer, Deal


class StrictInput(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Ожидается JSON object.")
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: "Неизвестное поле." for field in sorted(unknown)})
        return super().to_internal_value(data)

    def validate_customFields(self, value):
        if len(json.dumps(value, ensure_ascii=False)) > 16_000:
            raise serializers.ValidationError("Слишком большой набор полей.")
        return value


class CustomerInput(StrictInput):
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=64, allow_blank=True, required=False)
    username = serializers.CharField(max_length=120, allow_blank=True, required=False)
    city = serializers.CharField(max_length=120, allow_blank=True, required=False)
    note = serializers.CharField(max_length=10_000, allow_blank=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=80), max_length=30, required=False)
    customFields = serializers.DictField(source="custom_fields", required=False)
    version = serializers.IntegerField(min_value=1, required=False)

    def validate_phone(self, value):
        digits = re.sub(r"\D", "", value)
        if value and (not digits or len(digits) > 32):
            raise serializers.ValidationError("Некорректный телефон.")
        return digits


class PosCustomerInput(StrictInput):
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=64, allow_blank=True, required=False)
    validate_phone = CustomerInput.validate_phone


class DealInput(StrictInput):
    customerId = serializers.UUIDField(source="customer_id")
    pipelineId = serializers.UUIDField(source="pipeline_id")
    stageId = serializers.UUIDField(source="stage_id")
    employeeId = serializers.UUIDField(source="employee_id", required=False, allow_null=True)
    title = serializers.CharField(max_length=300)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal(0), required=False)
    currency = serializers.ChoiceField(choices=["KGS", "USD", "RUB"], required=False)
    note = serializers.CharField(max_length=10_000, allow_blank=True, required=False)
    customFields = serializers.DictField(source="custom_fields", required=False)
    version = serializers.IntegerField(min_value=1, required=False)


class VersionInput(StrictInput):
    version = serializers.IntegerField(min_value=1)


class MoveInput(VersionInput):
    stageId = serializers.UUIDField(source="stage_id")


class CustomerOutput(serializers.ModelSerializer):
    customFields = serializers.JSONField(source="custom_fields")
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "username", "city", "note", "tags", "customFields",
                  "createdAt", "updatedAt", "version"]


class CustomerPickerOutput(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone"]


class DealOutput(serializers.ModelSerializer):
    customerId = serializers.UUIDField(source="customer_id")
    pipelineId = serializers.UUIDField(source="pipeline_id")
    stageId = serializers.UUIDField(source="stage_id")
    employeeId = serializers.UUIDField(source="employee_id", allow_null=True)
    customFields = serializers.JSONField(source="custom_fields")
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Deal
        fields = ["id", "customerId", "pipelineId", "stageId", "employeeId", "title", "amount",
                  "currency", "note", "customFields", "createdAt", "updatedAt", "version"]
