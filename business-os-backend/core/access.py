"""Fail-closed page/action authorization, adapted from CRM authz + frontend team.ts."""
from uuid import UUID
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Membership

ACTIONS = ["create", "edit", "remove", "export", "ai", "finance", "inventory",
           "manageTeam", "password", "production"]


def actor_for(request):
    if not request.user.is_authenticated or not request.user.is_active:
        raise PermissionDenied("Требуется активный аккаунт.")
    memberships = Membership.objects.select_related("role", "workspace", "user").filter(
        user=request.user, status="active")
    workspace = request.headers.get("X-Workspace-Id")
    if workspace:
        try:
            workspace = UUID(workspace)
        except ValueError:
            raise ValidationError({"workspaceId": "Некорректный ID."}) from None
        memberships = memberships.filter(workspace_id=workspace)
    choices = list(memberships[:2])
    if len(choices) != 1:
        raise PermissionDenied("Выберите доступный workspace через X-Workspace-Id.")
    actor = choices[0]
    if actor.role.workspace_id != actor.workspace_id:
        raise PermissionDenied("Роль не принадлежит workspace.")
    if request.session.get("memberships", {}).get(str(actor.id)) != str(actor.session_version):
        raise PermissionDenied("Доступ изменился. Войдите заново.")
    return actor


def can(actor, page, action=None):
    role = actor.role
    if actor.status != "active" or role.workspace_id != actor.workspace_id:
        return False
    if not isinstance(role.pages, list) or page not in role.pages:
        return False
    if action is None:
        return True
    if not isinstance(role.page_actions, dict):
        return False
    actions = role.page_actions.get(page, role.actions)
    return action in ACTIONS and isinstance(actions, list) and action in actions


def require(actor, page, action=None):
    if not can(actor, page, action):
        raise PermissionDenied("Недостаточно прав на этот раздел или действие.")


def require_customers(actor, action=None):
    if not any(can(actor, page, action) for page in ("customers", "crm")):
        raise PermissionDenied("Недостаточно прав на клиентов.")
