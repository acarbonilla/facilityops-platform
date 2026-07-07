from datetime import datetime, time

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from apps.master_data.services import apply_query_param_filters


def _parse_bool(value):
    if value is None:
        return None

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return None


def _parse_date_like(value, *, end_of_day=False):
    if not value:
        return None

    parsed_datetime = parse_datetime(value)
    if parsed_datetime is not None:
        return parsed_datetime

    parsed_date = parse_date(value)
    if parsed_date is None:
        return None

    if end_of_day:
        return datetime.combine(
            parsed_date,
            time.max,
            tzinfo=timezone.get_current_timezone(),
        )

    return datetime.combine(
        parsed_date,
        time.min,
        tzinfo=timezone.get_current_timezone(),
    )


def apply_maintenance_search(queryset, search_term):
    if not search_term:
        return queryset

    normalized = search_term.strip()
    if not normalized:
        return queryset

    return queryset.filter(
        Q(work_order_number__icontains=normalized)
        | Q(title__icontains=normalized)
        | Q(description__icontains=normalized)
        | Q(asset__name__icontains=normalized)
        | Q(asset__code__icontains=normalized)
        | Q(assignee__email__icontains=normalized)
        | Q(requester__email__icontains=normalized)
        | Q(building__name__icontains=normalized)
        | Q(floor__name__icontains=normalized)
        | Q(area__name__icontains=normalized)
        | Q(department__name__icontains=normalized)
    )


def apply_maintenance_boolean_filters(queryset, params):
    overdue = _parse_bool(params.get("overdue"))
    has_attachments = _parse_bool(params.get("has_attachments"))

    if overdue is True:
        queryset = queryset.filter(due_at__lt=timezone.now()).exclude(
            status__in=("completed", "closed", "cancelled")
        )
    elif overdue is False:
        queryset = queryset.exclude(
            due_at__lt=timezone.now(),
            status__in=("completed", "closed", "cancelled"),
        )

    if has_attachments is True:
        queryset = queryset.filter(attachments__isnull=False)
    elif has_attachments is False:
        queryset = queryset.filter(attachments__isnull=True)

    return queryset


def apply_maintenance_people_filters(queryset, params):
    assignee_email = params.get("assignee_email")
    requester_email = params.get("requester_email")

    if assignee_email:
        queryset = queryset.filter(assignee__email__icontains=assignee_email.strip())
    if requester_email:
        queryset = queryset.filter(requester__email__icontains=requester_email.strip())

    return queryset


def apply_maintenance_date_filters(queryset, params):
    requested_from = _parse_date_like(params.get("requested_from"))
    requested_to = _parse_date_like(params.get("requested_to"), end_of_day=True)
    created_from = _parse_date_like(params.get("created_from"))
    created_to = _parse_date_like(params.get("created_to"), end_of_day=True)
    updated_from = _parse_date_like(params.get("updated_from"))
    updated_to = _parse_date_like(params.get("updated_to"), end_of_day=True)
    due_from = _parse_date_like(params.get("due_from"))
    due_to = _parse_date_like(params.get("due_to"), end_of_day=True)

    if requested_from:
        queryset = queryset.filter(requested_at__gte=requested_from)
    if requested_to:
        queryset = queryset.filter(requested_at__lte=requested_to)
    if created_from:
        queryset = queryset.filter(created_at__gte=created_from)
    if created_to:
        queryset = queryset.filter(created_at__lte=created_to)
    if updated_from:
        queryset = queryset.filter(updated_at__gte=updated_from)
    if updated_to:
        queryset = queryset.filter(updated_at__lte=updated_to)
    if due_from:
        queryset = queryset.filter(due_at__gte=due_from)
    if due_to:
        queryset = queryset.filter(due_at__lte=due_to)

    return queryset


def apply_maintenance_ordering(queryset, ordering):
    ordering_map = {
        "number": "work_order_number",
        "-number": "-work_order_number",
        "title": "title",
        "-title": "-title",
        "priority": "priority_rank",
        "-priority": "-priority_rank",
        "status": "status_rank",
        "-status": "-status_rank",
        "created": "created_at",
        "-created": "-created_at",
        "updated": "updated_at",
        "-updated": "-updated_at",
        "due_date": "due_at",
        "-due_date": "-due_at",
        "requested": "requested_at",
        "-requested": "-requested_at",
    }
    resolved = ordering_map.get(ordering)
    if not resolved:
        return queryset.order_by("-requested_at", "-created_at")
    return queryset.order_by(resolved, "-updated_at", "-created_at")


__all__ = (
    "apply_maintenance_boolean_filters",
    "apply_maintenance_date_filters",
    "apply_maintenance_ordering",
    "apply_maintenance_people_filters",
    "apply_maintenance_search",
    "apply_query_param_filters",
)
