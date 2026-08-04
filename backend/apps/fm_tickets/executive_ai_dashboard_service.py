"""FO-092 Executive AI Dashboard — orchestrates FO-088–090 into one view.

Reuses existing analytics / operational insights / attention center builders.
Does not duplicate rate math. Does not call Gemini. Does not mutate tickets.

FO-091 search-usage metrics are not persisted; knowledge_summary is deferred.
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from apps.fm_tickets.ai_analytics_service import build_ai_recommendation_analytics
from apps.fm_tickets.ai_attention_center_service import build_ai_attention_center
from apps.fm_tickets.ai_operational_insights_service import (
    build_ai_operational_insights,
)

# Stable classification tolerance for rate deltas (matches FO-089 default).
TREND_STABLE_DELTA = 0.05
CONFIDENCE_STABLE_DELTA = 2.0
COUNT_STABLE_DELTA = 0

ALGORITHM_NOTE = (
    "FO-092 orchestrates FO-088 analytics, FO-089 operational insights "
    "(via FO-090), and FO-090 attention center. Knowledge-base search usage "
    "is deferred until FO-091 persists usage telemetry."
)


def _rate(value) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _classify_delta(current, previous, *, tolerance=TREND_STABLE_DELTA) -> str:
    if current is None or previous is None:
        return "stable"
    try:
        cur = float(current)
        prev = float(previous)
    except (TypeError, ValueError):
        return "stable"
    delta = cur - prev
    if abs(delta) <= tolerance:
        return "stable"
    return "increase" if delta > 0 else "decrease"


def _trend_entry(current, previous, *, tolerance=TREND_STABLE_DELTA) -> dict[str, Any]:
    direction = _classify_delta(current, previous, tolerance=tolerance)
    label = {
        "increase": "Increasing",
        "decrease": "Decreasing",
        "stable": "Stable",
    }.get(direction, "Stable")
    delta = None
    if current is not None and previous is not None:
        try:
            delta = round(float(current) - float(previous), 4)
        except (TypeError, ValueError):
            delta = None
    return {
        "direction": direction,
        "label": label,
        "current": current,
        "previous": previous,
        "delta": delta,
    }


def _build_executive_summary(
    *,
    analytics_summary: dict[str, Any],
    health: dict[str, Any],
    urgency: dict[str, Any],
    period_comparison: dict[str, Any],
    attention_summary: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic rule-based executive summary (no generative AI)."""
    acceptance = _rate(analytics_summary.get("acceptance_rate"))
    override = _rate(analytics_summary.get("modification_rate"))
    pending = _int(analytics_summary.get("pending_review_count"))
    volume = _int(analytics_summary.get("recommendation_count"))
    health_band = (health.get("band") or "").strip().lower()
    health_score = _int(health.get("score"))
    urgency_score = _int(urgency.get("score"))
    urgency_level = ((urgency.get("level") or {}).get("code") or "").lower()
    critical_count = _int(attention_summary.get("critical_count"))

    acceptance_trend = (
        period_comparison.get("acceptance_rate") or {}
    ).get("direction", "stable")
    override_trend = (
        period_comparison.get("modification_rate") or {}
    ).get("direction", "stable")
    pending_trend = (
        period_comparison.get("pending_review_count") or {}
    ).get("direction", "stable")

    details: list[str] = []
    status = "stable"
    headline = (
        "AI recommendation workflows are stable for the selected period."
    )

    if volume == 0:
        return {
            "status": "stable",
            "label": "Stable",
            "headline": (
                "No eligible AI recommendation data is available for this period."
            ),
            "details": [
                "Completed FacilityRecommendationV1 analyses are required before "
                "executive KPIs can be summarized."
            ],
            "positive_trend": None,
            "primary_concern": None,
            "recommended_review_area": None,
        }

    needs_attention = (
        health_band == "attention"
        or urgency_level == "critical"
        or urgency_score >= 80
        or critical_count > 0
        or (pending >= 10 and pending_trend == "increase")
        or (override >= 0.40 and override_trend != "decrease")
        or acceptance < 0.35
    )
    healthy = (
        health_band == "healthy"
        and urgency_score < 60
        and acceptance >= 0.55
        and critical_count == 0
        and pending < 10
    )

    if needs_attention:
        status = "needs_attention"
        headline = (
            "AI recommendation workflows need management attention during "
            "the selected period."
        )
    elif healthy and acceptance_trend in {"increase", "stable"}:
        status = "healthy"
        headline = (
            "AI recommendation adoption and operational health are within "
            "healthy management ranges."
        )
    else:
        status = "stable"
        headline = (
            "AI recommendation workflows are stable with mixed signals that "
            "warrant routine review."
        )

    if acceptance_trend == "increase":
        details.append(
            f"Recommendation acceptance is increasing "
            f"(current {acceptance:.1%})."
        )
        positive = "Acceptance rate is improving versus the prior period."
    elif acceptance >= 0.60:
        details.append(
            f"Recommendation acceptance remains solid at {acceptance:.1%}."
        )
        positive = "Acceptance rate remains at a solid management level."
    else:
        positive = None
        details.append(
            f"Recommendation acceptance is currently {acceptance:.1%}."
        )

    primary_concern = None
    recommended_review = None
    if critical_count > 0 or urgency_score >= 80:
        primary_concern = (
            f"Attention urgency is elevated "
            f"(score {urgency_score}; {critical_count} critical item(s))."
        )
        recommended_review = "Review AI Attention Center critical items."
        details.append(primary_concern)
    elif override >= 0.30:
        primary_concern = (
            f"Human override (modification) rate is elevated at {override:.1%}."
        )
        recommended_review = "Inspect top category and priority override patterns."
        details.append(primary_concern)
    elif pending >= 5:
        primary_concern = (
            f"Pending human review backlog is {pending} recommendation(s)."
        )
        recommended_review = "Work through the pending AI recommendation queue."
        details.append(primary_concern)
    elif health_band in {"needs_review", "attention"}:
        primary_concern = (
            f"AI Operational Health is {health.get('label') or health_band} "
            f"(score {health_score})."
        )
        recommended_review = "Review operational health components and recent trends."
        details.append(primary_concern)

    if override_trend == "increase":
        details.append("Override rate is increasing versus the prior period.")
    if pending_trend == "decrease" and pending > 0:
        details.append("Pending review backlog is decreasing.")

    details.append(
        "Metrics describe recommendation adoption and review outcomes, "
        "not objective model accuracy or employee performance."
    )

    status_labels = {
        "healthy": "Healthy",
        "stable": "Stable",
        "needs_attention": "Needs Attention",
    }
    return {
        "status": status,
        "label": status_labels[status],
        "headline": headline,
        "details": details,
        "positive_trend": positive,
        "primary_concern": primary_concern,
        "recommended_review_area": recommended_review,
    }


def _period_comparison(
    analytics: dict[str, Any],
    attention: dict[str, Any],
    ops: dict[str, Any],
) -> dict[str, Any]:
    """Build comparison using FO-089 trends/comparison + FO-088 current rates."""
    trends = ops.get("trend") or attention.get("trend") or {}
    comparison = ops.get("comparison") or {}
    cur = comparison.get("current") or {}
    prev = comparison.get("previous") or {}
    summary = analytics.get("summary") or {}
    ops_health = (
        ops.get("health_score")
        or attention.get("operational_health")
        or {}
    )

    def from_trend(key: str, current_fallback=None, *, tolerance=TREND_STABLE_DELTA):
        item = trends.get(key) or {}
        return _trend_entry(
            item.get("current", current_fallback),
            item.get("previous"),
            tolerance=tolerance,
        )

    return {
        "recommendation_volume": from_trend(
            "volume", summary.get("recommendation_count"), tolerance=0.0
        ),
        "acceptance_rate": from_trend(
            "acceptance", summary.get("acceptance_rate")
        ),
        "modification_rate": from_trend(
            "override", summary.get("modification_rate")
        ),
        "ignore_rate": _trend_entry(
            summary.get("ignore_rate"),
            None,
            tolerance=TREND_STABLE_DELTA,
        ),
        "category_agreement_rate": _trend_entry(
            summary.get("category_agreement_rate"),
            None,
            tolerance=TREND_STABLE_DELTA,
        ),
        "priority_agreement_rate": _trend_entry(
            summary.get("priority_agreement_rate"),
            None,
            tolerance=TREND_STABLE_DELTA,
        ),
        "full_agreement_rate": from_trend(
            "agreement", summary.get("full_agreement_rate")
        ),
        "average_confidence": from_trend(
            "confidence",
            summary.get("average_confidence"),
            tolerance=CONFIDENCE_STABLE_DELTA,
        ),
        "operational_health_score": _trend_entry(
            ops_health.get("score"),
            None,
            tolerance=5.0,
        ),
        "attention_urgency_score": _trend_entry(
            (attention.get("urgency_score") or {}).get("score"),
            None,
            tolerance=5.0,
        ),
        "pending_review_count": _trend_entry(
            cur.get("pending_review_count", summary.get("pending_review_count")),
            prev.get("pending_review_count"),
            tolerance=0.0,
        ),
        "stable_tolerance": {
            "rate": TREND_STABLE_DELTA,
            "confidence": CONFIDENCE_STABLE_DELTA,
            "note": (
                "Rate deltas within ±0.05 are Stable; confidence deltas within "
                "±2.0 are Stable; count deltas of 0 are Stable. "
                "ignore/category/priority agreement previous values are current-only "
                "when FO-089 comparison does not expose them."
            ),
        },
    }


class ExecutiveAIDashboardService:
    """Assemble an executive dashboard payload from existing AI reporting services."""

    def build(self, user, query_params) -> dict[str, Any]:
        # Orchestrate existing services (no duplicated rate math).
        # Query note: FO-090 internally reruns FO-089→FO-088; FO-092 also calls
        # FO-089 and FO-088 once for fields FO-090 does not fully echo.
        ops = build_ai_operational_insights(user, query_params)
        attention = build_ai_attention_center(user, query_params)
        analytics = build_ai_recommendation_analytics(user, query_params)

        a_summary = analytics.get("summary") or {}
        t_summary = attention.get("summary") or {}
        health = ops.get("health_score") or attention.get("operational_health") or {}
        urgency = attention.get("urgency_score") or {}
        pending = attention.get("pending_review_summary") or {}

        period_comparison = _period_comparison(analytics, attention, ops)

        attention_summary = {
            "attention_count": _int(t_summary.get("attention_count")),
            "critical_count": _int(t_summary.get("critical_count")),
            "high_count": _int(t_summary.get("high_count")),
            "pending_review_count": _int(
                pending.get("pending_review_count")
                or t_summary.get("pending_review_count")
            ),
            "urgency_score": _int(urgency.get("score")),
            "urgency_level": (urgency.get("level") or {}),
            "top_attention_items": [
                {
                    "code": item.get("code"),
                    "title": item.get("title"),
                    "message": item.get("message"),
                    "urgency_score": item.get("urgency_score"),
                    "priority": item.get("priority"),
                    "suggested_action": {
                        "title": (item.get("suggested_action") or {}).get("title"),
                        "message": (item.get("suggested_action") or {}).get(
                            "message"
                        ),
                        "actionable": False,
                    },
                }
                for item in (
                    attention.get("critical_items")
                    or attention.get("attention_items")
                    or []
                )[:5]
            ],
            "suggested_actions": [
                {
                    "title": (item.get("suggested_action") or {}).get("title"),
                    "message": (item.get("suggested_action") or {}).get("message"),
                    "actionable": False,
                }
                for item in (attention.get("attention_items") or [])[:5]
                if item.get("suggested_action")
            ],
        }

        summary = {
            "completed_analyses": _int(a_summary.get("recommendation_count")),
            "recommendations_generated": _int(a_summary.get("recommendation_count")),
            "reviewed_count": _int(a_summary.get("reviewed_count")),
            "pending_review_count": _int(a_summary.get("pending_review_count")),
            "accepted_count": _int(a_summary.get("accepted_count")),
            "modified_count": _int(a_summary.get("modified_count")),
            "ignored_count": _int(a_summary.get("ignored_count")),
            "acceptance_rate": _rate(a_summary.get("acceptance_rate")),
            "modification_rate": _rate(a_summary.get("modification_rate")),
            "ignore_rate": _rate(a_summary.get("ignore_rate")),
            "override_rate": _rate(a_summary.get("modification_rate")),
            "category_agreement_rate": _rate(
                a_summary.get("category_agreement_rate")
            ),
            "priority_agreement_rate": _rate(
                a_summary.get("priority_agreement_rate")
            ),
            "full_agreement_rate": _rate(a_summary.get("full_agreement_rate")),
            "average_confidence": a_summary.get("average_confidence"),
            "operational_health_score": _int(health.get("score")),
            "operational_health_band": health.get("band"),
            "operational_health_label": health.get("label"),
            "attention_urgency_score": _int(urgency.get("score")),
            "attention_urgency_level": (urgency.get("level") or {}).get("code"),
            "attention_urgency_label": (urgency.get("level") or {}).get("label"),
            "critical_attention_count": _int(t_summary.get("critical_count")),
            "high_attention_count": _int(t_summary.get("high_count")),
        }

        executive_summary = _build_executive_summary(
            analytics_summary=a_summary,
            health=health,
            urgency=urgency,
            period_comparison=period_comparison,
            attention_summary=attention_summary,
        )

        comparison_period = (
            ops.get("comparison_period")
            or attention.get("comparison_period")
            or {}
        )
        period = analytics.get("period") or ops.get("period") or {}

        knowledge_summary = {
            "status": "deferred",
            "available": False,
            "reason": (
                "FO-091 does not persist similar-case search usage. "
                "Knowledge-reuse analytics are deferred until a usage log exists."
            ),
            "endpoint": "/api/reporting/ai-similar-cases/",
            "algorithm": {
                "version": "rule_v1",
                "name": "weighted_rule_similarity",
            },
            "corpus_signals": {
                "recommendation_count": summary["recommendations_generated"],
                "reviewed_count": summary["reviewed_count"],
                "note": (
                    "Corpus size proxies from FO-088 for the same period only; "
                    "not search-usage counts."
                ),
            },
            "search_usage": None,
            "source_distribution": None,
            "advisory_note": (
                "Historical similar cases remain advisory and never modify "
                "current tickets."
            ),
        }

        operational_insights = [
            {
                "code": item.get("code"),
                "severity": item.get("severity"),
                "title": item.get("title"),
                "message": item.get("message"),
            }
            for item in (ops.get("insights") or [])[:8]
        ]

        return {
            "period": {
                "start_date": period.get("start_date"),
                "end_date": period.get("end_date"),
                "preset": period.get("preset"),
                "inclusive": period.get("inclusive", True),
                "max_range_days": period.get("max_range_days", 180),
                "previous_start_date": comparison_period.get("start_date"),
                "previous_end_date": comparison_period.get("end_date"),
            },
            "filters": analytics.get("filters") or ops.get("filters") or {},
            "summary": summary,
            "executive_summary": executive_summary,
            "period_comparison": period_comparison,
            "decision_distribution": analytics.get("decision_distribution") or [],
            "decision_trend": analytics.get("decision_trend") or [],
            "confidence_by_decision": analytics.get("confidence_by_decision") or [],
            "confidence_bands": analytics.get("confidence_bands") or [],
            "top_category_overrides": (analytics.get("category_overrides") or [])[:5],
            "top_priority_overrides": (analytics.get("priority_overrides") or [])[:5],
            "attention_summary": attention_summary,
            "operational_health": {
                "score": health.get("score"),
                "band": health.get("band"),
                "label": health.get("label"),
                "components": health.get("components") or {},
            },
            "operational_insights": operational_insights,
            "knowledge_summary": knowledge_summary,
            "interpretation": {
                "note": (
                    "The Executive AI Dashboard is informational decision support. "
                    "It reports recommendation adoption and review outcomes, not "
                    "objective accuracy, employee performance, or safety compliance. "
                    "It never modifies tickets, assignments, prompts, or models. "
                    + ALGORITHM_NOTE
                ),
                "labels": {
                    "health": "AI Operational Health",
                    "urgency": "Attention Urgency",
                    "acceptance": "Recommendation Adoption",
                    "override": "Human Override Rate",
                    "agreement": "AI Recommendation Agreement",
                },
            },
            "generated_at": timezone.localtime().isoformat(),
        }


def build_executive_ai_dashboard(user, query_params) -> dict[str, Any]:
    return ExecutiveAIDashboardService().build(user, query_params)
