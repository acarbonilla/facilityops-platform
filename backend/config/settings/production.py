"""Production settings for the FacilityOps backend."""

import dj_database_url
from decouple import Csv, config

from .base import *  # noqa: F401,F403

SECRET_KEY = config("SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv())
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv())
DATABASES = {
    "default": dj_database_url.parse(
        config("DATABASE_URL"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
