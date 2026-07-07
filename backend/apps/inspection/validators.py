from decimal import Decimal

from django.core.exceptions import ValidationError


INSPECTION_STATUS_TRANSITIONS = {
    "draft": {"scheduled", "cancelled"},
    "scheduled": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"verified", "reopened"},
    "verified": {"reopened"},
    "cancelled": {"reopened"},
    "reopened": {"scheduled", "in_progress", "cancelled"},
}


def validate_status_transition(from_status, to_status):
    if not from_status or from_status == to_status:
        return

    allowed_statuses = INSPECTION_STATUS_TRANSITIONS.get(from_status, set())
    if to_status not in allowed_statuses:
        raise ValidationError(
            {"status": f"Cannot change status from {from_status} to {to_status}."}
        )


def collect_location_validation_errors(inspection):
    errors = {}

    if (
        inspection.organization_id
        and inspection.organization.tenant_id != inspection.tenant_id
    ):
        errors["organization"] = "Organization must belong to the selected tenant."

    if inspection.department_id:
        if inspection.department.tenant_id != inspection.tenant_id:
            errors["department"] = "Department must belong to the selected tenant."
        if inspection.department.organization_id != inspection.organization_id:
            errors["department"] = (
                "Department must belong to the selected organization."
            )

    if inspection.building_id:
        if inspection.building.tenant_id != inspection.tenant_id:
            errors["building"] = "Building must belong to the selected tenant."
        if inspection.building.organization_id != inspection.organization_id:
            errors["building"] = "Building must belong to the selected organization."

    if inspection.floor_id:
        if inspection.floor.tenant_id != inspection.tenant_id:
            errors["floor"] = "Floor must belong to the selected tenant."
        if inspection.floor.building_id != inspection.building_id:
            errors["floor"] = "Floor must belong to the selected building."

    if inspection.area_id:
        if inspection.area.tenant_id != inspection.tenant_id:
            errors["area"] = "Area must belong to the selected tenant."
        if inspection.area.building_id != inspection.building_id:
            errors["area"] = "Area must belong to the selected building."
        if inspection.floor_id and inspection.area.floor_id != inspection.floor_id:
            errors["area"] = "Area must belong to the selected floor."

    return errors


def validate_score_range(score, *, field_name="score", maximum=Decimal("100.00")):
    if score is None:
        return
    if score < Decimal("0.00") or score > maximum:
        raise ValidationError(
            {field_name: f"{field_name.replace('_', ' ').title()} must be between 0 and {maximum}."}
        )

