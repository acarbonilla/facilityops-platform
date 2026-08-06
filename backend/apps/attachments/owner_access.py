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
from apps.inspection.models import Inspection
from apps.inspection.tenant_scope import scope_queryset_to_user as scope_inspections_to_user
from apps.maintenance.models import MaintenanceWorkOrder
from apps.maintenance.tenant_scope import scope_work_orders_to_user
from apps.projects.models import Project
from apps.projects.tenant_scope import scope_projects_to_user

from .exceptions import AttachmentPermissionError, AttachmentValidationError
from .ownership import (
    FM_TICKET_IMMUTABLE_STATUSES,
    INSPECTION_IMMUTABLE_STATUSES,
    MAINTENANCE_IMMUTABLE_STATUSES,
    PROJECT_IMMUTABLE_STATUSES,
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


def _has_any_permission(user, *codes) -> bool:
    return any(user_has_permission(user, code) for code in codes)


def actor_is_requester_audience(actor) -> bool:
    return uses_employee_requester_scope(actor)


def is_module_owned_type(owner_type: str) -> bool:
    return owner_type in AttachmentOwnerType.SUPPORTED


# ---------------------------------------------------------------------------
# FM Ticket (FO-081)
# ---------------------------------------------------------------------------


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


def can_internal_contribute_to_ticket(actor) -> bool:
    """Internal users may contribute attachments when they can update tickets."""
    return user_has_permission(actor, "fm_tickets.update") or user_has_permission(
        actor, "fm_tickets.manage"
    )


def resolve_upload_visibility(*, actor, requested_visibility, owner_type):
    """Server-authoritative visibility. Never trust client for requesters."""
    if owner_type in AttachmentOwnerType.INTERNAL_ONLY_OWNERS:
        # Maintenance / 5S evidence is always internal-only.
        if requested_visibility not in (
            None,
            "",
            AttachmentVisibility.INTERNAL_ONLY,
        ):
            raise AttachmentValidationError("Invalid attachment visibility.")
        return AttachmentVisibility.INTERNAL_ONLY

    if owner_type == AttachmentOwnerType.NONE:
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


# ---------------------------------------------------------------------------
# Maintenance Work Order (FO-082)
# ---------------------------------------------------------------------------


def can_view_work_order_attachments(actor) -> bool:
    return _has_any_permission(
        actor,
        "maintenance.view",
        "maintenance.work_order.view",
        "maintenance.manage",
    )


def can_contribute_to_work_order(actor) -> bool:
    return _has_any_permission(
        actor,
        "maintenance.update",
        "maintenance.work_order.update",
        "maintenance.manage",
    )


def work_order_is_immutable(work_order) -> bool:
    if getattr(work_order, "is_deleted", False):
        return True
    return getattr(work_order, "status", None) in MAINTENANCE_IMMUTABLE_STATUSES


def resolve_work_order_for_actor(*, actor, work_order_id):
    if actor_is_requester_audience(actor) or not can_view_work_order_attachments(actor):
        raise Http404
    queryset = scope_work_orders_to_user(
        MaintenanceWorkOrder.objects.filter(is_deleted=False),
        actor,
    )
    work_order = queryset.filter(pk=work_order_id).first()
    if work_order is None:
        raise Http404
    return work_order


def authorize_work_order_list(*, actor, work_order_id):
    return resolve_work_order_for_actor(actor=actor, work_order_id=work_order_id)


def authorize_work_order_upload(*, actor, work_order_id, requested_visibility=None):
    work_order = resolve_work_order_for_actor(
        actor=actor, work_order_id=work_order_id
    )
    if work_order_is_immutable(work_order):
        raise AttachmentPermissionError(
            "Attachments cannot be uploaded while this work order is completed, "
            "cancelled, or closed."
        )
    if not can_contribute_to_work_order(actor):
        raise AttachmentPermissionError(
            "You do not have permission to upload attachments for this work order."
        )
    visibility = resolve_upload_visibility(
        actor=actor,
        requested_visibility=requested_visibility,
        owner_type=AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
    )
    return work_order, visibility


def filter_queryset_for_work_order(*, queryset, work_order):
    return queryset.filter(
        owner_type=AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
        owner_id=work_order.id,
        tenant_id=work_order.tenant_id,
        visibility=AttachmentVisibility.INTERNAL_ONLY,
    )


# ---------------------------------------------------------------------------
# 5S Inspection (FO-082)
# ---------------------------------------------------------------------------


def can_view_inspection_attachments(actor) -> bool:
    return _has_any_permission(
        actor,
        "inspection.view",
        "inspection.manage",
    )


def can_contribute_to_inspection(actor) -> bool:
    return _has_any_permission(
        actor,
        "inspection.update",
        "inspection.manage",
    )


def inspection_is_immutable(inspection) -> bool:
    if getattr(inspection, "is_deleted", False):
        return True
    return getattr(inspection, "status", None) in INSPECTION_IMMUTABLE_STATUSES


def resolve_inspection_for_actor(*, actor, inspection_id):
    if actor_is_requester_audience(actor) or not can_view_inspection_attachments(actor):
        raise Http404
    queryset = scope_inspections_to_user(
        Inspection.objects.filter(is_deleted=False),
        actor,
    )
    inspection = queryset.filter(pk=inspection_id).first()
    if inspection is None:
        raise Http404
    return inspection


def authorize_inspection_list(*, actor, inspection_id):
    return resolve_inspection_for_actor(actor=actor, inspection_id=inspection_id)


def authorize_inspection_upload(*, actor, inspection_id, requested_visibility=None):
    inspection = resolve_inspection_for_actor(
        actor=actor, inspection_id=inspection_id
    )
    if inspection_is_immutable(inspection):
        raise AttachmentPermissionError(
            "Attachments cannot be uploaded while this inspection is completed, "
            "verified, or cancelled."
        )
    if not can_contribute_to_inspection(actor):
        raise AttachmentPermissionError(
            "You do not have permission to upload attachments for this inspection."
        )
    visibility = resolve_upload_visibility(
        actor=actor,
        requested_visibility=requested_visibility,
        owner_type=AttachmentOwnerType.INSPECTION,
    )
    return inspection, visibility


def filter_queryset_for_inspection(*, queryset, inspection):
    return queryset.filter(
        owner_type=AttachmentOwnerType.INSPECTION,
        owner_id=inspection.id,
        tenant_id=inspection.tenant_id,
        visibility=AttachmentVisibility.INTERNAL_ONLY,
    )


# ---------------------------------------------------------------------------
# Project (FO-103)
# ---------------------------------------------------------------------------


def can_view_project_attachments(actor) -> bool:
    return _has_any_permission(
        actor,
        "projects.view",
        "projects.manage",
    )


def can_contribute_to_project(actor) -> bool:
    return _has_any_permission(
        actor,
        "projects.update",
        "projects.manage",
    )


def project_is_immutable(project) -> bool:
    if getattr(project, "is_deleted", False):
        return True
    return getattr(project, "status", None) in PROJECT_IMMUTABLE_STATUSES


def resolve_project_for_actor(*, actor, project_id):
    if actor_is_requester_audience(actor) or not can_view_project_attachments(actor):
        raise Http404
    queryset = scope_projects_to_user(
        Project.objects.filter(is_deleted=False),
        actor,
    )
    project = queryset.filter(pk=project_id).first()
    if project is None:
        raise Http404
    return project


def authorize_project_list(*, actor, project_id):
    return resolve_project_for_actor(actor=actor, project_id=project_id)


def authorize_project_upload(*, actor, project_id, requested_visibility=None):
    project = resolve_project_for_actor(actor=actor, project_id=project_id)
    if project_is_immutable(project):
        raise AttachmentPermissionError(
            "Attachments cannot be uploaded while this project is completed or cancelled."
        )
    if not can_contribute_to_project(actor):
        raise AttachmentPermissionError(
            "You do not have permission to upload attachments for this project."
        )
    visibility = resolve_upload_visibility(
        actor=actor,
        requested_visibility=requested_visibility,
        owner_type=AttachmentOwnerType.PROJECT,
    )
    return project, visibility


def filter_queryset_for_project(*, queryset, project):
    return queryset.filter(
        owner_type=AttachmentOwnerType.PROJECT,
        owner_id=project.id,
        tenant_id=project.tenant_id,
        visibility=AttachmentVisibility.INTERNAL_ONLY,
    )


# ---------------------------------------------------------------------------
# Shared owned-attachment access
# ---------------------------------------------------------------------------


def authorize_owned_attachment_access(*, actor, attachment, action: str):
    """Authorize view/download/delete for an owner-linked attachment.

    `action` is one of: view, download, delete.
    Missing/unauthorized access raises Http404 to preserve generic responses.
    """
    owner_type = getattr(attachment, "owner_type", "") or AttachmentOwnerType.NONE
    owner_id = getattr(attachment, "owner_id", None)

    if owner_type == AttachmentOwnerType.FM_TICKET and owner_id is not None:
        return _authorize_fm_ticket_attachment(
            actor=actor, attachment=attachment, action=action, owner_id=owner_id
        )
    if owner_type == AttachmentOwnerType.MAINTENANCE_WORK_ORDER and owner_id is not None:
        return _authorize_work_order_attachment(
            actor=actor, attachment=attachment, action=action, owner_id=owner_id
        )
    if owner_type == AttachmentOwnerType.INSPECTION and owner_id is not None:
        return _authorize_inspection_attachment(
            actor=actor, attachment=attachment, action=action, owner_id=owner_id
        )
    if owner_type == AttachmentOwnerType.PROJECT and owner_id is not None:
        return _authorize_project_attachment(
            actor=actor, attachment=attachment, action=action, owner_id=owner_id
        )
    # Unsupported or incomplete owner context must never grant access.
    raise Http404


def _authorize_fm_ticket_attachment(*, actor, attachment, action, owner_id):
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
            if attachment.uploaded_by_id != getattr(actor, "id", None):
                raise Http404
            if not attachment_visible_to_requester(attachment):
                raise Http404
            return True
        if not can_internal_contribute_to_ticket(actor):
            raise Http404
        return True

    raise Http404


def _authorize_work_order_attachment(*, actor, attachment, action, owner_id):
    try:
        work_order = resolve_work_order_for_actor(
            actor=actor, work_order_id=owner_id
        )
    except Http404:
        raise Http404 from None

    if attachment.tenant_id != work_order.tenant_id:
        raise Http404
    if attachment.visibility != AttachmentVisibility.INTERNAL_ONLY:
        # Defensive: Maintenance evidence must never be requester-visible.
        if actor_is_requester_audience(actor):
            raise Http404

    if action in {"view", "download"}:
        return True

    if action == "delete":
        if work_order_is_immutable(work_order):
            raise Http404
        if not can_contribute_to_work_order(actor):
            raise Http404
        return True

    raise Http404


def _authorize_inspection_attachment(*, actor, attachment, action, owner_id):
    try:
        inspection = resolve_inspection_for_actor(
            actor=actor, inspection_id=owner_id
        )
    except Http404:
        raise Http404 from None

    if attachment.tenant_id != inspection.tenant_id:
        raise Http404
    if attachment.visibility != AttachmentVisibility.INTERNAL_ONLY:
        if actor_is_requester_audience(actor):
            raise Http404

    if action in {"view", "download"}:
        return True

    if action == "delete":
        if inspection_is_immutable(inspection):
            raise Http404
        if not can_contribute_to_inspection(actor):
            raise Http404
        return True

    raise Http404


def _authorize_project_attachment(*, actor, attachment, action, owner_id):
    try:
        project = resolve_project_for_actor(actor=actor, project_id=owner_id)
    except Http404:
        raise Http404 from None

    if attachment.tenant_id != project.tenant_id:
        raise Http404
    if attachment.visibility != AttachmentVisibility.INTERNAL_ONLY:
        if actor_is_requester_audience(actor):
            raise Http404

    if action in {"view", "download"}:
        return True

    if action == "delete":
        if project_is_immutable(project):
            raise Http404
        if not can_contribute_to_project(actor):
            raise Http404
        return True

    raise Http404


def compute_can_delete_for_attachment(*, actor, attachment) -> bool:
    """Advisory capability used by serializers; DELETE still revalidates."""
    from apps.attachments.tenant_scope import user_can_delete_attachments

    if actor is None or not user_can_delete_attachments(actor):
        return False

    owner_type = getattr(attachment, "owner_type", "") or AttachmentOwnerType.NONE
    owner_id = getattr(attachment, "owner_id", None)

    if not owner_type or owner_id is None:
        if actor_is_requester_audience(actor):
            return attachment.uploaded_by_id == getattr(actor, "id", None)
        return True

    if owner_type == AttachmentOwnerType.FM_TICKET:
        ticket = scope_fm_ticket_queryset(
            FmTicket.objects.filter(is_deleted=False),
            actor,
        ).filter(pk=owner_id).first()
        if ticket is None or ticket_is_immutable(ticket):
            return False
        if actor_is_requester_audience(actor):
            return (
                attachment.uploaded_by_id == getattr(actor, "id", None)
                and attachment.visibility == AttachmentVisibility.REQUESTER_VISIBLE
            )
        return can_internal_contribute_to_ticket(actor)

    if owner_type == AttachmentOwnerType.MAINTENANCE_WORK_ORDER:
        if not can_view_work_order_attachments(actor) or not can_contribute_to_work_order(
            actor
        ):
            return False
        work_order = scope_work_orders_to_user(
            MaintenanceWorkOrder.objects.filter(is_deleted=False),
            actor,
        ).filter(pk=owner_id).first()
        if work_order is None or work_order_is_immutable(work_order):
            return False
        return True

    if owner_type == AttachmentOwnerType.INSPECTION:
        if not can_view_inspection_attachments(actor) or not can_contribute_to_inspection(
            actor
        ):
            return False
        inspection = scope_inspections_to_user(
            Inspection.objects.filter(is_deleted=False),
            actor,
        ).filter(pk=owner_id).first()
        if inspection is None or inspection_is_immutable(inspection):
            return False
        return True

    if owner_type == AttachmentOwnerType.PROJECT:
        if not can_view_project_attachments(actor) or not can_contribute_to_project(
            actor
        ):
            return False
        project = scope_projects_to_user(
            Project.objects.filter(is_deleted=False),
            actor,
        ).filter(pk=owner_id).first()
        if project is None or project_is_immutable(project):
            return False
        return True

    return False
