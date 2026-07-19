from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import BooleanField
from rest_framework.exceptions import ValidationError


def _normalize_boolean_filter(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.lower()
        if normalized in ("true", "1"):
            return True
        if normalized in ("false", "0"):
            return False
    raise ValueError


def apply_query_param_filters(queryset, params, allowed_filters):
    for param in allowed_filters:
        value = params.get(param)
        if value not in (None, ""):
            try:
                field = queryset.model._meta.get_field(param)
                if isinstance(field, BooleanField):
                    value = _normalize_boolean_filter(value)
                queryset = queryset.filter(**{param: value})
            except (DjangoValidationError, ValueError):
                raise ValidationError({param: ["Invalid filter value."]}) from None
    return queryset
