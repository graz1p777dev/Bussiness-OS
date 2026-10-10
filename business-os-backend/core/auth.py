import json
from datetime import timedelta
from django.contrib.auth import authenticate, login
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from .models import LoginAttempt, Membership


@require_GET
def csrf(request):
    response = JsonResponse({"csrfToken": get_token(request)})
    response["Cache-Control"] = "no-store"
    return response


@require_POST
@csrf_protect
def sign_in(request):
    # Persistent per-IP limit for this loopback-only service; no proxy headers are trusted.
    key = salted_hmac("bos-login", request.META.get("REMOTE_ADDR", "unknown")).hexdigest()
    with transaction.atomic():
        attempt, _ = LoginAttempt.objects.select_for_update().get_or_create(
            key=key, defaults={"window_start": timezone.now()})
        if attempt.window_start < timezone.now() - timedelta(minutes=1):
            attempt.window_start, attempt.failures = timezone.now(), 0
        if attempt.failures >= 10:
            return JsonResponse({"detail": "Слишком много попыток. Повторите через минуту."}, status=429)
        attempt.failures += 1
        attempt.save()
    try:
        body = json.loads(request.body)
        email, password = body.get("email"), body.get("password")
        if not isinstance(email, str) or not isinstance(password, str) or len(email) > 254 or len(password) > 1024:
            raise ValueError
    except (ValueError, AttributeError):
        return JsonResponse({"detail": "Некорректный запрос."}, status=400)
    user = authenticate(request, email=email.strip().lower(), password=password)
    if user is None:
        return JsonResponse({"detail": "Неверные данные входа."}, status=401)
    login(request, user)
    memberships = list(Membership.objects.filter(user=user, status="active").select_related("workspace"))
    request.session["memberships"] = {str(item.id): str(item.session_version) for item in memberships}
    response = JsonResponse({"csrfToken": get_token(request), "workspaces": [
        {"id": str(item.workspace_id), "name": item.workspace.name, "employeeId": str(item.id)}
        for item in memberships]})
    response["Cache-Control"] = "no-store"
    return response
