from django.utils import timezone

from apps.inspection.models import InspectionAIAnalysis

from .inspection_history_service import record_history


def build_inspection_ai_context(*, inspection):
    checklist_items = list(inspection.items.order_by("sequence"))
    findings = list(inspection.findings.filter(is_deleted=False).order_by("-created_at"))
    corrective_actions = list(
        inspection.corrective_actions.filter(is_deleted=False).order_by("-created_at")
    )

    return {
        "inspection": {
            "id": str(inspection.id),
            "inspection_number": inspection.inspection_number,
            "title": inspection.title,
            "inspection_type": inspection.inspection_type,
            "five_s_category": inspection.five_s_category,
            "priority": inspection.priority,
            "status": inspection.status,
            "scheduled_date": inspection.scheduled_date.isoformat()
            if inspection.scheduled_date
            else None,
            "started_date": inspection.started_date.isoformat()
            if inspection.started_date
            else None,
            "completed_date": inspection.completed_date.isoformat()
            if inspection.completed_date
            else None,
            "verified_date": inspection.verified_date.isoformat()
            if inspection.verified_date
            else None,
            "score": str(inspection.score) if inspection.score is not None else None,
            "remarks": inspection.remarks,
        },
        "location": {
            "tenant_name": inspection.tenant.name if inspection.tenant_id else None,
            "organization_name": inspection.organization.name
            if inspection.organization_id
            else None,
            "department_name": inspection.department.name if inspection.department_id else None,
            "building_name": inspection.building.name if inspection.building_id else None,
            "floor_name": inspection.floor.name if inspection.floor_id else None,
            "area_name": inspection.area.name if inspection.area_id else None,
        },
        "checklist": [
            {
                "sequence": item.sequence,
                "checklist_item": item.checklist_item,
                "category": item.category,
                "expected_result": item.expected_result,
                "max_score": str(item.max_score),
                "score": str(item.score) if item.score is not None else None,
                "is_pass": item.is_pass,
                "observation": item.observation,
                "notes": item.notes,
            }
            for item in checklist_items
        ],
        "findings": [
            {
                "finding_type": finding.finding_type,
                "severity": finding.severity,
                "description": finding.description,
                "root_cause": finding.root_cause,
                "recommendation": finding.recommendation,
                "status": finding.status,
            }
            for finding in findings
        ],
        "corrective_actions": [
            {
                "due_date": action.due_date.isoformat() if action.due_date else None,
                "status": action.status,
                "verification_status": action.verification_status,
                "notes": action.notes,
            }
            for action in corrective_actions
        ],
        "summary_counts": {
            "checklist_item_count": len(checklist_items),
            "failed_item_count": sum(1 for item in checklist_items if item.is_pass is False),
            "finding_count": len(findings),
            "open_corrective_action_count": sum(
                1
                for action in corrective_actions
                if action.status
                in {
                    action.Status.OPEN,
                    action.Status.IN_PROGRESS,
                    action.Status.OVERDUE,
                }
            ),
        },
    }


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
    normalized_model_name = (model_name or "").strip() or "manual"
    ai_analysis, _ = InspectionAIAnalysis.objects.update_or_create(
        inspection=inspection,
        defaults={
            "summary": summary,
            "analysis": analysis,
            "recommendation_summary": recommendation_summary,
            "payload": payload or {},
            "model_name": normalized_model_name,
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
