from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.inspection.models import (
    Inspection,
    InspectionAssignment,
    InspectionAttachment,
    InspectionComment,
    InspectionCorrectiveAction,
    InspectionEscalation,
    InspectionItem,
    InspectionSLA,
    InspectionStatusHistory,
)
from apps.inspection.validators import validate_status_transition

from .inspection_history_service import record_history, record_status_history
from .inspection_scoring_service import get_inspection_sla_targets, refresh_inspection_score
from .inspection_validation_service import (
    validate_actor_can_access_tenant,
    validate_completion_requirements,
    validate_corrective_action_due_date,
    validate_verification_requirements,
)


def _calculate_deadline_met(actual_at, due_at):
    if not actual_at:
        return None
    if not due_at:
        return True
    return actual_at <= due_at


def recalculate_inspection_sla(*, inspection):
    target_minutes, warning_minutes = get_inspection_sla_targets(inspection.priority)
    due_at = None
    verification_due_at = None

    if inspection.scheduled_date:
        due_at = inspection.scheduled_date + timedelta(minutes=target_minutes)
        verification_due_at = due_at + timedelta(minutes=warning_minutes)

    defaults = {
        "tenant": inspection.tenant,
        "target_minutes": target_minutes,
        "warning_minutes": warning_minutes,
        "due_at": due_at,
        "verification_due_at": verification_due_at,
        "completion_met": _calculate_deadline_met(inspection.completed_date, due_at),
        "verification_met": _calculate_deadline_met(
            inspection.verified_date,
            verification_due_at,
        ),
        "completion_breached": bool(
            due_at and inspection.status not in {Inspection.Status.COMPLETED, Inspection.Status.VERIFIED} and timezone.now() > due_at
        ),
        "verification_breached": bool(
            verification_due_at and inspection.status != Inspection.Status.VERIFIED and timezone.now() > verification_due_at
        ),
        "last_recalculated_at": timezone.now(),
    }

    if inspection.status == Inspection.Status.VERIFIED:
        defaults["sla_status"] = InspectionSLA.Status.VERIFIED
    elif defaults["completion_breached"] or defaults["verification_breached"]:
        defaults["sla_status"] = InspectionSLA.Status.BREACHED
    elif inspection.status == Inspection.Status.COMPLETED:
        defaults["sla_status"] = (
            InspectionSLA.Status.MET if defaults["completion_met"] else InspectionSLA.Status.MISSED
        )
    elif due_at is None:
        defaults["sla_status"] = InspectionSLA.Status.NOT_APPLICABLE
    else:
        warning_threshold = due_at - timedelta(minutes=warning_minutes)
        defaults["sla_status"] = (
            InspectionSLA.Status.AT_RISK
            if timezone.now() >= warning_threshold
            else InspectionSLA.Status.WITHIN_SLA
        )

    sla, _ = InspectionSLA.objects.update_or_create(
        inspection=inspection,
        defaults=defaults,
    )
    return sla


def _apply_status_timestamps(inspection, to_status):
    now = timezone.now()
    if to_status == Inspection.Status.SCHEDULED:
        inspection.scheduled_date = inspection.scheduled_date or now
    elif to_status == Inspection.Status.IN_PROGRESS:
        inspection.started_date = inspection.started_date or now
    elif to_status == Inspection.Status.COMPLETED:
        inspection.started_date = inspection.started_date or now
        inspection.completed_date = inspection.completed_date or now
        inspection.verified_date = None
    elif to_status == Inspection.Status.VERIFIED:
        inspection.completed_date = inspection.completed_date or now
        inspection.verified_date = inspection.verified_date or now
    elif to_status == Inspection.Status.REOPENED:
        inspection.completed_date = None
        inspection.verified_date = None


def _status_history_action(to_status):
    action_map = {
        Inspection.Status.SCHEDULED: "schedule",
        Inspection.Status.IN_PROGRESS: "start",
        Inspection.Status.COMPLETED: "complete",
        Inspection.Status.VERIFIED: "verify",
        Inspection.Status.CANCELLED: "cancel",
        Inspection.Status.REOPENED: "reopen",
    }
    return action_map.get(to_status, "system")


@transaction.atomic
def create_inspection(*, actor, data, items_data=None):
    validate_actor_can_access_tenant(
        actor,
        data["tenant"].id,
        message="You cannot create inspections for another tenant.",
    )
    actor_id = str(actor.id)
    inspection = Inspection.objects.create(
        created_by=actor_id,
        updated_by=actor_id,
        **data,
    )
    for item_data in items_data or []:
        InspectionItem.objects.create(
            inspection=inspection,
            created_by=actor_id,
            updated_by=actor_id,
            **item_data,
        )
    refresh_inspection_score(inspection=inspection, actor=actor)
    recalculate_inspection_sla(inspection=inspection)
    record_history(
        inspection=inspection,
        action="created",
        description="Inspection created.",
        actor=actor,
        metadata={"status": inspection.status},
    )
    record_status_history(
        inspection=inspection,
        from_status=None,
        to_status=inspection.status,
        changed_by=actor,
        note="Initial inspection status.",
    )
    return inspection


@transaction.atomic
def update_inspection(*, inspection, data, actor=None, items_data=None):
    target_tenant = data.get("tenant", inspection.tenant)
    validate_actor_can_access_tenant(
        actor,
        target_tenant.id,
        message="You cannot move inspections to another tenant.",
    )

    changes = {}
    for field, value in data.items():
        previous_value = getattr(inspection, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(inspection, field, value)

    if changes:
        inspection.updated_by = str(actor.id) if actor else None
        inspection.save()
        recalculate_inspection_sla(inspection=inspection)
        record_history(
            inspection=inspection,
            action="updated",
            description="Inspection details updated.",
            actor=actor,
            metadata={"changes": changes},
        )

    if items_data is not None:
        inspection.items.all().delete()
        actor_id = str(actor.id) if actor else None
        for item_data in items_data:
            InspectionItem.objects.create(
                inspection=inspection,
                created_by=actor_id,
                updated_by=actor_id,
                **item_data,
            )

    refresh_inspection_score(inspection=inspection, actor=actor)
    return inspection


@transaction.atomic
def add_inspection_item(*, inspection, actor=None, data):
    actor_id = str(actor.id) if actor else None
    item = InspectionItem.objects.create(
        inspection=inspection,
        created_by=actor_id,
        updated_by=actor_id,
        **data,
    )
    refresh_inspection_score(inspection=inspection, actor=actor)
    record_history(
        inspection=inspection,
        action="item_added",
        description="Inspection item added.",
        actor=actor,
        metadata={"item_id": str(item.id)},
    )
    return item


@transaction.atomic
def add_inspection_comment(*, inspection, author, body, is_internal=False):
    author_id = str(author.id)
    comment = InspectionComment.objects.create(
        inspection=inspection,
        author=author,
        body=body,
        is_internal=is_internal,
        created_by=author_id,
        updated_by=author_id,
    )
    record_history(
        inspection=inspection,
        action="comment_added",
        description="Inspection comment added.",
        actor=author,
        metadata={"comment_id": str(comment.id), "is_internal": is_internal},
    )
    return comment


@transaction.atomic
def add_inspection_attachment(*, inspection, actor=None, data):
    actor_id = str(actor.id) if actor else None
    attachment = InspectionAttachment.objects.create(
        inspection=inspection,
        uploaded_by=actor,
        created_by=actor_id,
        updated_by=actor_id,
        **data,
    )
    record_history(
        inspection=inspection,
        action="attachment_added",
        description="Inspection attachment metadata added.",
        actor=actor,
        metadata={"attachment_id": str(attachment.id)},
    )
    return attachment


@transaction.atomic
def assign_inspection(
    *,
    inspection,
    actor,
    inspector=None,
    supervisor=None,
    note="",
):
    validate_actor_can_access_tenant(
        actor,
        inspection.tenant_id,
        message="You cannot assign inspections for another tenant.",
    )
    actor_id = str(actor.id)

    if inspector:
        inspection.inspector = inspector
        InspectionAssignment.objects.create(
            tenant=inspection.tenant,
            inspection=inspection,
            assigned_to=inspector,
            assigned_by=actor,
            role=InspectionAssignment.Role.INSPECTOR,
            note=note,
            created_by=actor_id,
            updated_by=actor_id,
        )
    if supervisor:
        inspection.supervisor = supervisor
        InspectionAssignment.objects.create(
            tenant=inspection.tenant,
            inspection=inspection,
            assigned_to=supervisor,
            assigned_by=actor,
            role=InspectionAssignment.Role.SUPERVISOR,
            note=note,
            created_by=actor_id,
            updated_by=actor_id,
        )

    if inspection.status == Inspection.Status.DRAFT:
        _apply_status_timestamps(inspection, Inspection.Status.SCHEDULED)
        inspection.status = Inspection.Status.SCHEDULED
        record_status_history(
            inspection=inspection,
            from_status=Inspection.Status.DRAFT,
            to_status=Inspection.Status.SCHEDULED,
            changed_by=actor,
            action=InspectionStatusHistory.Action.SCHEDULE,
            note="Inspection scheduled during assignment.",
        )

    inspection.updated_by = actor_id
    inspection.save()
    recalculate_inspection_sla(inspection=inspection)
    record_history(
        inspection=inspection,
        action="assigned",
        description="Inspection assignment updated.",
        actor=actor,
        metadata={
            "inspector": str(inspector.id) if inspector else None,
            "supervisor": str(supervisor.id) if supervisor else None,
            "note": note,
        },
    )
    return inspection


@transaction.atomic
def change_status(*, inspection, to_status, changed_by=None, reason="", note=""):
    validate_status_transition(inspection.status, to_status)
    from_status = inspection.status
    _apply_status_timestamps(inspection, to_status)
    inspection.status = to_status
    inspection.updated_by = str(changed_by.id) if changed_by else None
    inspection.save()
    recalculate_inspection_sla(inspection=inspection)
    record_status_history(
        inspection=inspection,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        action=_status_history_action(to_status),
        reason=reason,
        note=note,
    )
    record_history(
        inspection=inspection,
        action="status_changed",
        description=f"Inspection status changed from {from_status} to {to_status}.",
        actor=changed_by,
        metadata={
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
            "note": note,
        },
    )
    return inspection


def start_inspection(*, inspection, actor=None, note=""):
    return change_status(
        inspection=inspection,
        to_status=Inspection.Status.IN_PROGRESS,
        changed_by=actor,
        note=note,
    )


def complete_inspection(*, inspection, actor=None, note=""):
    validate_completion_requirements(inspection)
    refresh_inspection_score(inspection=inspection, actor=actor)
    return change_status(
        inspection=inspection,
        to_status=Inspection.Status.COMPLETED,
        changed_by=actor,
        note=note,
    )


def verify_inspection(*, inspection, actor=None, note=""):
    validate_verification_requirements(inspection)
    return change_status(
        inspection=inspection,
        to_status=Inspection.Status.VERIFIED,
        changed_by=actor,
        note=note,
    )


def cancel_inspection(*, inspection, actor=None, reason="", note=""):
    return change_status(
        inspection=inspection,
        to_status=Inspection.Status.CANCELLED,
        changed_by=actor,
        reason=reason,
        note=note,
    )


def reopen_inspection(*, inspection, actor=None, reason="", note=""):
    return change_status(
        inspection=inspection,
        to_status=Inspection.Status.REOPENED,
        changed_by=actor,
        reason=reason,
        note=note,
    )


def update_corrective_action_status(corrective_action, *, actor=None):
    validate_corrective_action_due_date(corrective_action)
    if corrective_action.status == InspectionCorrectiveAction.Status.COMPLETED and (
        corrective_action.verification_status
        == InspectionCorrectiveAction.VerificationStatus.VERIFIED
    ):
        corrective_action.status = InspectionCorrectiveAction.Status.VERIFIED
    corrective_action.updated_by = str(actor.id) if actor else None
    corrective_action.save()
    record_history(
        inspection=corrective_action.inspection,
        action="corrective_action_updated",
        description="Inspection corrective action updated.",
        actor=actor,
        metadata={"corrective_action_id": str(corrective_action.id)},
    )
    return corrective_action


def check_inspection_escalations(*, inspection):
    sla = recalculate_inspection_sla(inspection=inspection)
    escalations = []

    if sla.completion_breached and not inspection.escalations.filter(
        escalation_type=InspectionEscalation.EscalationType.COMPLETION_BREACH,
        status__in=(InspectionEscalation.Status.OPEN, InspectionEscalation.Status.ACKNOWLEDGED),
    ).exists():
        escalations.append(
            InspectionEscalation.objects.create(
                tenant=inspection.tenant,
                inspection=inspection,
                sla=sla,
                reason="Inspection completion target breached.",
                escalation_type=InspectionEscalation.EscalationType.COMPLETION_BREACH,
                level=InspectionEscalation.Level.LEVEL_1,
            )
        )

    for corrective_action in inspection.corrective_actions.all():
        validate_corrective_action_due_date(corrective_action)
        if corrective_action.status == InspectionCorrectiveAction.Status.OVERDUE and not inspection.escalations.filter(
            escalation_type=InspectionEscalation.EscalationType.CORRECTIVE_ACTION_OVERDUE,
            corrective_action=corrective_action,
            status__in=(InspectionEscalation.Status.OPEN, InspectionEscalation.Status.ACKNOWLEDGED),
        ).exists():
            escalations.append(
                InspectionEscalation.objects.create(
                    tenant=inspection.tenant,
                    inspection=inspection,
                    corrective_action=corrective_action,
                    reason="Corrective action overdue.",
                    escalation_type=InspectionEscalation.EscalationType.CORRECTIVE_ACTION_OVERDUE,
                    level=InspectionEscalation.Level.LEVEL_1,
                )
            )
    return escalations
