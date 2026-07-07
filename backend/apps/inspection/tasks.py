from celery import shared_task

from .models import Inspection
from .services.inspection_service import check_inspection_escalations


@shared_task(name="inspection.check_inspection_sla_breaches")
def check_inspection_sla_breaches():
    queryset = Inspection.objects.exclude(
        status__in=(
            Inspection.Status.VERIFIED,
            Inspection.Status.CANCELLED,
        )
    ).select_related("tenant", "sla_record")
    created_count = 0
    for inspection in queryset.iterator():
        created_count += len(check_inspection_escalations(inspection=inspection))
    return {"checked": queryset.count(), "escalations_created": created_count}

