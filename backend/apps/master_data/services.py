from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError


def apply_query_param_filters(queryset, params, allowed_filters):
    for param in allowed_filters:
        value = params.get(param)
        if value not in (None, ""):
            try:
                queryset = queryset.filter(**{param: value})
            except (DjangoValidationError, ValueError):
                raise ValidationError({param: "Invalid filter value."}) from None
    return queryset
