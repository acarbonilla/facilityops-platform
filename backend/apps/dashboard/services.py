from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)

from .tenant_scope import scope_master_data_to_user, scope_tenants_to_user

SERVICE_NAME = "facilityops-backend"


def _active_count(queryset):
    return queryset.filter(is_deleted=False).count()


def build_foundation_summary(user):
    """Return tenant-scoped Foundation Dashboard master-data counts.

    Soft-deleted rows are excluded. Active/inactive filtering is intentionally
    unchanged from FO-017 (``is_deleted=False`` only). Aggregation is
    backend-authoritative and never trusts client-supplied tenant hints.
    """
    return {
        "tenants": _active_count(scope_tenants_to_user(Tenant.objects.all(), user)),
        "organizations": _active_count(
            scope_master_data_to_user(Organization.objects.all(), user)
        ),
        "departments": _active_count(
            scope_master_data_to_user(Department.objects.all(), user)
        ),
        "buildings": _active_count(
            scope_master_data_to_user(Building.objects.all(), user)
        ),
        "floors": _active_count(scope_master_data_to_user(Floor.objects.all(), user)),
        "areas": _active_count(scope_master_data_to_user(Area.objects.all(), user)),
        "asset_types": _active_count(
            scope_master_data_to_user(AssetType.objects.all(), user)
        ),
        "assets": _active_count(scope_master_data_to_user(Asset.objects.all(), user)),
        "service": SERVICE_NAME,
    }
