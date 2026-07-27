"""Attachment audit/history helpers."""

from .models import AttachmentHistory


def record_attachment_history(
    *,
    attachment,
    actor,
    action,
    note="",
    metadata=None,
    tenant=None,
):
    tenant_obj = tenant or getattr(attachment, "tenant", None)
    attachment_id = getattr(attachment, "id", None)
    actor_id = str(actor.id) if actor is not None else None
    return AttachmentHistory.objects.create(
        attachment=attachment if attachment_id else None,
        tenant=tenant_obj,
        actor=actor,
        action=action,
        attachment_id_snapshot=attachment_id,
        note=note,
        metadata=metadata or {},
        created_by=actor_id,
        updated_by=actor_id,
    )
