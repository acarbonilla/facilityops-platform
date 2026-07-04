def apply_query_param_filters(queryset, params, allowed_filters):
    filters = {}
    for param in allowed_filters:
        value = params.get(param)
        if value not in (None, ""):
            filters[param] = value
    if not filters:
        return queryset
    return queryset.filter(**filters)
