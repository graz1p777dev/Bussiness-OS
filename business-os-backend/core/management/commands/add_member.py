from getpass import getpass
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import Membership, Role, User


class Command(BaseCommand):
    help = "Create a local workspace member; no invitation is sent."

    def add_arguments(self, parser):
        for field in ["workspace", "role", "email", "name"]:
            parser.add_argument("--" + field, required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            role = Role.objects.get(workspace_id=options["workspace"], slug=options["role"])
        except (Role.DoesNotExist, ValidationError):
            raise CommandError("Workspace или роль не найдены.") from None
        email = options["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise CommandError("Аккаунт уже существует. Его пароль и членство не изменены.")
        user = User(email=email, name=options["name"])
        user.full_clean(exclude=["password"])
        password = getpass("Пароль нового сотрудника: ")
        if password != getpass("Повторите пароль: "):
            raise CommandError("Пароли не совпадают.")
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from None
        user.set_password(password)
        user.save()
        member = Membership.objects.create(workspace=role.workspace, role=role, user=user)
        self.stdout.write(self.style.SUCCESS(f"Сотрудник создан: {member.id}"))
