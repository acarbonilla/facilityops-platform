from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)


class LifecycleConflict(APIException):
    status_code = 409
    default_code = "lifecycle_conflict"


DEPENDENCIES = {
    Tenant: (
        ("organizations", "organizations"),
        ("departments", "departments"),
        ("buildings", "buildings"),
        ("floors", "floors"),
        ("areas", "areas"),
        ("asset_types", "asset types"),
        ("assets", "assets"),
        ("users", "users"),
    ),
    Organization: (
        ("departments", "departments"),
        ("buildings", "buildings"),
        ("assets", "assets"),
        ("users", "users"),
    ),
    Building: (
        ("floors", "floors"),
        ("areas", "areas"),
        ("assets", "assets"),
    ),
    Floor: (
        ("areas", "areas"),
        ("assets", "assets"),
    ),
    Area: (("assets", "assets"),),
    AssetType: (("assets", "assets"),),
    Department: (),
    Asset: (),
}


def _actor_id(actor):
    return getattr(actor, "id", None)


def _locked_object(queryset, pk):
    try:
        return queryset.select_for_update(of=("self",)).get(pk=pk)
    except (queryset.model.DoesNotExist, DjangoValidationError, ValueError):
        raise Http404 from None


def _dependent_queryset(instance, relation_name, *, active_only):
    queryset = getattr(instance, relation_name).all()
    tenant_id = instance.id if isinstance(instance, Tenant) else instance.tenant_id
    queryset = queryset.filter(tenant_id=tenant_id)
    if relation_name != "users":
        queryset = queryset.filter(is_deleted=False)
    if active_only:
        queryset = queryset.filter(is_active=True)
    return queryset


def _lock_restore_parents(instance):
    if isinstance(instance, Tenant):
        return
    field_names = ["tenant"]
    if isinstance(instance, (Department, Building)):
        field_names.append("organization")
    elif isinstance(instance, Floor):
        field_names.append("building")
    elif isinstance(instance, Area):
        field_names.extend(("building", "floor"))
    elif isinstance(instance, Asset):
        field_names.extend(
            (
                "organization",
                "building",
                "floor",
                "area",
                "asset_type",
            )
        )

    for field_name in field_names:
        parent = getattr(instance, field_name)
        if parent is None:
            continue
        locked = type(parent).objects.select_for_update(of=("self",)).get(
            pk=parent.pk
        )
        setattr(instance, field_name, locked)


def blocking_dependencies(instance, *, active_only):
    blockers = []
    for relation_name, label in DEPENDENCIES[type(instance)]:
        if _dependent_queryset(
            instance,
            relation_name,
            active_only=active_only,
        ).exists():
            blockers.append(label)
    return blockers


def require_no_dependencies(instance, *, operation):
    active_only = operation == "deactivate"
    blockers = blocking_dependencies(instance, active_only=active_only)
    if blockers:
        raise LifecycleConflict(
            {
                "detail": (
                    f"Cannot {operation} this {instance._meta.verbose_name}; "
                    "dependent records exist."
                ),
                "dependencies": blockers,
            }
        )


def require_valid_restore_hierarchy(instance):
    errors = {}

    def require_parent(field_name, parent):
        if parent is None:
            errors[field_name] = "This parent is required."
            return
        if parent.is_deleted:
            errors[field_name] = "Parent is deleted."
        elif not parent.is_active:
            errors[field_name] = "Parent is inactive."

    if isinstance(instance, Tenant):
        return

    require_parent("tenant", instance.tenant)
    if isinstance(instance, (Department, Building)):
        require_parent("organization", instance.organization)
        if instance.organization.tenant_id != instance.tenant_id:
            errors["organization"] = "Organization must belong to the selected tenant."
    elif isinstance(instance, Floor):
        require_parent("building", instance.building)
        if instance.building.tenant_id != instance.tenant_id:
            errors["building"] = "Building must belong to the selected tenant."
    elif isinstance(instance, Area):
        require_parent("building", instance.building)
        require_parent("floor", instance.floor)
        if instance.building.tenant_id != instance.tenant_id:
            errors["building"] = "Building must belong to the selected tenant."
        if instance.floor.tenant_id != instance.tenant_id:
            errors["floor"] = "Floor must belong to the selected tenant."
        elif instance.floor.building_id != instance.building_id:
            errors["floor"] = "Floor must belong to the selected building."
    elif isinstance(instance, Asset):
        for field_name in (
            "organization",
            "building",
            "floor",
            "area",
            "asset_type",
        ):
            parent = getattr(instance, field_name)
            if parent is not None:
                require_parent(field_name, parent)
                if parent.tenant_id != instance.tenant_id:
                    errors[field_name] = (
                        f"{field_name.replace('_', ' ').title()} must belong "
                        "to the selected tenant."
                    )
        if instance.building.organization_id != instance.organization_id:
            errors["building"] = "Building must belong to the selected organization."
        if (
            instance.floor is not None
            and instance.floor.building_id != instance.building_id
        ):
            errors["floor"] = "Floor must belong to the selected building."
        if instance.area is not None:
            if instance.area.building_id != instance.building_id:
                errors["area"] = "Area must belong to the selected building."
            elif instance.floor is None or instance.area.floor_id != instance.floor_id:
                errors["area"] = "Area must belong to the selected floor."

    if errors:
        raise LifecycleConflict(
            {
                "detail": (
                    "The record cannot be restored with its current hierarchy."
                ),
                "errors": errors,
            }
        )


@transaction.atomic
def soft_delete_master_data(queryset, *, pk, actor):
    locked = _locked_object(queryset, pk)
    if locked.is_deleted:
        raise Http404
    require_no_dependencies(locked, operation="delete")
    actor_id = _actor_id(actor)
    locked.is_deleted = True
    locked.is_active = False
    locked.deleted_at = timezone.now()
    locked.deleted_by = actor_id
    locked.updated_by = actor_id
    locked.save(
        update_fields=(
            "is_deleted",
            "is_active",
            "deleted_at",
            "deleted_by",
            "updated_by",
            "updated_at",
        )
    )


@transaction.atomic
def restore_master_data(queryset, *, pk, actor):
    locked = _locked_object(queryset, pk)
    if not locked.is_deleted:
        raise LifecycleConflict(
            {"detail": "Only a deleted record can be restored."}
        )
    _lock_restore_parents(locked)
    require_valid_restore_hierarchy(locked)
    locked.is_deleted = False
    locked.is_active = False
    locked.deleted_at = None
    locked.deleted_by = None
    locked.updated_by = _actor_id(actor)
    locked.save(
        update_fields=(
            "is_deleted",
            "is_active",
            "deleted_at",
            "deleted_by",
            "updated_by",
            "updated_at",
        )
    )
    return locked


@transaction.atomic
def require_safe_deactivation(queryset, *, pk):
    locked = _locked_object(queryset, pk)
    require_no_dependencies(locked, operation="deactivate")
