"""Centralized owner-context authorization for module-linked attachments."""

from __future__ import annotations

import uuid

from django.http import Http404

from apps.access_control.services import user_has_permission
from apps.fm_tickets.models import FmTicket
from apps.fm_tickets.tenant_scope import (
    scope_fm_ticket_queryset,
    uses_employee_requester_scope,
)

from .exceptions import AttachmentPermissionError, AttachmentValidationError
from .ownership import (
    FM_TICKET_IMMUTABLE_STATUSES,
    AttachmentOwnerType,
    AttachmentVisibility,
)


def parse_owner_uuid(raw_value):
    if raw_value in (None, ""):
        return None
    try:
        return uuid.UUID(str(raw_value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise AttachmentValidationError("Invalid attachment owner context.") from exc


def normalize_owner_context(*, owner_type, owner_id):
    """Validate owner_type/owner_id pairing. Empty pair means unlinked library."""
    normalized_type = (owner_type or "").strip()
    parsed_id = parse_owner_uuid(owner_id) if owner_id not in (None, "") else None

    if not normalized_type and parsed_id is None:
        return AttachmentOwnerType.NONE, None

    if not normalized_type or parsed_id is None:
        raise AttachmentValidationError("Invalid attachment owner context.")

    if normalized_type not in AttachmentOwnerType.SUPPORTED:
        raise AttachmentValidationError("Invalid attachment owner context.")

    return normalized_type, parsed_id


def resolve_fm_ticket_for_actor(*, actor, ticket_id):
    """Return an accessible FM Ticket or raise Http404 (generic)."""
    queryset = scope_fm_ticket_queryset(
        FmTicket.objects.filter(is_deleted=False),
        actor,
    )
    ticket = queryset.filter(pk=ticket_id).first()
    if ticket is None:
        raise Http404
    return ticket


def ticket_is_immutable(ticket) -> bool:
    if getattr(ticket, "is_deleted", False):
        return True
    return getattr(ticket, "status", None) in FM_TICKET_IMMUTABLE_STATUSES


def actor_is_requester_audience(actor) -> bool:
    return uses_employee_requester_scope(actor)


def can_internal_contribute_to_ticket(actor) -> bool:
    """Internal users may contribute attachments when they can update tickets."""
    return user_has_permission(actor, "fm_tickets.update") or user_has_permission(
        actor, "fm_tickets.manage"
    )


def resolve_upload_visibility(*, actor, requested_visibility, owner_type):
    """Server-authoritative visibility. Never trust client for requesters."""
    if owner_type == AttachmentOwnerType.NONE:
        # Unlinked library uploads stay internal-only (conservative default).
        return AttachmentVisibility.INTERNAL_ONLY

    if actor_is_requester_audience(actor):
        return AttachmentVisibility.REQUESTER_VISIBLE

    if requested_visibility in (
        AttachmentVisibility.INTERNAL_ONLY,
        AttachmentVisibility.REQUESTER_VISIBLE,
    ):
        return requested_visibility
    return AttachmentVisibility.INTERNAL_ONLY


def authorize_fm_ticket_list(*, actor, ticket_id):
    ticket = resolve_fm_ticket_for_actor(actor=actor, ticket_id=ticket_id)
    return ticket, actor_is_requester_audience(actor)


def authorize_fm_ticket_upload(*, actor, ticket_id, requested_visibility=None):
    ticket = resolve_fm_ticket_for_actor(actor=actor, ticket_id=ticket_id)
    is_requester = actor_is_requester_audience(actor)

    if ticket_is_immutable(ticket):
        raise AttachmentPermissionError(
            "Attachments cannot be uploaded while this ticket is closed or cancelled."
        )

    if is_requester:
        # Requester must own the ticket (already enforced by scope) and may upload
        # only requester-visible evidence on mutable tickets.
        visibility = AttachmentVisibility.REQUESTER_VISIBLE
        return ticket, visibility, True

    if not can_internal_contribute_to_ticket(actor):
        raise AttachmentPermissionError(
            "You do not have permission to upload attachments for this ticket."
        )

    visibility = resolve_upload_visibility(
        actor=actor,
        requested_visibility=requested_visibility,
        owner_type=AttachmentOwnerType.FM_TICKET,
    )
    return ticket, visibility, False


def attachment_visible_to_requester(attachment) -> bool:
    return (
        getattr(attachment, "visibility", None)
        == AttachmentVisibility.REQUESTER_VISIBLE
    )


def authorize_owned_attachment_access(*, actor, attachment, action: str):
    """Authorize view/download/delete for an owner-linked attachment.

    `action` is one of: view, download, delete.
    Missing/unauthorized access raises Http404 to preserve generic responses.
    """
    owner_type = getattr(attachment, "owner_type", "") or AttachmentOwnerType.NONE
    owner_id = getattr(attachment, "owner_id", None)

    if owner_type != AttachmentOwnerType.FM_TICKET or owner_id is None:
        return False

    try:
        ticket = resolve_fm_ticket_for_actor(actor=actor, ticket_id=owner_id)
    except Http404:
        raise Http404 from None

    if attachment.tenant_id != ticket.tenant_id:
        raise Http404

    is_requester = actor_is_requester_audience(actor)
    if is_requester and not attachment_visible_to_requester(attachment):
        raise Http404

    if action in {"view", "download"}:
        return True

    if action == "delete":
        if ticket_is_immutable(ticket):
            raise Http404
        if is_requester:
            # Conservatively: requester may delete only their own requester-visible
            # uploads on their mutable ticket.
            if attachment.uploaded_by_id != getattr(actor, "id", None):
                raise Http404
            if not attachment_visible_to_requester(attachment):
                raise Http404
            return True
        # Internal delete still requires attachments.delete (checked by caller).
        if not can_internal_contribute_to_ticket(actor):
            # Viewers and non-contributors cannot delete ticket attachments.
            raise Http404
        return True

    raise Http404


def filter_queryset_for_fm_ticket(*, queryset, actor, ticket, requester_audience: bool):
    """Scope an attachment queryset to one FM Ticket and audience."""
    queryset = queryset.filter(
        owner_type=AttachmentOwnerType.FM_TICKET,
        owner_id=ticket.id,
        tenant_id=ticket.tenant_id,
    )
    if requester_audience:
        queryset = queryset.filter(visibility=AttachmentVisibility.REQUESTER_VISIBLE)
    return queryset
