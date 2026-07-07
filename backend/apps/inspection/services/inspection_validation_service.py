from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.inspection.models import Inspection, InspectionCorrectiveAction
from apps.inspection.tenant_scope import user_can_access_tenant
from apps.inspection.validators import validate_status_transition


def validate_actor_can_access_tenant(actor, tenant_id, *, message):
    if actor and not user_can_access_tenant(actor, tenant_id):
        raise PermissionDenied(message)


def validate_completion_requirements(inspection):
    errors = {}
    if not inspection.items.exists():
        errors["items"] = "At least one checklist item is required before completion."

    incomplete_items = inspection.items.filter(score__isnull=True)
    if incomplete_items.exists():
        errors["items"] = "All checklist items must have scores before completion."

    undecided_items = inspection.items.filter(is_pass__isnull=True)
    if undecided_items.exists():
        errors["items"] = (
            "All checklist items must have pass / fail results before completion."
        )

    if errors:
        raise ValidationError(errors)


def validate_verification_requirements(inspection):
    errors = {}
    if inspection.status != Inspection.Status.COMPLETED:
        errors["status"] = "Only completed inspections can be verified."

    blocking_actions = inspection.corrective_actions.filter(
        status__in=(
            InspectionCorrectiveAction.Status.OPEN,
            InspectionCorrectiveAction.Status.IN_PROGRESS,
            InspectionCorrectiveAction.Status.OVERDUE,
        )
    )
    if blocking_actions.exists():
        errors["corrective_actions"] = (
            "All corrective actions must be completed before verification."
        )

    if errors:
        raise ValidationError(errors)


def validate_corrective_action_due_date(corrective_action):
    if corrective_action.due_date < timezone.now() and corrective_action.status in {
        InspectionCorrectiveAction.Status.OPEN,
        InspectionCorrectiveAction.Status.IN_PROGRESS,
    }:
        corrective_action.status = InspectionCorrectiveAction.Status.OVERDUE


def validate_transition(from_status, to_status):
    validate_status_transition(from_status, to_status)

