from django.utils import timezone

from apps.inspection.models import InspectionHistory, InspectionStatusHistory


def record_history(*, inspection, action, description, actor=None, metadata=None):
    actor_id = str(actor.id) if actor else None
    return InspectionHistory.objects.create(
        inspection=inspection,
        actor=actor,
        action=action,
        description=description,
        metadata=metadata or {},
        created_by=actor_id,
        updated_by=actor_id,
    )


def record_status_history(
    *,
    inspection,
    from_status,
    to_status,
    changed_by=None,
    action=InspectionStatusHistory.Action.SYSTEM,
    reason="",
    note="",
):
    changed_by_id = str(changed_by.id) if changed_by else None
    return InspectionStatusHistory.objects.create(
        inspection=inspection,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        changed_at=timezone.now(),
        action=action,
        reason=reason,
        note=note,
        created_by=changed_by_id,
        updated_by=changed_by_id,
    )

