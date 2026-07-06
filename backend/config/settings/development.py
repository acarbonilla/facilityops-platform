"""Development settings for the FacilityOps backend."""

from decouple import Csv, config

from .base import *  # noqa: F401,F403

DEFAULT_DEV_CORS_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

SECRET_KEY = config("SECRET_KEY", default="change-me")
DEBUG = config_bool("DEBUG", default=True)
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)

configured_cors_allowed_origins = list(
    config(
        "CORS_ALLOWED_ORIGINS",
        default=",".join(DEFAULT_DEV_CORS_ALLOWED_ORIGINS),
        cast=Csv(),
    )
)
for origin in DEFAULT_DEV_CORS_ALLOWED_ORIGINS:
    if origin not in configured_cors_allowed_origins:
        configured_cors_allowed_origins.append(origin)

CORS_ALLOWED_ORIGINS = configured_cors_allowed_origins
