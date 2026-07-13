from apps.access_control.services import get_user_roles, user_has_permission
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    MaintenanceAssignment,
    MaintenanceStatusHistory,
    MaintenanceWorkOrder,
)
from .notification_service import (
    notify_maintenance_assigned,
    notify_maintenance_reassigned,
)
from .services import calculate_sla, record_history, record_status_history

TERMINAL_ASSIGNMENT_STATUSES = {
    MaintenanceWorkOrder.Status.COMPLETED,
    MaintenanceWorkOrder.Status.CANCELLED,
    MaintenanceWorkOrder.Status.CLOSED,
}


def _require_permission(actor, action):
    permission_codes = (
        f"maintenance.work_order.{action}",
        f"maintenance.{action}",
        "maintenance.manage",
    )
    if not any(user_has_permission(actor, code) for code in permission_codes):
        raise PermissionDenied("You do not have permission to manage assignments.")


def _validate_user(user, *, field, allowed_roles, tenant_id):
    if user is None:
        return
    if not user.is_active:
        raise ValidationError({field: "Assigned user must be active."})
    if getattr(user, "tenant_id", None) != tenant_id:
        raise ValidationError(
            {field: "Assigned user must belong to the work order tenant."}
        )

    role_codes = {role.code for role in get_user_roles(user)}
    if role_codes and not role_codes.intersection(allowed_roles):
        raise ValidationError(
            {
                field: f"User must have one of these roles: {', '.join(sorted(allowed_roles))}."
            }
        )


def _validate_principals(assigned_to, supervisor, *, tenant_id):
    _validate_user(
        assigned_to,
        field="assigned_to",
        allowed_roles={"technician", "facility_manager", "system_admin"},
        tenant_id=tenant_id,
    )
    _validate_user(
        supervisor,
        field="supervisor",
        allowed_roles={"facility_manager", "system_admin"},
        tenant_id=tenant_id,
    )
    if assigned_to and supervisor and assigned_to.pk == supervisor.pk:
        raise ValidationError(
            {"supervisor": "Technician and supervisor must be different users."}
        )


def _assignment_type(assigned_to, supervisor):
    if assigned_to and supervisor:
        return MaintenanceAssignment.AssignmentType.COMBINED
    if supervisor:
        return MaintenanceAssignment.AssignmentType.SUPERVISOR
    if assigned_to:
        return MaintenanceAssignment.AssignmentType.TECHNICIAN
    return MaintenanceAssignment.AssignmentType.UNASSIGNED


def _record_assignment_status_change(
    work_order, *, from_status, actor, action, note, reason=""
):
    if from_status == work_order.status:
        return
    record_status_history(
        work_order=work_order,
        from_status=from_status,
        to_status=work_order.status,
        changed_by=actor,
        action=action,
        note=note,
        reason=reason,
    )


def _deactivate_active_assignment(work_order, *, actor_id, timestamp):
    active = work_order.assignments.filter(is_active=True).first()
    if active:
        active.is_active = False
        active.unassigned_at = timestamp
        active.updated_by = actor_id
        active.save(
            update_fields=("is_active", "unassigned_at", "updated_by", "updated_at")
        )
    return active


@transaction.atomic
def assign_work_order(
    *,
    work_order,
    assigned_to,
    assigned_by,
    supervisor=None,
    notes="",
    enforce_permission=True,
):
    if enforce_permission:
        _require_permission(assigned_by, "assign")
    if work_order.status in TERMINAL_ASSIGNMENT_STATUSES:
        raise ValidationError(
            {
                "status": "Completed, cancelled, or closed work orders cannot be assigned."
            }
        )
    if work_order.status not in {
        MaintenanceWorkOrder.Status.OPEN,
        MaintenanceWorkOrder.Status.REOPENED,
    }:
        raise ValidationError(
            {"status": "Use reassign for a work order that is already assigned."}
        )
    _validate_principals(assigned_to, supervisor, tenant_id=work_order.tenant_id)

    timestamp = timezone.now()
    actor_id = str(assigned_by.id)
    from_status = work_order.status
    work_order.assignee = assigned_to
    work_order.status = MaintenanceWorkOrder.Status.ASSIGNED
    work_order.updated_by = actor_id
    work_order.save()

    assignment = MaintenanceAssignment(
        tenant=work_order.tenant,
        work_order=work_order,
        assigned_to=assigned_to,
        supervisor=supervisor,
        assigned_by=assigned_by,
        assignment_type=_assignment_type(assigned_to, supervisor),
        assignment_status=MaintenanceAssignment.AssignmentStatus.ASSIGNED,
        note=notes,
        assigned_at=timestamp,
        created_by=actor_id,
        updated_by=actor_id,
    )
    assignment.full_clean()
    assignment.save()
    sla = calculate_sla(work_order)
    if not sla.first_responded_at:
        sla.first_responded_at = timestamp
        sla.updated_by = actor_id
        sla.save(update_fields=("first_responded_at", "updated_by", "updated_at"))
        calculate_sla(work_order)
    _record_assignment_status_change(
        work_order,
        from_status=from_status,
        actor=assigned_by,
        action=MaintenanceStatusHistory.Action.ASSIGN,
        note=notes,
    )
    record_history(
        work_order=work_order,
        action="assignment_assigned",
        description=f"Work order assigned to {assigned_to.email}.",
        actor=assigned_by,
        metadata={"assignment_id": str(assignment.id), "notes": notes},
    )
    notify_maintenance_assigned(
        work_order=work_order,
        technician=assigned_to,
        supervisor=supervisor,
        actor=assigned_by,
    )
    return work_order


@transaction.atomic
def reassign_work_order(
    *, work_order, assigned_to, assigned_by, supervisor=None, reason, notes=""
):
    _require_permission(assigned_by, "reassign")
    if not reason.strip():
        raise ValidationError({"reason": "Reassignment reason is required."})
    if work_order.status in TERMINAL_ASSIGNMENT_STATUSES:
        raise ValidationError(
            {
                "status": "Completed, cancelled, or closed work orders cannot be reassigned."
            }
        )
    _validate_principals(assigned_to, supervisor, tenant_id=work_order.tenant_id)

    timestamp = timezone.now()
    actor_id = str(assigned_by.id)
    previous = _deactivate_active_assignment(
        work_order, actor_id=actor_id, timestamp=timestamp
    )
    if previous is None:
        raise ValidationError(
            {"assignment": "Work order does not have an active assignment."}
        )

    from_status = work_order.status
    work_order.assignee = assigned_to
    if work_order.status in {
        MaintenanceWorkOrder.Status.OPEN,
        MaintenanceWorkOrder.Status.REOPENED,
    }:
        work_order.status = MaintenanceWorkOrder.Status.ASSIGNED
    work_order.updated_by = actor_id
    work_order.save()

    assignment = MaintenanceAssignment(
        tenant=work_order.tenant,
        work_order=work_order,
        assigned_to=assigned_to,
        supervisor=supervisor,
        assigned_by=assigned_by,
        previous_assigned_to=previous.assigned_to,
        previous_supervisor=previous.supervisor,
        assignment_type=_assignment_type(assigned_to, supervisor),
        assignment_status=MaintenanceAssignment.AssignmentStatus.REASSIGNED,
        reason=reason,
        note=notes,
        assigned_at=timestamp,
        created_by=actor_id,
        updated_by=actor_id,
    )
    assignment.full_clean()
    assignment.save()
    _record_assignment_status_change(
        work_order,
        from_status=from_status,
        actor=assigned_by,
        action=MaintenanceStatusHistory.Action.ASSIGN,
        note=notes,
        reason=reason,
    )
    record_history(
        work_order=work_order,
        action="assignment_reassigned",
        description=f"Work order reassigned to {assigned_to.email}.",
        actor=assigned_by,
        metadata={
            "assignment_id": str(assignment.id),
            "reason": reason,
            "notes": notes,
        },
    )
    notify_maintenance_reassigned(
        work_order=work_order,
        technician=assigned_to,
        supervisor=supervisor,
        previous_assignment=previous,
        actor=assigned_by,
    )
    return work_order


@transaction.atomic
def unassign_work_order(*, work_order, unassigned_by, reason, notes=""):
    _require_permission(unassigned_by, "unassign")
    if not reason.strip():
        raise ValidationError({"reason": "Unassignment reason is required."})
    if work_order.status in TERMINAL_ASSIGNMENT_STATUSES:
        raise ValidationError(
            {
                "status": "Completed, cancelled, or closed work orders cannot be unassigned."
            }
        )

    timestamp = timezone.now()
    actor_id = str(unassigned_by.id)
    previous = _deactivate_active_assignment(
        work_order, actor_id=actor_id, timestamp=timestamp
    )
    if previous is None:
        raise ValidationError(
            {"assignment": "Work order does not have an active assignment."}
        )

    from_status = work_order.status
    work_order.assignee = None
    if work_order.status == MaintenanceWorkOrder.Status.ASSIGNED:
        work_order.status = MaintenanceWorkOrder.Status.OPEN
    work_order.updated_by = actor_id
    work_order.save()

    event = MaintenanceAssignment(
        tenant=work_order.tenant,
        work_order=work_order,
        assigned_by=unassigned_by,
        previous_assigned_to=previous.assigned_to,
        previous_supervisor=previous.supervisor,
        assignment_type=MaintenanceAssignment.AssignmentType.UNASSIGNED,
        assignment_status=MaintenanceAssignment.AssignmentStatus.UNASSIGNED,
        reason=reason,
        note=notes,
        assigned_at=timestamp,
        is_active=False,
        unassigned_at=timestamp,
        created_by=actor_id,
        updated_by=actor_id,
    )
    event.full_clean()
    event.save()
    _record_assignment_status_change(
        work_order,
        from_status=from_status,
        actor=unassigned_by,
        action=MaintenanceStatusHistory.Action.ASSIGN,
        note=notes,
        reason=reason,
    )
    record_history(
        work_order=work_order,
        action="assignment_unassigned",
        description="Work order returned to the unassigned queue.",
        actor=unassigned_by,
        metadata={"assignment_id": str(event.id), "reason": reason, "notes": notes},
    )
    return work_order
