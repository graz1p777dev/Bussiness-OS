from getpass import getpass
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.access import ACTIONS
from core.models import Membership, Pipeline, Role, Stage, User, Workspace


class Command(BaseCommand):
    help = "Create an isolated workspace and owner, without demo data or default credentials."

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument("--owner-name", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise CommandError("Этот аккаунт уже существует; bootstrap не меняет существующих пользователей.")
        user = User(email=email, name=options["owner_name"])
        user.full_clean(exclude=["password"])
        password = getpass("Пароль владельца (минимум 12 символов): ")
        if password != getpass("Повторите пароль: "):
            raise CommandError("Пароли не совпадают.")
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from None
        user.set_password(password)
        user.save()
        workspace = Workspace.objects.create(name=options["name"])
        owner = Role.objects.create(workspace=workspace, slug="owner", name="Владелец",
            pages=["crm", "customers", "pos", "inventory"], actions=[action for action in ACTIONS if action != "production"])
        Role.objects.create(workspace=workspace, slug="manager", name="Менеджер", pages=["crm", "customers", "pos"],
                            actions=["create", "edit", "finance", "password"])
        Role.objects.create(workspace=workspace, slug="cashier", name="Кассир", pages=["crm", "customers", "pos"],
            actions=["create", "edit", "finance", "password"], page_actions={"crm": [], "customers": []})
        Role.objects.create(workspace=workspace, slug="warehouse", name="Склад", pages=["inventory"],
                            actions=["create", "edit", "inventory", "password"])
        Role.objects.create(workspace=workspace, slug="reader", name="Чтение", pages=["crm", "customers"], actions=[])
        Membership.objects.create(workspace=workspace, user=user, role=owner)
        for name in ["Продажи", "Повторные продажи"]:
            pipeline = Pipeline.objects.create(workspace=workspace, name=name)
            for index, label in enumerate(["Неразобранное", "Первичный контакт", "Переговоры", "Оплата", "Комплектация", "Доставка"]):
                Stage.objects.create(pipeline=pipeline, name=label, sort_order=index)
        self.stdout.write(self.style.SUCCESS(f"Workspace создан: {workspace.id}. Клиентов и продаж пока нет."))
