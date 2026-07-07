from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import MaintenanceEscalation, MaintenanceWorkOrder
from .services import record_history
from .work_order_sla_service import get_sla_conditions, recalculate_work_order_sla

ACTIVE_ESCALATION_STATUSES = {
    MaintenanceEscalation.Status.OPEN,
    MaintenanceEscalation.Status.ACKNOWLEDGED,
}


def _create_escalation(*, work_order, sla, escalation_type):
    existing = work_order.escalations.filter(
        escalation_type=escalation_type,
        status__in=ACTIVE_ESCALATION_STATUSES,
    ).first()
    if existing:
        return existing, False

    is_breach = escalation_type.endswith("breach")
    subject = escalation_type.replace("_", " ")
    escalation = MaintenanceEscalation(
        tenant=work_order.tenant,
        work_order=work_order,
        sla=sla,
        escalated_to=work_order.assignee,
        escalation_type=escalation_type,
        level=(
            MaintenanceEscalation.Level.LEVEL_2
            if is_breach
            else MaintenanceEscalation.Level.LEVEL_1
        ),
        reason=f"SLA {subject} detected.",
        status=MaintenanceEscalation.Status.OPEN,
    )
    escalation.full_clean()
    escalation.save()
    record_history(
        work_order=work_order,
        action="sla_escalation_created",
        description=escalation.reason,
        metadata={
            "escalation_id": str(escalation.id),
            "escalation_type": escalation_type,
        },
    )
    return escalation, True


@transaction.atomic
def check_work_order_escalations(*, work_order, now=None):
    if work_order.status in {
        MaintenanceWorkOrder.Status.COMPLETED,
        MaintenanceWorkOrder.Status.CANCELLED,
        MaintenanceWorkOrder.Status.CLOSED,
    }:
        return []

    sla = recalculate_work_order_sla(work_order=work_order, now=now)
    conditions = get_sla_conditions(sla, now=now)
    created = []
    for escalation_type, applies in conditions.items():
        if applies:
            escalation, was_created = _create_escalation(
                work_order=work_order,
                sla=sla,
                escalation_type=escalation_type,
            )
            if was_created:
                created.append(escalation)
    return created


@transaction.atomic
def acknowledge_escalation(*, escalation, actor, notes=""):
    if escalation.status != MaintenanceEscalation.Status.OPEN:
        raise ValidationError({"status": "Only open escalations can be acknowledged."})
    escalation.status = MaintenanceEscalation.Status.ACKNOWLEDGED
    escalation.acknowledged_by = actor
    escalation.acknowledged_at = timezone.now()
    escalation.notes = notes
    escalation.updated_by = str(actor.id)
    escalation.save()
    record_history(
        work_order=escalation.work_order,
        action="sla_escalation_acknowledged",
        description="Maintenance SLA escalation acknowledged.",
        actor=actor,
        metadata={"escalation_id": str(escalation.id), "notes": notes},
    )
    return escalation


@transaction.atomic
def resolve_escalation(*, escalation, actor, notes):
    if not notes.strip():
        raise ValidationError({"notes": "Resolution notes are required."})
    if escalation.status not in ACTIVE_ESCALATION_STATUSES:
        raise ValidationError({"status": "Only active escalations can be resolved."})
    escalation.status = MaintenanceEscalation.Status.RESOLVED
    escalation.is_active = False
    escalation.resolved_by = actor
    escalation.resolved_at = timezone.now()
    escalation.notes = notes
    escalation.updated_by = str(actor.id)
    escalation.full_clean()
    escalation.save()
    record_history(
        work_order=escalation.work_order,
        action="sla_escalation_resolved",
        description="Maintenance SLA escalation resolved.",
        actor=actor,
        metadata={"escalation_id": str(escalation.id), "notes": notes},
    )
    return escalation
