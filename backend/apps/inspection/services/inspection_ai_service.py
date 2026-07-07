from django.utils import timezone

from apps.inspection.models import InspectionAIAnalysis

from .inspection_history_service import record_history


def upsert_ai_analysis(
    *,
    inspection,
    actor=None,
    summary="",
    analysis="",
    recommendation_summary="",
    payload=None,
    model_name="manual",
    source_notes="",
):
    actor_id = str(actor.id) if actor else None
    ai_analysis, _ = InspectionAIAnalysis.objects.update_or_create(
        inspection=inspection,
        defaults={
            "summary": summary,
            "analysis": analysis,
            "recommendation_summary": recommendation_summary,
            "payload": payload or {},
            "model_name": model_name,
            "source_notes": source_notes,
            "generated_at": timezone.now(),
            "created_by": actor_id,
            "updated_by": actor_id,
        },
    )
    record_history(
        inspection=inspection,
        action="ai_analysis_updated",
        description="Inspection AI analysis was updated.",
        actor=actor,
        metadata={"ai_analysis_id": str(ai_analysis.id)},
    )
    return ai_analysis

