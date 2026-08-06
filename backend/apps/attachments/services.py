"""Reusable attachment service layer."""

from __future__ import annotations

import hashlib
import logging
import uuid

from django.db import transaction
from django.http import Http404
from django.utils import timezone

from apps.fm_tickets.tenant_scope import uses_employee_requester_scope

from .audit import record_attachment_history
from .exceptions import (
    AttachmentNotFoundError,
    AttachmentPermissionError,
    AttachmentStorageError,
    AttachmentValidationError,
)
from .models import Attachment, AttachmentHistory
from .owner_access import (
    authorize_fm_ticket_list,
    authorize_fm_ticket_upload,
    authorize_inspection_list,
    authorize_inspection_upload,
    authorize_owned_attachment_access,
    authorize_project_issue_list,
    authorize_project_issue_upload,
    authorize_project_list,
    authorize_project_note_list,
    authorize_project_note_upload,
    authorize_project_task_list,
    authorize_project_task_upload,
    authorize_project_upload,
    authorize_work_order_list,
    authorize_work_order_upload,
    filter_queryset_for_fm_ticket,
    filter_queryset_for_inspection,
    filter_queryset_for_project,
    filter_queryset_for_project_issue,
    filter_queryset_for_project_note,
    filter_queryset_for_project_task,
    filter_queryset_for_work_order,
    is_module_owned_type,
    normalize_owner_context,
)
from .ownership import AttachmentOwnerType, AttachmentVisibility
from .scanning import get_virus_scanner
from .storage import get_attachment_storage
from .tenant_scope import (
    has_global_attachment_scope,
    scoped_attachment_queryset,
    user_can_delete_attachments,
    user_can_download_attachments,
    user_can_upload_attachments,
    user_can_view_attachments,
)
from .validation import validate_upload

logger = logging.getLogger(__name__)


def _require_tenant(user):
    tenant = getattr(user, "tenant", None)
    if tenant is None or getattr(tenant, "is_deleted", False) or not getattr(
        tenant, "is_active", True
    ):
        raise AttachmentPermissionError("A valid tenant is required.")
    return tenant


def _generate_storage_key(*, extension: str) -> str:
    now = timezone.now()
    safe_ext = extension.lstrip(".").lower()
    # Opaque key: no tenant names, emails, or original filenames.
    return (
        f"attachments/{now.year:04d}/{now.month:02d}/"
        f"{uuid.uuid4().hex}.{safe_ext}"
    )


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _history_owner_metadata(attachment) -> dict:
    return {
        "owner_type": attachment.owner_type or AttachmentOwnerType.NONE,
        "owner_id": str(attachment.owner_id) if attachment.owner_id else None,
        "visibility": attachment.visibility,
    }


def create_attachment(
    *,
    actor,
    uploaded_file,
    declared_content_type: str = "",
    category: str | None = None,
    owner_type: str | None = None,
    owner_id=None,
    visibility: str | None = None,
):
    if not user_can_upload_attachments(actor):
        raise AttachmentPermissionError("You do not have permission to upload attachments.")

    tenant = _require_tenant(actor)
    normalized_type, normalized_id = normalize_owner_context(
        owner_type=owner_type,
        owner_id=owner_id,
    )

    resolved_visibility = AttachmentVisibility.INTERNAL_ONLY
    if normalized_type == AttachmentOwnerType.FM_TICKET:
        ticket, resolved_visibility, _is_requester = authorize_fm_ticket_upload(
            actor=actor,
            ticket_id=normalized_id,
            requested_visibility=visibility,
        )
        if ticket.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = ticket.tenant
    elif normalized_type == AttachmentOwnerType.MAINTENANCE_WORK_ORDER:
        work_order, resolved_visibility = authorize_work_order_upload(
            actor=actor,
            work_order_id=normalized_id,
            requested_visibility=visibility,
        )
        if work_order.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = work_order.tenant
    elif normalized_type == AttachmentOwnerType.INSPECTION:
        inspection, resolved_visibility = authorize_inspection_upload(
            actor=actor,
            inspection_id=normalized_id,
            requested_visibility=visibility,
        )
        if inspection.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = inspection.tenant
    elif normalized_type == AttachmentOwnerType.PROJECT:
        project, resolved_visibility = authorize_project_upload(
            actor=actor,
            project_id=normalized_id,
            requested_visibility=visibility,
        )
        if project.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = project.tenant
    elif normalized_type == AttachmentOwnerType.PROJECT_TASK:
        task, resolved_visibility = authorize_project_task_upload(
            actor=actor,
            task_id=normalized_id,
            requested_visibility=visibility,
        )
        if task.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = task.tenant
    elif normalized_type == AttachmentOwnerType.PROJECT_NOTE:
        note, resolved_visibility = authorize_project_note_upload(
            actor=actor,
            note_id=normalized_id,
            requested_visibility=visibility,
        )
        if note.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = note.tenant
    elif normalized_type == AttachmentOwnerType.PROJECT_ISSUE:
        issue, resolved_visibility = authorize_project_issue_upload(
            actor=actor,
            issue_id=normalized_id,
            requested_visibility=visibility,
        )
        if issue.tenant_id != tenant.id and not has_global_attachment_scope(actor):
            raise Http404
        tenant = issue.tenant
    elif visibility not in (None, "", AttachmentVisibility.INTERNAL_ONLY):
        # Unlinked uploads cannot opt into requester visibility.
        raise AttachmentValidationError("Invalid attachment visibility.")

    validated = validate_upload(
        uploaded_file=uploaded_file,
        declared_content_type=declared_content_type,
        category=category,
    )

    scan_result = get_virus_scanner().scan(
        content=validated.content,
        filename=validated.display_filename,
        content_type=validated.validated_content_type,
    )
    if not scan_result.clean:
        raise AttachmentValidationError("File failed security screening.")

    storage_key = _generate_storage_key(extension=validated.extension)
    checksum = _sha256(validated.content)
    storage = get_attachment_storage()
    saved_key = None

    try:
        with transaction.atomic():
            saved_key = storage.save(storage_key, validated.content)
            actor_id = str(actor.id)
            attachment = Attachment.objects.create(
                tenant=tenant,
                uploaded_by=actor,
                owner_type=normalized_type,
                owner_id=normalized_id,
                visibility=resolved_visibility,
                original_filename=validated.original_filename,
                display_filename=validated.display_filename,
                storage_key=saved_key,
                declared_content_type=validated.declared_content_type,
                validated_content_type=validated.validated_content_type,
                extension=validated.extension,
                size_bytes=validated.size_bytes,
                checksum_sha256=checksum,
                category=validated.category,
                status=Attachment.Status.ACTIVE,
                created_by=actor_id,
                updated_by=actor_id,
            )
            record_attachment_history(
                attachment=attachment,
                actor=actor,
                action=AttachmentHistory.Action.UPLOADED,
                note="Attachment uploaded.",
                metadata={
                    "size_bytes": attachment.size_bytes,
                    "validated_content_type": attachment.validated_content_type,
                    "category": attachment.category,
                    "scan_provider": scan_result.provider,
                    **_history_owner_metadata(attachment),
                },
            )
            return attachment
    except Exception:
        if saved_key:
            try:
                storage.delete(saved_key)
            except AttachmentStorageError:
                logger.exception(
                    "attachment.orphan_cleanup_failed key=%s",
                    saved_key,
                )
        raise


def _resolve_attachment_for_actor(*, actor, attachment_id, include_deleted=False):
    """Resolve an attachment with tenant/owner authorization.

    Owned FM Ticket attachments authorize via ticket scope + visibility.
    Unlinked attachments keep FO-079 library scoping.
    """
    base = Attachment.objects.select_related("tenant", "uploaded_by")
    if not include_deleted:
        base = base.filter(is_deleted=False)

    attachment = base.filter(pk=attachment_id).first()
    if attachment is None:
        raise Http404

    owner_type = attachment.owner_type or AttachmentOwnerType.NONE
    if is_module_owned_type(owner_type) and attachment.owner_id:
        # Module-linked path uses authorize_owned_attachment_access at call sites.
        return attachment

    # Unlinked library path — FO-079 tenant/uploader scope.
    if include_deleted:
        queryset = Attachment.objects.select_related("tenant", "uploaded_by")
        if not has_global_attachment_scope(actor):
            tenant_id = getattr(actor, "tenant_id", None)
            if not tenant_id:
                raise Http404
            queryset = queryset.filter(tenant_id=tenant_id)
            if uses_employee_requester_scope(actor):
                queryset = queryset.filter(uploaded_by_id=actor.id)
        if queryset.filter(pk=attachment_id).first() is None:
            raise Http404
        return attachment

    if scoped_attachment_queryset(actor).filter(pk=attachment_id).first() is None:
        raise Http404
    return attachment


def _authorize_owned_or_404(*, actor, attachment, action: str):
    """Require owned authorization to succeed; never treat False as allow."""
    authorized = authorize_owned_attachment_access(
        actor=actor, attachment=attachment, action=action
    )
    if authorized is not True:
        raise Http404


def get_attachment(*, actor, attachment_id):
    if not user_can_view_attachments(actor):
        raise Http404
    attachment = _resolve_attachment_for_actor(
        actor=actor, attachment_id=attachment_id
    )
    if is_module_owned_type(attachment.owner_type or "") and attachment.owner_id:
        _authorize_owned_or_404(actor=actor, attachment=attachment, action="view")
    if attachment.status != Attachment.Status.ACTIVE:
        raise Http404
    return attachment


def list_attachments(*, actor, owner_type=None, owner_id=None):
    if not user_can_view_attachments(actor):
        raise AttachmentPermissionError("You do not have permission to view attachments.")

    normalized_type, normalized_id = normalize_owner_context(
        owner_type=owner_type,
        owner_id=owner_id,
    )

    if normalized_type == AttachmentOwnerType.NONE:
        # FO-079 library workspace: unlinked rows only (never module evidence).
        return scoped_attachment_queryset(actor).filter(
            status=Attachment.Status.ACTIVE,
            owner_type=AttachmentOwnerType.NONE,
            owner_id__isnull=True,
        )

    queryset = Attachment.objects.filter(
        is_deleted=False, status=Attachment.Status.ACTIVE
    ).select_related("tenant", "uploaded_by")

    if normalized_type == AttachmentOwnerType.FM_TICKET:
        ticket, requester_audience = authorize_fm_ticket_list(
            actor=actor, ticket_id=normalized_id
        )
        return filter_queryset_for_fm_ticket(
            queryset=queryset,
            actor=actor,
            ticket=ticket,
            requester_audience=requester_audience,
        )

    if normalized_type == AttachmentOwnerType.MAINTENANCE_WORK_ORDER:
        work_order = authorize_work_order_list(
            actor=actor, work_order_id=normalized_id
        )
        return filter_queryset_for_work_order(
            queryset=queryset, work_order=work_order
        )

    if normalized_type == AttachmentOwnerType.INSPECTION:
        inspection = authorize_inspection_list(
            actor=actor, inspection_id=normalized_id
        )
        return filter_queryset_for_inspection(
            queryset=queryset, inspection=inspection
        )

    if normalized_type == AttachmentOwnerType.PROJECT:
        project = authorize_project_list(actor=actor, project_id=normalized_id)
        return filter_queryset_for_project(queryset=queryset, project=project)

    if normalized_type == AttachmentOwnerType.PROJECT_TASK:
        task = authorize_project_task_list(actor=actor, task_id=normalized_id)
        return filter_queryset_for_project_task(queryset=queryset, task=task)

    if normalized_type == AttachmentOwnerType.PROJECT_NOTE:
        note = authorize_project_note_list(actor=actor, note_id=normalized_id)
        return filter_queryset_for_project_note(queryset=queryset, note=note)

    if normalized_type == AttachmentOwnerType.PROJECT_ISSUE:
        issue = authorize_project_issue_list(actor=actor, issue_id=normalized_id)
        return filter_queryset_for_project_issue(queryset=queryset, issue=issue)

    raise AttachmentValidationError("Invalid attachment owner context.")


def download_attachment(*, actor, attachment_id):
    if not user_can_download_attachments(actor):
        raise Http404

    attachment = _resolve_attachment_for_actor(
        actor=actor, attachment_id=attachment_id
    )
    if is_module_owned_type(attachment.owner_type or "") and attachment.owner_id:
        _authorize_owned_or_404(
            actor=actor, attachment=attachment, action="download"
        )
    if attachment.status != Attachment.Status.ACTIVE:
        raise Http404

    storage = get_attachment_storage()
    if not storage.exists(attachment.storage_key):
        raise AttachmentNotFoundError("Attachment content is unavailable.")

    content = storage.open(attachment.storage_key)
    record_attachment_history(
        attachment=attachment,
        actor=actor,
        action=AttachmentHistory.Action.DOWNLOADED,
        note="Attachment downloaded.",
        metadata={
            "size_bytes": attachment.size_bytes,
            **_history_owner_metadata(attachment),
        },
    )
    return attachment, content


def _assert_unlinked_delete_scope(*, actor, attachment):
    """FO-079 tenant/uploader scope for library (unlinked) deletes."""
    if has_global_attachment_scope(actor):
        return
    tenant_id = getattr(actor, "tenant_id", None)
    if not tenant_id or attachment.tenant_id != tenant_id:
        raise Http404
    if uses_employee_requester_scope(actor) and attachment.uploaded_by_id != actor.id:
        raise Http404


def delete_attachment(*, actor, attachment_id):
    if not user_can_delete_attachments(actor):
        raise Http404

    attachment = _resolve_attachment_for_actor(
        actor=actor, attachment_id=attachment_id, include_deleted=True
    )
    is_owned = (
        is_module_owned_type(attachment.owner_type or "") and attachment.owner_id
    )

    # Idempotent soft delete must succeed even after the owner becomes immutable.
    if attachment.is_deleted or attachment.status == Attachment.Status.RETIRED:
        if is_owned:
            _authorize_owned_or_404(
                actor=actor, attachment=attachment, action="view"
            )
        else:
            _assert_unlinked_delete_scope(actor=actor, attachment=attachment)
        return attachment

    if is_owned:
        _authorize_owned_or_404(actor=actor, attachment=attachment, action="delete")
    else:
        _assert_unlinked_delete_scope(actor=actor, attachment=attachment)

    actor_id = str(actor.id)
    now = timezone.now()
    attachment.is_deleted = True
    attachment.deleted_at = now
    attachment.deleted_by = actor_id
    attachment.updated_by = actor_id
    attachment.status = Attachment.Status.RETIRED
    attachment.save(
        update_fields=[
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "updated_by",
            "status",
            "updated_at",
        ]
    )
    record_attachment_history(
        attachment=attachment,
        actor=actor,
        action=AttachmentHistory.Action.DELETED,
        note="Attachment soft-deleted.",
        metadata={
            "status": attachment.status,
            **_history_owner_metadata(attachment),
        },
    )
    # Physical object retention is deferred; soft-delete preserves evidence.
    return attachment
