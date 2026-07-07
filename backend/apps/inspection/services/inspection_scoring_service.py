from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum

from apps.inspection.models import Inspection

ZERO = Decimal("0.00")
HUNDRED = Decimal("100.00")


def calculate_inspection_score(inspection):
    aggregates = inspection.items.aggregate(
        total_score=Sum("score"),
        total_max_score=Sum("max_score"),
    )
    total_score = aggregates["total_score"] or ZERO
    total_max_score = aggregates["total_max_score"] or ZERO
    if total_max_score <= ZERO:
        return None

    return ((total_score / total_max_score) * HUNDRED).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def refresh_inspection_score(*, inspection, actor=None):
    inspection.score = calculate_inspection_score(inspection)
    if actor:
        inspection.updated_by = str(actor.id)
    inspection.save(update_fields=("score", "updated_by", "updated_at"))
    return inspection.score


def get_inspection_sla_targets(priority):
    if priority == Inspection.Priority.CRITICAL:
        return 240, 60
    if priority == Inspection.Priority.HIGH:
        return 480, 120
    if priority == Inspection.Priority.MEDIUM:
        return 1440, 240
    return 2880, 480

