"""Local-only backend. Production settings and deployment are deliberately absent."""
import os
import secrets
from pathlib import Path
from urllib.parse import unquote, urlparse
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
STATE_DIR = Path(os.environ.get("BOS_STATE_DIR", BASE_DIR / ".state")).resolve()
STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
SECRET_KEY = os.environ.get("BOS_SECRET_KEY", "")
if not SECRET_KEY:
    key_file = STATE_DIR / "django-secret"
    try:
        with open(key_file, "x", opener=lambda path, flags: os.open(path, flags, 0o600)) as stream:
            stream.write(secrets.token_urlsafe(64))
    except FileExistsError:
        pass
    SECRET_KEY = key_file.read_text().strip()
if len(SECRET_KEY) < 32:
    raise ValueError("BOS_SECRET_KEY must contain at least 32 characters")

DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"]
INSTALLED_APPS = [
    "django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions",
    "corsheaders", "rest_framework", "core",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware", "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": STATE_DIR / "business-os.sqlite3"}}
if os.environ.get("BOS_DATABASE_URL"):
    database = urlparse(os.environ["BOS_DATABASE_URL"])
    if database.scheme not in ("postgres", "postgresql") or not database.hostname or not database.path[1:]:
        raise ValueError("BOS_DATABASE_URL must identify an isolated PostgreSQL database")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql", "NAME": unquote(database.path[1:]),
        "USER": unquote(database.username or ""), "PASSWORD": unquote(database.password or ""),
        "HOST": database.hostname, "PORT": database.port or 5432,
    }}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
}
CORS_ALLOWED_ORIGINS = [value for value in os.environ.get(
    "BOS_ALLOWED_ORIGINS", "http://127.0.0.1:5174,http://localhost:5174"
).split(",") if value]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [*default_headers, "x-workspace-id"]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
SESSION_COOKIE_NAME = "bos_session"
CSRF_COOKIE_NAME = "bos_csrf"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SAMESITE = "Strict"
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_COOKIE_SECURE = False  # Loopback HTTP only; production HTTPS configuration is a separate gate.
CSRF_COOKIE_SECURE = False
DATA_UPLOAD_MAX_MEMORY_SIZE = 128 * 1024
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Asia/Bishkek"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
