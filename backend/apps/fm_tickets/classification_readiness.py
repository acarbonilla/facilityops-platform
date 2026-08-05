"""FO-098 operational classification readiness checks.

Facility Managers must set final category, priority, and building before
assignment or work-order generation. AI recommendations remain advisory.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError

from .models import FmTicket


def get_classification_block_reason(ticket) -> str | None:
    if ticket.category == FmTicket.Category.UNCLASSIFIED:
        return "unclassified_category"
    if ticket.priority == FmTicket.Priority.PENDING_REVIEW:
        return "pending_priority"
    if ticket.building_id is None:
        return "missing_building"
    return None


def format_classification_block_reason(reason: str | None) -> str | None:
    messages = {
        "unclassified_category": (
            "Set a final category before assignment or work-order actions."
        ),
        "pending_priority": (
            "Set a final priority before assignment or work-order actions."
        ),
        "missing_building": (
            "Set a building before assignment or work-order actions."
        ),
    }
    return messages.get(reason) if reason else None


def assert_ticket_ready_for_operational_actions(*, ticket) -> None:
    reason = get_classification_block_reason(ticket)
    message = format_classification_block_reason(reason)
    if message:
        raise ValidationError({"classification": [message]})
