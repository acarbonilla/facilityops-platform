from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import NotFound, ValidationError

from apps.fm_tickets.models import FmTicket
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
from apps.master_data.models import Building, Organization

from .tenant_scope import has_global_reporting_scope, scope_queryset_to_user

DEFAULT_DATE_RANGE_DAYS = 90
MAX_DATE_RANGE_DAYS = 180

TICKET_OPEN_STATUSES = (
    FmTicket.Status.DRAFT,
    FmTicket.Status.OPEN,
    FmTicket.Status.ASSIGNED,
    FmTicket.Status.IN_PROGRESS,
    FmTicket.Status.ON_HOLD,
)

WORK_ORDER_TERMINAL_STATUSES = (
    MaintenanceWorkOrder.Status.COMPLETED,
    MaintenanceWorkOrder.Status.CANCELLED,
    MaintenanceWorkOrder.Status.CLOSED,
)

UNSUPPORTED_FILTER_PARAMS = ("status", "priority")


def _parse_bound(raw_value, field_name):
    if raw_value in (None, ""):
        return None
    parsed = parse_datetime(str(raw_value))
    if parsed is None:
        raise ValidationError({field_name: "Must be a valid ISO-8601 datetime."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _parse_optional_uuid(raw_value, field_name):
    if raw_value in (None, ""):
        return None
    try:
        return UUID(str(raw_value))
    except (TypeError, ValueError, AttributeError):
        raise ValidationError({field_name: ["Must be a valid UUID."]}) from None


def _reject_unsupported_filters(query_params):
    errors = {}
    for field_name in UNSUPPORTED_FILTER_PARAMS:
        if query_params.get(field_name) not in (None, ""):
            errors[field_name] = [
                "This filter is not supported by the current Reporting overview contract."
            ]
    if errors:
        raise ValidationError(errors)


def _eligible_master_data_queryset(model, user):
    queryset = model.objects.filter(is_deleted=False, is_active=True)
    if has_global_reporting_scope(user):
        return queryset
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(tenant_id=tenant_id)


def _resolve_accessible_organization(user, organization_id):
    if organization_id is None:
        return None
    organization = _eligible_master_data_queryset(Organization, user).filter(
        id=organization_id
    ).first()
    if organization is None:
        raise NotFound("Organization not found.")
    return organization


def _resolve_accessible_building(user, building_id):
    if building_id is None:
        return None
    building = (
        _eligible_master_data_queryset(Building, user)
        .select_related("organization")
        .filter(id=building_id)
        .first()
    )
    if building is None:
        raise NotFound("Building not found.")
    return building


def resolve_reporting_filters(query_params, user=None):
    """Normalize and validate overview query filters.

    Supported public filters: date_from, date_to, building, organization.
    Date bounds are inclusive on both ends (``__gte`` / ``__lte``).
    Default period is the last 90 days through now. Inclusive span must not
    exceed 180 days. Status and priority are rejected until FO-066.
    """
    _reject_unsupported_filters(query_params)

    now = timezone.now()
    date_to = _parse_bound(query_params.get("date_to"), "date_to") or now
    date_from = _parse_bound(query_params.get("date_from"), "date_from")
    if date_from is None:
        date_from = date_to - timedelta(days=DEFAULT_DATE_RANGE_DAYS)

    if date_from > date_to:
        raise ValidationError({"date_from": "Must be earlier than or equal to date_to."})

    span_days = (date_to - date_from).total_seconds() / 86400
    if span_days > MAX_DATE_RANGE_DAYS:
        raise ValidationError(
            {
                "date_from": (
                    f"Date range must not exceed {MAX_DATE_RANGE_DAYS} days."
                )
            }
        )

    building_id = _parse_optional_uuid(query_params.get("building"), "building")
    organization_id = _parse_optional_uuid(
        query_params.get("organization"), "organization"
    )

    organization = None
    building = None
    if user is not None:
        if building_id is not None or organization_id is not None:
            if (
                not has_global_reporting_scope(user)
                and not getattr(user, "tenant_id", None)
            ):
                raise NotFound("Building not found." if building_id else "Organization not found.")

        organization = _resolve_accessible_organization(user, organization_id)
        building = _resolve_accessible_building(user, building_id)

        if building is not None and organization is not None:
            if building.organization_id != organization.id:
                raise ValidationError(
                    {
                        "building": [
                            "Building must belong to the selected organization."
                        ]
                    }
                )

    return {
        "date_from": date_from,
        "date_to": date_to,
        "building_id": building.id if building is not None else building_id,
        "organization_id": (
            organization.id if organization is not None else organization_id
        ),
        "building": building,
        "organization": organization,
    }


def _apply_common_filters(queryset, filters, *, date_field):
    # Inclusive date bounds: date_from <= field <= date_to.
    queryset = queryset.filter(
        is_deleted=False,
        **{f"{date_field}__gte": filters["date_from"]},
        **{f"{date_field}__lte": filters["date_to"]},
    )
    if filters["building_id"]:
        queryset = queryset.filter(building_id=filters["building_id"])
    if filters["organization_id"]:
        queryset = queryset.filter(organization_id=filters["organization_id"])
    return queryset


def _status_counts(queryset, status_values):
    aggregates = {"total": Count("id")}
    for value in status_values:
        aggregates[value] = Count("id", filter=Q(status=value))
    return queryset.aggregate(**aggregates)


def _priority_counts(queryset, priority_values):
    aggregates = {}
    for value in priority_values:
        aggregates[value] = Count("id", filter=Q(priority=value))
    return queryset.aggregate(**aggregates)


def _decimal_to_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def build_ticket_summary(queryset, *, now):
    status_values = [choice.value for choice in FmTicket.Status]
    priority_values = [choice.value for choice in FmTicket.Priority]
    status_payload = _status_counts(queryset, status_values)
    priority_payload = _priority_counts(queryset, priority_values)

    overdue = queryset.filter(due_at__lt=now).exclude(
        status__in=(
            FmTicket.Status.RESOLVED,
            FmTicket.Status.CLOSED,
            FmTicket.Status.CANCELLED,
        )
    ).count()

    sla = queryset.aggregate(
        response_met_count=Count("id", filter=Q(response_met=True)),
        response_missed_count=Count("id", filter=Q(response_met=False)),
        resolution_met_count=Count("id", filter=Q(resolution_met=True)),
        resolution_missed_count=Count("id", filter=Q(resolution_met=False)),
        open_count=Count("id", filter=Q(status__in=TICKET_OPEN_STATUSES)),
    )

    by_status = {value: status_payload[value] for value in status_values}
    by_priority = {value: priority_payload[value] for value in priority_values}
    by_category = {
        row["category"]: row["count"]
        for row in (
            queryset.values("category")
            .annotate(count=Count("id"))
            .order_by("category")
        )
    }

    return {
        "total": status_payload["total"],
        "open": sla["open_count"],
        "overdue": overdue,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_category": by_category,
        "sla": {
            "response_met": sla["response_met_count"],
            "response_missed": sla["response_missed_count"],
            "resolution_met": sla["resolution_met_count"],
            "resolution_missed": sla["resolution_missed_count"],
        },
    }


def build_work_order_summary(queryset, *, now):
    status_values = [choice.value for choice in MaintenanceWorkOrder.Status]
    priority_values = [choice.value for choice in MaintenanceWorkOrder.Priority]
    status_payload = _status_counts(queryset, status_values)
    priority_payload = _priority_counts(queryset, priority_values)

    overdue = queryset.filter(due_at__lt=now).exclude(
        status__in=WORK_ORDER_TERMINAL_STATUSES
    ).count()

    linked = queryset.aggregate(
        linked_to_ticket=Count("id", filter=Q(source_ticket__isnull=False)),
        standalone=Count("id", filter=Q(source_ticket__isnull=True)),
    )

    return {
        "total": status_payload["total"],
        "overdue": overdue,
        "by_status": {value: status_payload[value] for value in status_values},
        "by_priority": {
            value: priority_payload[value] for value in priority_values
        },
        "linked_to_ticket": linked["linked_to_ticket"],
        "standalone": linked["standalone"],
    }


def build_inspection_summary(queryset):
    status_values = [choice.value for choice in Inspection.Status]
    status_payload = _status_counts(queryset, status_values)
    score_payload = queryset.exclude(score__isnull=True).aggregate(
        average_score=Avg("score"),
        scored_count=Count("id"),
    )

    return {
        "total": status_payload["total"],
        "by_status": {value: status_payload[value] for value in status_values},
        "average_score": _decimal_to_float(score_payload["average_score"]),
        "scored_count": score_payload["scored_count"],
    }


def build_operational_overview(user, query_params):
    """Return tenant-scoped cross-module operational aggregates.

    Aggregations are backend-authoritative. Callers must not trust frontend
    filter hints alone; every queryset is scoped before counting.
    """
    filters = resolve_reporting_filters(query_params, user=user)
    now = timezone.now()

    tickets = scope_queryset_to_user(FmTicket.objects.all(), user)
    tickets = _apply_common_filters(tickets, filters, date_field="reported_at")

    work_orders = scope_queryset_to_user(MaintenanceWorkOrder.objects.all(), user)
    work_orders = _apply_common_filters(
        work_orders, filters, date_field="requested_at"
    )

    inspections = scope_queryset_to_user(Inspection.objects.all(), user)
    inspections = _apply_common_filters(
        inspections, filters, date_field="scheduled_date"
    )

    return {
        "filters": {
            "date_from": filters["date_from"].isoformat(),
            "date_to": filters["date_to"].isoformat(),
            "building": (
                str(filters["building_id"]) if filters["building_id"] else None
            ),
            "organization": (
                str(filters["organization_id"])
                if filters["organization_id"]
                else None
            ),
        },
        "tickets": build_ticket_summary(tickets, now=now),
        "work_orders": build_work_order_summary(work_orders, now=now),
        "inspections": build_inspection_summary(inspections),
    }
