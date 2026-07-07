from celery import shared_task

from .models import MaintenanceWorkOrder
from .work_order_escalation_service import check_work_order_escalations


@shared_task(name="maintenance.check_maintenance_sla_breaches")
def check_maintenance_sla_breaches():
    queryset = MaintenanceWorkOrder.objects.exclude(
        status__in=(
            MaintenanceWorkOrder.Status.COMPLETED,
            MaintenanceWorkOrder.Status.CANCELLED,
            MaintenanceWorkOrder.Status.CLOSED,
        )
    ).select_related("tenant", "assignee", "sla_record")
    created_count = 0
    for work_order in queryset.iterator():
        created_count += len(check_work_order_escalations(work_order=work_order))
    return {"checked": queryset.count(), "escalations_created": created_count}
