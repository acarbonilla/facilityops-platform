from django.core.exceptions import ValidationError


WORK_ORDER_STATUS_TRANSITIONS = {
    "draft": {"open", "cancelled"},
    "open": {"assigned", "in_progress", "on_hold", "completed", "cancelled"},
    "assigned": {"in_progress", "on_hold", "completed", "cancelled"},
    "in_progress": {"on_hold", "completed", "cancelled"},
    "on_hold": {"assigned", "in_progress", "completed", "cancelled"},
    "completed": {"closed", "in_progress"},
    "cancelled": {"closed"},
    "closed": set(),
}


def validate_status_transition(from_status, to_status):
    if not from_status or from_status == to_status:
        return

    allowed_statuses = WORK_ORDER_STATUS_TRANSITIONS.get(from_status, set())
    if to_status not in allowed_statuses:
        raise ValidationError(
            {
                "status": (
                    f"Cannot change status from {from_status} to {to_status}."
                )
            }
        )


def collect_location_validation_errors(work_order):
    errors = {}

    if work_order.organization_id and work_order.organization.tenant_id != work_order.tenant_id:
        errors["organization"] = "Organization must belong to the selected tenant."

    if work_order.department_id:
        if work_order.department.tenant_id != work_order.tenant_id:
            errors["department"] = "Department must belong to the selected tenant."
        if work_order.department.organization_id != work_order.organization_id:
            errors["department"] = (
                "Department must belong to the selected organization."
            )

    if work_order.building_id:
        if work_order.building.tenant_id != work_order.tenant_id:
            errors["building"] = "Building must belong to the selected tenant."
        if work_order.building.organization_id != work_order.organization_id:
            errors["building"] = (
                "Building must belong to the selected organization."
            )

    if work_order.floor_id:
        if work_order.floor.tenant_id != work_order.tenant_id:
            errors["floor"] = "Floor must belong to the selected tenant."
        if work_order.floor.building_id != work_order.building_id:
            errors["floor"] = "Floor must belong to the selected building."

    if work_order.area_id:
        if work_order.area.tenant_id != work_order.tenant_id:
            errors["area"] = "Area must belong to the selected tenant."
        if work_order.area.building_id != work_order.building_id:
            errors["area"] = "Area must belong to the selected building."
        if work_order.floor_id and work_order.area.floor_id != work_order.floor_id:
            errors["area"] = "Area must belong to the selected floor."

    if work_order.asset_id:
        if work_order.asset.tenant_id != work_order.tenant_id:
            errors["asset"] = "Asset must belong to the selected tenant."
        if work_order.asset.organization_id != work_order.organization_id:
            errors["asset"] = "Asset must belong to the selected organization."
        if work_order.asset.building_id != work_order.building_id:
            errors["asset"] = "Asset must belong to the selected building."
        if work_order.floor_id and work_order.asset.floor_id != work_order.floor_id:
            errors["asset"] = "Asset must belong to the selected floor."
        if work_order.area_id and work_order.asset.area_id != work_order.area_id:
            errors["asset"] = "Asset must belong to the selected area."

    return errors
