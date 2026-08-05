"""FO-100 intake-aware reporting helpers.

Separates ticket classification pending (FO-096) from AI decision pending (FO-088).
"""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone

from apps.fm_tickets.models import AITicketAnalysis, FmTicket


CLASSIFICATION_INCOMPLETE_Q = (
    Q(category=FmTicket.Category.UNCLASSIFIED)
    | Q(priority=FmTicket.Priority.PENDING_REVIEW)
    | Q(building_id__isnull=True)
)

# Same incomplete predicate expressed against AITicketAnalysis → ticket joins.
ANALYSIS_TICKET_CLASSIFICATION_INCOMPLETE_Q = (
    Q(ticket__category=FmTicket.Category.UNCLASSIFIED)
    | Q(ticket__priority=FmTicket.Priority.PENDING_REVIEW)
    | Q(ticket__building_id__isnull=True)
)


def is_intake_classification_incomplete(
    *,
    category: str | None = None,
    priority: str | None = None,
    building_id=None,
) -> bool:
    return (
        category == FmTicket.Category.UNCLASSIFIED
        or priority == FmTicket.Priority.PENDING_REVIEW
        or building_id in (None, "")
    )


def is_non_operational_final_value(*, category: str = "", priority: str = "") -> bool:
    """Exclude FO-087 finals that are still intake placeholders from agreement."""
    return category == FmTicket.Category.UNCLASSIFIED or (
        priority == FmTicket.Priority.PENDING_REVIEW
    )


def annotate_ticket_intake_counts(queryset) -> dict[str, int]:
    """Counts for an already-scoped FmTicket queryset."""
    aggregates = queryset.aggregate(
        unclassified_count=Count(
            "id", filter=Q(category=FmTicket.Category.UNCLASSIFIED)
        ),
        pending_classification_count=Count(
            "id", filter=Q(priority=FmTicket.Priority.PENDING_REVIEW)
        ),
        missing_building_count=Count("id", filter=Q(building_id__isnull=True)),
        classification_incomplete_count=Count("id", filter=CLASSIFICATION_INCOMPLETE_Q),
        classified_count=Count("id", filter=~CLASSIFICATION_INCOMPLETE_Q),
        employee_intake_count=Count(
            "id",
            filter=Q(
                category=FmTicket.Category.UNCLASSIFIED,
                priority=FmTicket.Priority.PENDING_REVIEW,
                source=FmTicket.Source.WEB,
            ),
        ),
    )
    return {key: int(value or 0) for key, value in aggregates.items()}


def count_ai_ready_awaiting_classification(user, *, ticket_queryset=None) -> int:
    """Completed AI analyses whose tickets still need FM classification."""
    from apps.reporting.tenant_scope import scope_queryset_to_user

    analyses = AITicketAnalysis.objects.filter(
        is_deleted=False,
        status=AITicketAnalysis.Status.COMPLETED,
        ticket__is_deleted=False,
    ).filter(ANALYSIS_TICKET_CLASSIFICATION_INCOMPLETE_Q)
    analyses = scope_queryset_to_user(analyses, user, tenant_field="tenant_id")
    if ticket_queryset is not None:
        analyses = analyses.filter(ticket_id__in=ticket_queryset.values("id"))
    return analyses.count()


def average_hours_since(queryset, field_name: str) -> float | None:
    """Average age in hours for non-null datetime field values."""
    now = timezone.now()
    values = list(queryset.exclude(**{f"{field_name}__isnull": True}).values_list(field_name, flat=True)[:500])
    if not values:
        return None
    total = 0.0
    for value in values:
        total += max(0.0, (now - value).total_seconds() / 3600.0)
    return round(total / len(values), 2)
