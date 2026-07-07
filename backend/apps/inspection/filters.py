from datetime import datetime, time

from apps.master_data.services import apply_query_param_filters
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime


def _parse_date_like(value, *, end_of_day=False):
    if not value:
        return None

    parsed_datetime = parse_datetime(value)
    if parsed_datetime is not None:
        return parsed_datetime

    parsed_date = parse_date(value)
    if parsed_date is None:
        return None

    return datetime.combine(
        parsed_date,
        time.max if end_of_day else time.min,
        tzinfo=timezone.get_current_timezone(),
    )


def apply_inspection_search(queryset, search_term):
    if not search_term:
        return queryset

    normalized = search_term.strip()
    if not normalized:
        return queryset

    return queryset.filter(
        Q(inspection_number__icontains=normalized)
        | Q(title__icontains=normalized)
        | Q(area__name__icontains=normalized)
        | Q(remarks__icontains=normalized)
        | Q(building__name__icontains=normalized)
        | Q(inspector__email__icontains=normalized)
        | Q(supervisor__email__icontains=normalized)
    )


def apply_inspection_date_filters(queryset, params):
    scheduled_from = _parse_date_like(params.get("scheduled_from"))
    scheduled_to = _parse_date_like(params.get("scheduled_to"), end_of_day=True)
    started_from = _parse_date_like(params.get("started_from"))
    started_to = _parse_date_like(params.get("started_to"), end_of_day=True)
    completed_from = _parse_date_like(params.get("completed_from"))
    completed_to = _parse_date_like(params.get("completed_to"), end_of_day=True)

    if scheduled_from:
        queryset = queryset.filter(scheduled_date__gte=scheduled_from)
    if scheduled_to:
        queryset = queryset.filter(scheduled_date__lte=scheduled_to)
    if started_from:
        queryset = queryset.filter(started_date__gte=started_from)
    if started_to:
        queryset = queryset.filter(started_date__lte=started_to)
    if completed_from:
        queryset = queryset.filter(completed_date__gte=completed_from)
    if completed_to:
        queryset = queryset.filter(completed_date__lte=completed_to)

    return queryset


def apply_inspection_numeric_filters(queryset, params):
    score_min = params.get("score_min")
    score_max = params.get("score_max")
    corrective_action_status = params.get("corrective_action_status")

    if score_min not in (None, ""):
        queryset = queryset.filter(score__gte=score_min)
    if score_max not in (None, ""):
        queryset = queryset.filter(score__lte=score_max)
    if corrective_action_status:
        queryset = queryset.filter(
            corrective_actions__status=corrective_action_status
        )
    return queryset


def apply_inspection_ordering(queryset, ordering):
    ordering_map = {
        "number": "inspection_number",
        "-number": "-inspection_number",
        "title": "title",
        "-title": "-title",
        "priority": "priority_rank",
        "-priority": "-priority_rank",
        "status": "status_rank",
        "-status": "-status_rank",
        "scheduled": "scheduled_date",
        "-scheduled": "-scheduled_date",
        "completed": "completed_date",
        "-completed": "-completed_date",
        "score": "score",
        "-score": "-score",
        "created": "created_at",
        "-created": "-created_at",
        "updated": "updated_at",
        "-updated": "-updated_at",
    }
    resolved = ordering_map.get(ordering)
    if not resolved:
        return queryset.order_by("-scheduled_date", "-created_at")
    return queryset.order_by(resolved, "-updated_at", "-created_at")


def apply_finding_filters(queryset, params):
    if params.get("inspection"):
        queryset = queryset.filter(inspection_id=params["inspection"])
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("severity"):
        queryset = queryset.filter(severity=params["severity"])
    if params.get("finding_type"):
        queryset = queryset.filter(finding_type=params["finding_type"])
    if params.get("search"):
        search = params["search"].strip()
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(recommendation__icontains=search)
            | Q(inspection__inspection_number__icontains=search)
        )
    return queryset.order_by("-created_at")


def apply_corrective_action_filters(queryset, params):
    if params.get("inspection"):
        queryset = queryset.filter(inspection_id=params["inspection"])
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("assigned_to"):
        queryset = queryset.filter(assigned_to_id=params["assigned_to"])
    if params.get("verification_status"):
        queryset = queryset.filter(verification_status=params["verification_status"])
    if params.get("search"):
        search = params["search"].strip()
        queryset = queryset.filter(
            Q(notes__icontains=search)
            | Q(finding__description__icontains=search)
            | Q(inspection__inspection_number__icontains=search)
        )
    return queryset.order_by("due_date", "-created_at")


__all__ = (
    "apply_corrective_action_filters",
    "apply_finding_filters",
    "apply_inspection_date_filters",
    "apply_inspection_numeric_filters",
    "apply_inspection_ordering",
    "apply_inspection_search",
    "apply_query_param_filters",
)

