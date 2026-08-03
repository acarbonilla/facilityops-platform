"""FO-087 human-in-the-loop AI recommendation review (advisory only)."""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.fm_tickets.services import record_ticket_history

logger = logging.getLogger(__name__)

# Map FO-086 recommendation labels → FmTicket category/priority codes.
AI_CATEGORY_TO_TICKET = {
    "plumbing": FmTicket.Category.PLUMBING,
    "electrical": FmTicket.Category.ELECTRICAL,
    "hvac": FmTicket.Category.HVAC,
    "civil": FmTicket.Category.CIVIL,
    "safety": FmTicket.Category.SAFETY,
    "housekeeping": FmTicket.Category.CLEANING,
    "cleaning": FmTicket.Category.CLEANING,
    "security": FmTicket.Category.SECURITY,
    "carpentry": FmTicket.Category.OTHER,
    "pest control": FmTicket.Category.OTHER,
    "painting": FmTicket.Category.OTHER,
    "general maintenance": FmTicket.Category.OTHER,
    "unknown": FmTicket.Category.OTHER,
    "other": FmTicket.Category.OTHER,
}

AI_PRIORITY_TO_TICKET = {
    "low": FmTicket.Priority.LOW,
    "medium": FmTicket.Priority.MEDIUM,
    "high": FmTicket.Priority.HIGH,
    "critical": FmTicket.Priority.URGENT,
    "urgent": FmTicket.Priority.URGENT,
}


class AIRecommendationReviewError(Exception):
    """Base review error."""


class AIRecommendationReviewValidationError(AIRecommendationReviewError):
    """Invalid review request."""


def map_ai_category_to_ticket(value: str | None) -> str:
    if not value:
        return FmTicket.Category.OTHER
    return AI_CATEGORY_TO_TICKET.get(value.strip().lower(), FmTicket.Category.OTHER)


def map_ai_priority_to_ticket(value: str | None) -> str:
    if not value:
        return FmTicket.Priority.MEDIUM
    return AI_PRIORITY_TO_TICKET.get(value.strip().lower(), FmTicket.Priority.MEDIUM)


def _recommended_from_result(analysis: AITicketAnalysis) -> tuple[str, str]:
    payload = analysis.result_json if isinstance(analysis.result_json, dict) else {}
    category = payload.get("recommended_category")
    priority = payload.get("recommended_priority")
    return (
        category if isinstance(category, str) else "",
        priority if isinstance(priority, str) else "",
    )


def record_recommendation_decision(
    *,
    actor,
    ticket_id,
    analysis_id,
    decision: str,
    final_category: str | None = None,
    final_priority: str | None = None,
) -> AITicketAnalysis:
    """Persist human review outcome without mutating ticket category/priority."""
    if decision not in AITicketAnalysis.Decision.values:
        raise AIRecommendationReviewValidationError("Invalid recommendation decision.")

    with transaction.atomic():
        try:
            analysis = (
                AITicketAnalysis.objects.select_for_update()
                .select_related("ticket")
                .get(id=analysis_id, ticket_id=ticket_id, tenant_id=actor.tenant_id)
            )
        except AITicketAnalysis.DoesNotExist as exc:
            raise AIRecommendationReviewValidationError(
                "AI analysis was not found for this ticket."
            ) from exc

        if analysis.status != AITicketAnalysis.Status.COMPLETED:
            raise AIRecommendationReviewValidationError(
                "Only completed AI analyses can be reviewed."
            )

        recommended_category, recommended_priority = _recommended_from_result(analysis)

        if decision == AITicketAnalysis.Decision.IGNORED:
            resolved_category = ""
            resolved_priority = ""
        elif decision == AITicketAnalysis.Decision.ACCEPTED:
            resolved_category = map_ai_category_to_ticket(recommended_category)
            resolved_priority = map_ai_priority_to_ticket(recommended_priority)
        else:
            # modified — human-supplied ticket codes required
            if not final_category or not final_priority:
                raise AIRecommendationReviewValidationError(
                    "Modified decisions require final_category and final_priority."
                )
            if final_category not in FmTicket.Category.values:
                raise AIRecommendationReviewValidationError("Invalid final_category.")
            if final_priority not in FmTicket.Priority.values:
                raise AIRecommendationReviewValidationError("Invalid final_priority.")
            resolved_category = final_category
            resolved_priority = final_priority

        analysis.decision = decision
        analysis.decision_recommended_category = recommended_category
        analysis.decision_recommended_priority = recommended_priority
        analysis.final_category = resolved_category
        analysis.final_priority = resolved_priority
        analysis.decision_at = timezone.now()
        analysis.decision_by = actor
        analysis.updated_by = str(actor.id)
        analysis.save(
            update_fields=[
                "decision",
                "decision_recommended_category",
                "decision_recommended_priority",
                "final_category",
                "final_priority",
                "decision_at",
                "decision_by",
                "updated_by",
                "updated_at",
            ]
        )

        record_ticket_history(
            ticket=analysis.ticket,
            actor=actor,
            action=f"ai_recommendation_{decision}",
            description=(
                f"AI recommendation {decision}. "
                f"Recommended category={recommended_category or 'n/a'}, "
                f"priority={recommended_priority or 'n/a'}; "
                f"final category={resolved_category or 'n/a'}, "
                f"priority={resolved_priority or 'n/a'}."
            ),
            metadata={
                "analysis_id": str(analysis.id),
                "decision": decision,
                "recommended_category": recommended_category,
                "recommended_priority": recommended_priority,
                "final_category": resolved_category,
                "final_priority": resolved_priority,
            },
        )

    logger.info(
        "ai.recommendation_%s analysis_id=%s ticket_id=%s category=%s",
        decision,
        analysis.id,
        analysis.ticket_id,
        resolved_category or "n/a",
    )
    return analysis
