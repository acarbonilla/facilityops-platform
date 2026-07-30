from celery import shared_task
from django.conf import settings

from .ai_processing_service import RetryableAIProcessing, process_ticket_ai_analysis
from .auto_closure import process_automatic_ticket_closures


@shared_task(name="fm_tickets.process_automatic_ticket_closures")
def process_automatic_ticket_closures_task():
    """Hourly FO-063 processor for resolved tickets past the acknowledgement period."""
    if not getattr(settings, "FM_TICKET_AUTO_CLOSE_ENABLED", True):
        return {
            "examined": 0,
            "closed": 0,
            "skipped": 0,
            "failed": 0,
            "disabled": True,
        }
    return process_automatic_ticket_closures()


@shared_task(
    bind=True,
    name="fm_tickets.process_fm_ticket_ai_analysis",
    autoretry_for=(RetryableAIProcessing,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=2,
)
def process_fm_ticket_ai_analysis(self, analysis_id: str):
    """FO-084/085 background worker: queued → processing → completed/failed."""
    attempt = (getattr(self.request, "retries", 0) or 0) + 1
    return process_ticket_ai_analysis(analysis_id, attempt=attempt)
