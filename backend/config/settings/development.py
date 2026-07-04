"""Development settings for the FacilityOps backend."""

import dj_database_url
from decouple import Csv, config

from .base import *  # noqa: F403

SECRET_KEY = config("SECRET_KEY", default="change-me")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000",
    cast=Csv(),
)

database_url = config("DATABASE_URL", default="")
if database_url:
    DATABASES = {"default": dj_database_url.parse(database_url)}
else:
    DATABASES = {  # noqa: F405
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
        }
    }
