"""Attachment ownership and visibility constants (FO-081+)."""

from __future__ import annotations


class AttachmentOwnerType:
    """Stable owner-type codes for module-linked attachments."""

    NONE = ""
    FM_TICKET = "fm_ticket"
    MAINTENANCE_WORK_ORDER = "maintenance_work_order"
    INSPECTION = "inspection"

    CHOICES = (
        (NONE, "Unlinked"),
        (FM_TICKET, "FM Ticket"),
        (MAINTENANCE_WORK_ORDER, "Maintenance Work Order"),
        (INSPECTION, "5S Inspection"),
    )

    SUPPORTED = frozenset({FM_TICKET, MAINTENANCE_WORK_ORDER, INSPECTION})
    # Modules that never expose evidence to Employee Requesters.
    INTERNAL_ONLY_OWNERS = frozenset({MAINTENANCE_WORK_ORDER, INSPECTION})


class AttachmentVisibility:
    """Audience classification for module-linked attachments.

    Defaults to internal-only so existing and operational uploads never become
    requester-visible accidentally. Requester uploads are forced to
    requester_visible by the service layer for FM Tickets only.
    """

    INTERNAL_ONLY = "internal_only"
    REQUESTER_VISIBLE = "requester_visible"

    CHOICES = (
        (INTERNAL_ONLY, "Internal only"),
        (REQUESTER_VISIBLE, "Requester visible"),
    )


# Ticket statuses that reject new uploads and requester deletes.
FM_TICKET_IMMUTABLE_STATUSES = frozenset({"closed", "cancelled"})

# Align with Maintenance TERMINAL_ASSIGNMENT_STATUSES (completed/cancelled/closed).
MAINTENANCE_IMMUTABLE_STATUSES = frozenset({"completed", "cancelled", "closed"})

# Inspection statuses where ordinary evidence uploads/deletes are locked.
INSPECTION_IMMUTABLE_STATUSES = frozenset({"completed", "verified", "cancelled"})
