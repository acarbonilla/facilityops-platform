"""Development settings for the FacilityOps backend."""

from decouple import Csv, config

from .base import *  # noqa: F401,F403

SECRET_KEY = config("SECRET_KEY", default="change-me")
DEBUG = config_bool("DEBUG", default=True)
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
