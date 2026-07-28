"""Attachment ownership and visibility constants (FO-081+)."""

from __future__ import annotations


class AttachmentOwnerType:
    """Stable owner-type codes for module-linked attachments."""

    NONE = ""
    FM_TICKET = "fm_ticket"

    CHOICES = (
        (NONE, "Unlinked"),
        (FM_TICKET, "FM Ticket"),
    )

    SUPPORTED = frozenset({FM_TICKET})


class AttachmentVisibility:
    """Audience classification for module-linked attachments.

    Defaults to internal-only so existing and operational uploads never become
    requester-visible accidentally. Requester uploads are forced to
    requester_visible by the service layer.
    """

    INTERNAL_ONLY = "internal_only"
    REQUESTER_VISIBLE = "requester_visible"

    CHOICES = (
        (INTERNAL_ONLY, "Internal only"),
        (REQUESTER_VISIBLE, "Requester visible"),
    )


# Ticket statuses that reject new uploads and requester deletes.
FM_TICKET_IMMUTABLE_STATUSES = frozenset({"closed", "cancelled"})
