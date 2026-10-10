import uuid
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from django.utils.crypto import salted_hmac


class UserManager(BaseUserManager):
    """Adapted from demiresults-pos/backend/apps/users/models.py; no seeded passwords."""
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email обязателен")
        user = self.model(email=email.strip().lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    session_version = models.UUIDField(default=uuid.uuid4, editable=False)
    USERNAME_FIELD = "email"
    objects = UserManager()

    def _get_session_auth_hash(self, secret=None):
        return salted_hmac("business-os.session", f"{self.password}:{self.session_version}",
                           secret=secret, algorithm="sha256").hexdigest()

    def save(self, *args, **kwargs):
        # Deactivation invalidates existing sessions permanently, even after reactivation.
        if not self.is_active and User.objects.filter(pk=self.pk, is_active=True).exists():
            self.session_version = uuid.uuid4()
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"session_version"}
        self.email = self.email.strip().lower()
        return super().save(*args, **kwargs)


class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    currency = models.CharField(max_length=3, default="KGS")
    time_zone = models.CharField(max_length=64, default="Asia/Bishkek")


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    slug = models.CharField(max_length=80)
    name = models.CharField(max_length=120)
    pages = models.JSONField(default=list)
    actions = models.JSONField(default=list)
    page_actions = models.JSONField(default=dict)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "slug"], name="role_workspace_slug")]


class Membership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    session_version = models.UUIDField(default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=16, default="active", choices=[
        ("active", "Активен"), ("blocked", "Заблокирован"), ("terminated", "Уволен")])

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "user"], name="membership_workspace_user")]

    def save(self, *args, **kwargs):
        if self.status != "active" and Membership.objects.filter(pk=self.pk, status="active").exists():
            self.session_version = uuid.uuid4()
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"session_version"}
        return super().save(*args, **kwargs)


class WorkspaceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class Customer(WorkspaceRecord):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    username = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    tags = models.JSONField(default=list)
    custom_fields = models.JSONField(default=dict)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "phone"],
            condition=~Q(phone="") & Q(deleted_at__isnull=True), name="customer_workspace_phone")]


class Pipeline(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    name = models.CharField(max_length=120)


class Stage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pipeline = models.ForeignKey(Pipeline, on_delete=models.PROTECT, related_name="stages")
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=16, default="#648fde")
    sort_order = models.PositiveIntegerField(default=0)


class Deal(WorkspaceRecord):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="deals")
    pipeline = models.ForeignKey(Pipeline, on_delete=models.PROTECT)
    stage = models.ForeignKey(Stage, on_delete=models.PROTECT)
    employee = models.ForeignKey(Membership, on_delete=models.PROTECT, null=True, blank=True)
    title = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="KGS")
    note = models.TextField(blank=True)
    custom_fields = models.JSONField(default=dict)


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    actor = models.ForeignKey(Membership, on_delete=models.PROTECT)
    action = models.CharField(max_length=80)
    entity_id = models.UUIDField()
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class LoginAttempt(models.Model):
    key = models.CharField(primary_key=True, max_length=64)
    failures = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()


class Warehouse(WorkspaceRecord):
    name = models.CharField(max_length=160)
    address = models.CharField(max_length=255, blank=True)


class Product(WorkspaceRecord):
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, blank=True)
    category = models.CharField(max_length=120, blank=True)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    minimum = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit = models.CharField(max_length=24, default="шт.")
    product_type = models.CharField(max_length=16, choices=[("goods", "Товар"), ("service", "Услуга")], default="goods")
    weighted = models.BooleanField(default=False)
    is_free_price = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "sku"], name="product_workspace_sku"),
            models.CheckConstraint(condition=Q(price__gte=0, cost__gte=0, minimum__gte=0), name="product_nonnegative_values"),
        ]


class Stock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stocks")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "warehouse"], name="stock_product_warehouse"),
            models.CheckConstraint(condition=Q(quantity__gte=0), name="stock_nonnegative"),
        ]


class Register(WorkspaceRecord):
    name = models.CharField(max_length=120)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)


class Shift(WorkspaceRecord):
    cashier = models.ForeignKey(Membership, on_delete=models.PROTECT)
    register = models.ForeignKey(Register, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    opening_cash = models.DecimalField(max_digits=14, decimal_places=2)
    actual_cash = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    expected_cash = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    closed_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cashier"], condition=Q(closed_at=None), name="one_open_cashier_shift"),
            models.UniqueConstraint(fields=["register"], condition=Q(closed_at=None), name="one_open_register_shift"),
            models.CheckConstraint(condition=Q(opening_cash__gte=0), name="shift_opening_nonnegative"),
        ]


class Coupon(WorkspaceRecord):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="coupons")
    code = models.CharField(max_length=80)
    kind = models.CharField(max_length=16, choices=[("percent", "Процент"), ("fixed", "Сумма")])
    value = models.DecimalField(max_digits=14, decimal_places=2)
    expires_at = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "code"], name="coupon_workspace_code"),
            models.CheckConstraint(condition=Q(value__gt=0) & (Q(kind="fixed") | Q(kind="percent", value__lte=100)), name="coupon_valid_value"),
        ]


class Sale(WorkspaceRecord):
    request_id = models.UUIDField()
    payload_hash = models.CharField(max_length=64)
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="sales")
    cashier = models.ForeignKey(Membership, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, related_name="sales")
    customer_name = models.CharField(max_length=255, blank=True)
    customer_phone = models.CharField(max_length=32, blank=True)
    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, null=True)
    coupon_code = models.CharField(max_length=80, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=14, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    refunded = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=24, default="completed")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "request_id"], name="sale_workspace_request"),
            models.CheckConstraint(condition=Q(subtotal__gte=0, discount__gte=0, total__gte=0,
                discount__lte=F("subtotal"), refunded__gte=0, refunded__lte=F("total")), name="sale_valid_totals"),
        ]


class SaleItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, blank=True)
    tracks_stock = models.BooleanField(default=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    cost = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=14, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    returned = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    refunded = models.DecimalField(max_digits=14, decimal_places=2, default=0)


    class Meta:
        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0, price__gte=0, cost__gte=0,
            discount__gte=0, total__gte=0, returned__gte=0, returned__lte=F("quantity"),
            refunded__gte=0, refunded__lte=F("total")), name="sale_item_valid_values")]


PAYMENT_METHODS = [("cash", "Наличные"), ("card", "Карта"), ("qr", "QR")]


class Payment(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="payments")
    method = models.CharField(max_length=8, choices=PAYMENT_METHODS)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="payment_positive")]


class Refund(WorkspaceRecord):
    request_id = models.UUIDField()
    payload_hash = models.CharField(max_length=64)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="refunds")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="refunds")
    cashier = models.ForeignKey(Membership, on_delete=models.PROTECT)
    reason = models.CharField(max_length=1000)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=8, choices=PAYMENT_METHODS, default="cash")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "request_id"], name="refund_workspace_request"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="refund_nonnegative")]


class RefundItem(models.Model):
    refund = models.ForeignKey(Refund, on_delete=models.PROTECT, related_name="items")
    sale_item = models.ForeignKey(SaleItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    amount = models.DecimalField(max_digits=14, decimal_places=2)


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    actor = models.ForeignKey(Membership, on_delete=models.PROTECT)
    kind = models.CharField(max_length=16)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    balance_after = models.DecimalField(max_digits=14, decimal_places=3)
    reference_id = models.UUIDField()
    request_id = models.UUIDField(null=True)
    payload_hash = models.CharField(max_length=64, blank=True)
    note = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "request_id"],
            condition=Q(request_id__isnull=False), name="stock_movement_workspace_request")]
