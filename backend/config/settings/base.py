"""Settings shared by all FacilityOps backend environments."""

from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def config_bool(name, default=False):
    value = config(name, default=None)

    if value is None:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"", "0", "false", "no", "off"}:
        return False

    return default


def config_int(name, default):
    value = config(name, default=None)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


SECRET_KEY = config("SECRET_KEY", default="")
DEBUG = config_bool("DEBUG", default=False)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "apps.accounts",
    "apps.access_control",
    "apps.attachments",
    "apps.dashboard",
    "apps.fm_tickets",
    "apps.inspection",
    "apps.maintenance",
    "apps.master_data",
    "apps.notifications",
    "apps.reporting",
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

database_url = config("DATABASE_URL", default="")
if database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            database_url,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

password_validation = "django.contrib.auth.password_validation"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": f"{password_validation}.UserAttributeSimilarityValidator",
    },
    {
        "NAME": f"{password_validation}.MinimumLengthValidator",
    },
    {
        "NAME": f"{password_validation}.CommonPasswordValidator",
    },
    {
        "NAME": f"{password_validation}.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = config("TIME_ZONE", default="Asia/Manila")
USE_I18N = True
USE_TZ = True

CELERY_BROKER_URL = config(
    "CELERY_BROKER_URL",
    default="redis://localhost:6379/0",
)
CELERY_RESULT_BACKEND = config(
    "CELERY_RESULT_BACKEND",
    default="redis://localhost:6379/1",
)
CELERY_TASK_ALWAYS_EAGER = config(
    "CELERY_TASK_ALWAYS_EAGER",
    default=config_bool("CELERY_TASK_ALWAYS_EAGER", default=False),
)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# FO-063: automatic RESOLVED → CLOSED after acknowledgement period.
_fm_ticket_auto_close_days = config_int("FM_TICKET_AUTO_CLOSE_DAYS", default=7)
FM_TICKET_AUTO_CLOSE_DAYS = (
    _fm_ticket_auto_close_days if _fm_ticket_auto_close_days >= 1 else 7
)
_fm_ticket_auto_close_batch = config_int(
    "FM_TICKET_AUTO_CLOSE_BATCH_SIZE",
    default=100,
)
FM_TICKET_AUTO_CLOSE_BATCH_SIZE = (
    _fm_ticket_auto_close_batch if _fm_ticket_auto_close_batch >= 1 else 100
)
FM_TICKET_AUTO_CLOSE_ENABLED = config_bool(
    "FM_TICKET_AUTO_CLOSE_ENABLED",
    default=True,
)

CELERY_BEAT_SCHEDULE = {}
if FM_TICKET_AUTO_CLOSE_ENABLED:
    from celery.schedules import crontab

    CELERY_BEAT_SCHEDULE["fm-tickets-process-automatic-closures"] = {
        "task": "fm_tickets.process_automatic_ticket_closures",
        "schedule": crontab(minute=0),
    }

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# FO-079 attachment storage — private by default; not publicly served.
ATTACHMENT_STORAGE_BACKEND = config("ATTACHMENT_STORAGE_BACKEND", default="local")
ATTACHMENT_STORAGE_ROOT = config(
    "ATTACHMENT_STORAGE_ROOT",
    default=str(BASE_DIR / "private_media" / "attachments"),
)
ATTACHMENT_MAX_UPLOAD_BYTES = config_int(
    "ATTACHMENT_MAX_UPLOAD_BYTES",
    default=10 * 1024 * 1024,
)
# Reserved for future S3-compatible private object storage (not implemented in FO-079).
ATTACHMENT_S3_BUCKET = config("ATTACHMENT_S3_BUCKET", default="")
ATTACHMENT_S3_REGION = config("ATTACHMENT_S3_REGION", default="")
ATTACHMENT_S3_ENDPOINT_URL = config("ATTACHMENT_S3_ENDPOINT_URL", default="")
ATTACHMENT_S3_SIGNED_URL_TTL_SECONDS = config_int(
    "ATTACHMENT_S3_SIGNED_URL_TTL_SECONDS",
    default=300,
)

# FO-085: AI provider selection and Gemini Vision configuration.
# Default remains placeholder so local/tests never require an API key.
FACILITYOPS_AI_PROVIDER = config("FACILITYOPS_AI_PROVIDER", default="placeholder").strip().lower()
FACILITYOPS_GEMINI_ENABLED = config_bool("FACILITYOPS_GEMINI_ENABLED", default=False)
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
FACILITYOPS_GEMINI_MODEL = config("FACILITYOPS_GEMINI_MODEL", default="gemini-2.0-flash").strip()
FACILITYOPS_GEMINI_TIMEOUT_SECONDS = config_int(
    "FACILITYOPS_GEMINI_TIMEOUT_SECONDS",
    default=60,
)
FACILITYOPS_GEMINI_MAX_IMAGES = config_int("FACILITYOPS_GEMINI_MAX_IMAGES", default=5)
FACILITYOPS_GEMINI_MAX_TOTAL_BYTES = config_int(
    "FACILITYOPS_GEMINI_MAX_TOTAL_BYTES",
    default=15 * 1024 * 1024,
)
_gemini_temperature = config("FACILITYOPS_GEMINI_TEMPERATURE", default="0.2")
try:
    FACILITYOPS_GEMINI_TEMPERATURE = float(_gemini_temperature)
except (TypeError, ValueError):
    FACILITYOPS_GEMINI_TEMPERATURE = 0.2
FACILITYOPS_AI_STORE_RAW_RESPONSE = config_bool(
    "FACILITYOPS_AI_STORE_RAW_RESPONSE",
    default=False,
)
FACILITYOPS_AI_MAX_ATTEMPTS = config_int("FACILITYOPS_AI_MAX_ATTEMPTS", default=3)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="",
    cast=Csv(),
)

pagination_class = "common.pagination.StandardResultsSetPagination"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": pagination_class,
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}
