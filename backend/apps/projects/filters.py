from apps.master_data.services import apply_query_param_filters
from django.db.models import Q
from django.utils.dateparse import parse_date


def apply_project_search(queryset, search_term):
    if not search_term:
        return queryset

    normalized = search_term.strip()
    if not normalized:
        return queryset

    return queryset.filter(
        Q(project_code__icontains=normalized)
        | Q(name__icontains=normalized)
        | Q(description__icontains=normalized)
        | Q(project_manager__email__icontains=normalized)
        | Q(project_manager__first_name__icontains=normalized)
        | Q(project_manager__last_name__icontains=normalized)
    )


def apply_project_date_filters(queryset, params):
    planned_start_from = parse_date(params.get("planned_start_date_from") or "")
    planned_start_to = parse_date(params.get("planned_start_date_to") or "")
    planned_end_from = parse_date(params.get("planned_end_date_from") or "")
    planned_end_to = parse_date(params.get("planned_end_date_to") or "")

    if planned_start_from:
        queryset = queryset.filter(planned_start_date__gte=planned_start_from)
    if planned_start_to:
        queryset = queryset.filter(planned_start_date__lte=planned_start_to)
    if planned_end_from:
        queryset = queryset.filter(planned_end_date__gte=planned_end_from)
    if planned_end_to:
        queryset = queryset.filter(planned_end_date__lte=planned_end_to)

    return queryset


def apply_project_ordering(queryset, ordering):
    ordering_map = {
        "name": "name",
        "-name": "-name",
        "code": "project_code",
        "-code": "-project_code",
        "project_code": "project_code",
        "-project_code": "-project_code",
        "status": "status",
        "-status": "-status",
        "priority": "priority",
        "-priority": "-priority",
        "planned_start_date": "planned_start_date",
        "-planned_start_date": "-planned_start_date",
        "planned_end_date": "planned_end_date",
        "-planned_end_date": "-planned_end_date",
        "created": "created_at",
        "-created": "-created_at",
        "created_at": "created_at",
        "-created_at": "-created_at",
        "updated": "updated_at",
        "-updated": "-updated_at",
        "updated_at": "updated_at",
        "-updated_at": "-updated_at",
    }
    resolved = ordering_map.get(ordering)
    if not resolved:
        return queryset.order_by("-created_at")
    return queryset.order_by(resolved, "-created_at")


__all__ = (
    "apply_project_date_filters",
    "apply_project_ordering",
    "apply_project_search",
    "apply_query_param_filters",
)
