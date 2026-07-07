from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import MaintenanceSLA, MaintenanceWorkOrder
from .services import record_history

SLA_RULES = {
    MaintenanceWorkOrder.Priority.CRITICAL: (30, 240),
    MaintenanceWorkOrder.Priority.HIGH: (60, 480),
    MaintenanceWorkOrder.Priority.MEDIUM: (240, 1440),
    MaintenanceWorkOrder.Priority.LOW: (480, 2880),
}


def _deadline_breached(actual_at, due_at, now):
    if not due_at:
        return False
    return actual_at > due_at if actual_at else now > due_at


def _warning_window(target_minutes):
    return timedelta(minutes=max(15, target_minutes // 4))


def _completion_due_at(work_order, target_minutes):
    rule_due_at = work_order.requested_at + timedelta(minutes=target_minutes)
    if work_order.due_at:
        return min(rule_due_at, work_order.due_at)
    return rule_due_at


def is_sla_overdue(sla, now=None):
    now = now or timezone.now()
    return bool(
        (
            not sla.first_responded_at
            and sla.response_due_at
            and now > sla.response_due_at
        )
        or (
            not sla.resolved_at
            and sla.resolution_due_at
            and now > sla.resolution_due_at
        )
    )


@transaction.atomic
def recalculate_work_order_sla(*, work_order, actor=None, write_audit=False, now=None):
    now = now or timezone.now()
    response_target, completion_target = SLA_RULES[work_order.priority]
    response_due_at = work_order.requested_at + timedelta(minutes=response_target)
    completion_due_at = _completion_due_at(work_order, completion_target)
    resolved_at = work_order.completed_at or work_order.closed_at

    sla, _ = MaintenanceSLA.objects.get_or_create(work_order=work_order)
    sla.tenant = work_order.tenant
    sla.priority = work_order.priority
    sla.response_target_minutes = response_target
    sla.completion_target_minutes = completion_target
    sla.response_due_at = response_due_at
    sla.resolution_due_at = completion_due_at
    sla.resolved_at = resolved_at
    sla.response_breached = _deadline_breached(
        sla.first_responded_at, response_due_at, now
    )
    sla.completion_breached = _deadline_breached(resolved_at, completion_due_at, now)
    sla.response_met = None if not sla.first_responded_at else not sla.response_breached
    sla.resolution_met = None if not resolved_at else not sla.completion_breached

    if work_order.status == MaintenanceWorkOrder.Status.CANCELLED:
        sla.sla_status = MaintenanceSLA.Status.CANCELLED
    elif work_order.status in {
        MaintenanceWorkOrder.Status.COMPLETED,
        MaintenanceWorkOrder.Status.CLOSED,
    }:
        sla.sla_status = MaintenanceSLA.Status.COMPLETED
    elif work_order.status == MaintenanceWorkOrder.Status.ON_HOLD:
        sla.sla_status = MaintenanceSLA.Status.PAUSED
    elif sla.response_breached or sla.completion_breached:
        sla.sla_status = MaintenanceSLA.Status.BREACHED
    else:
        active_due_at = (
            response_due_at if not sla.first_responded_at else completion_due_at
        )
        active_target = (
            response_target if not sla.first_responded_at else completion_target
        )
        if active_due_at - now <= _warning_window(active_target):
            sla.sla_status = MaintenanceSLA.Status.WARNING
        elif work_order.status == MaintenanceWorkOrder.Status.DRAFT:
            sla.sla_status = MaintenanceSLA.Status.NOT_STARTED
        else:
            sla.sla_status = MaintenanceSLA.Status.WITHIN_SLA

    sla.last_recalculated_at = now
    sla.updated_by = str(actor.id) if actor else work_order.updated_by
    sla.save()

    if write_audit:
        record_history(
            work_order=work_order,
            action="sla_recalculated",
            description="Maintenance SLA targets and status recalculated.",
            actor=actor,
            metadata={
                "sla_status": sla.sla_status,
                "response_due_at": response_due_at.isoformat(),
                "completion_due_at": completion_due_at.isoformat(),
            },
        )
    return sla


def get_sla_conditions(sla, now=None):
    now = now or timezone.now()
    response_warning = bool(
        not sla.first_responded_at
        and not sla.response_breached
        and sla.response_due_at
        and sla.response_due_at - now <= _warning_window(sla.response_target_minutes)
    )
    completion_warning = bool(
        sla.first_responded_at
        and not sla.resolved_at
        and not sla.completion_breached
        and sla.resolution_due_at
        and sla.resolution_due_at - now
        <= _warning_window(sla.completion_target_minutes)
    )
    return {
        "response_warning": response_warning,
        "response_breach": sla.response_breached and not sla.first_responded_at,
        "completion_warning": completion_warning,
        "completion_breach": sla.completion_breached and not sla.resolved_at,
    }
