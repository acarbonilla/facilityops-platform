"""FO-090 AI Attention Center — prioritized informational work queue.

Builds on FO-089 operational insights (which reuse FO-088 analytics).
Never mutates tickets, assignments, prompts, models, or decisions.
Human decision-making remains authoritative.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.fm_tickets.ai_operational_insights_service import (
    build_ai_operational_insights,
    get_insight_thresholds,
)

# ---------------------------------------------------------------------------
# Defaults (overridable via Django settings / env). Documented in FO-090.
# ---------------------------------------------------------------------------

DEFAULT_ATTENTION_WEIGHT_PENDING = 0.25
DEFAULT_ATTENTION_WEIGHT_OVERRIDE = 0.20
DEFAULT_ATTENTION_WEIGHT_HEALTH = 0.20
DEFAULT_ATTENTION_WEIGHT_TREND = 0.15
DEFAULT_ATTENTION_WEIGHT_CONFIDENCE = 0.10
DEFAULT_ATTENTION_WEIGHT_VOLUME = 0.10

DEFAULT_LEVEL_CRITICAL_MIN = 80
DEFAULT_LEVEL_HIGH_MIN = 60
DEFAULT_LEVEL_MEDIUM_MIN = 40

# Per-item base urgency by attention code (before clamps).
ITEM_BASE_URGENCY = {
    "large_pending_review_queue": 85,
    "long_unreviewed_ai_recommendations": 80,
    "low_ai_operational_health": 78,
    "high_override_rate": 75,
    "increasing_override_trend": 70,
    "decreasing_acceptance_trend": 68,
    "rapid_confidence_drop": 65,
    "repeated_category_corrections": 62,
    "repeated_priority_corrections": 60,
    "high_volume_critical_recommendations": 58,
}


def _setting_float(name: str, default: float) -> float:
    from apps.fm_tickets.ai_administration_service import get_runtime_setting

    value = get_runtime_setting(name, default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _setting_int(name: str, default: int) -> int:
    from apps.fm_tickets.ai_administration_service import get_runtime_setting

    value = get_runtime_setting(name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def get_attention_thresholds() -> dict[str, float | int]:
    """Resolve FO-090 attention scoring thresholds with documented defaults."""
    base = get_insight_thresholds()
    return {
        **base,
        "weight_pending": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_PENDING",
            DEFAULT_ATTENTION_WEIGHT_PENDING,
        ),
        "weight_override": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_OVERRIDE",
            DEFAULT_ATTENTION_WEIGHT_OVERRIDE,
        ),
        "weight_health": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_HEALTH",
            DEFAULT_ATTENTION_WEIGHT_HEALTH,
        ),
        "weight_trend": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_TREND",
            DEFAULT_ATTENTION_WEIGHT_TREND,
        ),
        "weight_confidence": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_CONFIDENCE",
            DEFAULT_ATTENTION_WEIGHT_CONFIDENCE,
        ),
        "weight_volume": _setting_float(
            "FACILITYOPS_AI_ATTENTION_WEIGHT_VOLUME",
            DEFAULT_ATTENTION_WEIGHT_VOLUME,
        ),
        "level_critical_min": _setting_int(
            "FACILITYOPS_AI_ATTENTION_CRITICAL_MIN",
            DEFAULT_LEVEL_CRITICAL_MIN,
        ),
        "level_high_min": _setting_int(
            "FACILITYOPS_AI_ATTENTION_HIGH_MIN",
            DEFAULT_LEVEL_HIGH_MIN,
        ),
        "level_medium_min": _setting_int(
            "FACILITYOPS_AI_ATTENTION_MEDIUM_MIN",
            DEFAULT_LEVEL_MEDIUM_MIN,
        ),
    }


def _attention_level(score: int, thresholds: dict[str, float | int]) -> dict[str, str]:
    critical = int(thresholds["level_critical_min"])
    high = int(thresholds["level_high_min"])
    medium = int(thresholds["level_medium_min"])
    if score >= critical:
        code = "critical"
        label = "Critical"
    elif score >= high:
        code = "high"
        label = "High"
    elif score >= medium:
        code = "medium"
        label = "Medium"
    else:
        code = "low"
        label = "Low"
    return {"code": code, "label": label}


def compute_overall_urgency(
    insights_payload: dict[str, Any],
    thresholds: dict[str, float | int] | None = None,
) -> dict[str, Any]:
    """Compute transparent overall Attention Urgency (0–100).

    Formula (weights normalized to sum 1.0; no hidden terms):

        urgency = round(
            W_p * pending_component
          + W_o * override_component
          + W_h * health_inverse_component
          + W_t * trend_component
          + W_c * confidence_component
          + W_v * volume_component
        )

    Components (each 0–100):
    - pending_component:
        min(100, pending_review_count / pending_threshold * 100)
        when recommendation_count > 0; else 0
    - override_component:
        modification_rate * 100 when reviewed_count > 0; else 0
    - health_inverse_component:
        100 - AI Operational Health score
    - trend_component:
        100 if override trend increasing OR acceptance decreasing;
        50 if either trend is non-stable; else 0
    - confidence_component:
        min(100, max(0, -confidence_delta)) when confidence decreasing
        (confidence is 0–100 scale); else 0
    - volume_component:
        min(100, recommendation_count / high_volume_count * 100)

    Default weights: 0.25 / 0.20 / 0.20 / 0.15 / 0.10 / 0.10.
    This is an informational management urgency score — not model accuracy.
    """
    thresholds = thresholds or get_attention_thresholds()
    summary = insights_payload.get("summary") or {}
    health = insights_payload.get("health_score") or {}
    trends = insights_payload.get("trend") or {}

    pending = int(summary.get("pending_review_count") or 0)
    pending_threshold = max(1, int(thresholds["pending_review_count"]))
    recommendation_count = int(summary.get("recommendation_count") or 0)
    if recommendation_count > 0:
        pending_component = min(100.0, (pending / pending_threshold) * 100.0)
    else:
        pending_component = 0.0

    reviewed = int(summary.get("reviewed_count") or 0)
    if reviewed > 0:
        override_component = float(summary.get("modification_rate") or 0.0) * 100.0
    else:
        override_component = 0.0

    health_score = int(health.get("score") if health.get("score") is not None else 50)
    health_inverse_component = max(0.0, min(100.0, 100.0 - health_score))

    override_dir = (trends.get("override") or {}).get("direction")
    acceptance_dir = (trends.get("acceptance") or {}).get("direction")
    if override_dir == "increasing" or acceptance_dir == "decreasing":
        trend_component = 100.0
    elif override_dir not in (None, "stable") or acceptance_dir not in (
        None,
        "stable",
    ):
        trend_component = 50.0
    else:
        trend_component = 0.0

    confidence_trend = trends.get("confidence") or {}
    confidence_delta = confidence_trend.get("delta")
    if confidence_trend.get("direction") == "decreasing" and confidence_delta is not None:
        confidence_component = min(100.0, max(0.0, -float(confidence_delta)))
    else:
        confidence_component = 0.0

    high_volume = max(1, int(thresholds["high_volume_count"]))
    volume_component = min(
        100.0, (recommendation_count / high_volume) * 100.0
    )

    weights = [
        float(thresholds["weight_pending"]),
        float(thresholds["weight_override"]),
        float(thresholds["weight_health"]),
        float(thresholds["weight_trend"]),
        float(thresholds["weight_confidence"]),
        float(thresholds["weight_volume"]),
    ]
    weight_sum = sum(weights) or 1.0
    weights = [w / weight_sum for w in weights]
    components = [
        pending_component,
        override_component,
        health_inverse_component,
        trend_component,
        confidence_component,
        volume_component,
    ]
    raw = sum(w * c for w, c in zip(weights, components, strict=True))
    score = int(round(max(0.0, min(100.0, raw))))
    level = _attention_level(score, thresholds)

    return {
        "score": score,
        "level": level,
        "components": {
            "pending": round(pending_component, 1),
            "override": round(override_component, 1),
            "health_inverse": round(health_inverse_component, 1),
            "trend": round(trend_component, 1),
            "confidence": round(confidence_component, 1),
            "volume": round(volume_component, 1),
        },
        "weights": {
            "pending": round(weights[0], 4),
            "override": round(weights[1], 4),
            "health_inverse": round(weights[2], 4),
            "trend": round(weights[3], 4),
            "confidence": round(weights[4], 4),
            "volume": round(weights[5], 4),
        },
        "interpretation": (
            "Attention Urgency is an informational management score based on "
            "pending reviews, override rate, inverse operational health, "
            "adverse trends, confidence drop, and recommendation volume. "
            "It is not model accuracy and does not trigger automation."
        ),
    }


def _suggested_action(code: str, context: dict[str, Any]) -> dict[str, Any]:
    mapping = {
        "high_override_rate": (
            "Investigate repeated overrides",
            "Review why recommendations are frequently modified before ticket creation.",
        ),
        "large_pending_review_queue": (
            "Review AI backlog",
            "Clear pending AI recommendation reviews for the selected period.",
        ),
        "long_unreviewed_ai_recommendations": (
            "Review AI backlog",
            "Prioritize long-unreviewed AI recommendations awaiting human decision.",
        ),
        "rapid_confidence_drop": (
            "Investigate confidence drop",
            "Review recent recommendation confidence trends and input quality guidance.",
        ),
        "repeated_category_corrections": (
            "Review category workflow",
            (
                f"Review {context.get('recommended', 'category')} category "
                "guidelines and correction patterns."
            ),
        ),
        "repeated_priority_corrections": (
            "Review priority guidance",
            (
                f"Review {context.get('recommended', 'priority')} priority "
                "guidance and correction patterns."
            ),
        ),
        "high_volume_critical_recommendations": (
            "Review high-volume recommendations",
            "Review elevated recommendation volume alongside override or health signals.",
        ),
        "low_ai_operational_health": (
            "Review operational health drivers",
            "Inspect acceptance, agreement, pending throughput, and confidence components.",
        ),
        "increasing_override_trend": (
            "Investigate increasing overrides",
            "Compare current override rate with the previous equivalent period.",
        ),
        "decreasing_acceptance_trend": (
            "Investigate decreasing acceptance",
            "Compare current acceptance rate with the previous equivalent period.",
        ),
    }
    title, message = mapping.get(
        code,
        (
            "Review AI attention item",
            "Review this informational attention item. No automatic action will run.",
        ),
    )
    return {
        "code": f"action_{code}",
        "title": title,
        "message": message,
        "actionable": False,
        "note": (
            "Informational only. FacilityOps does not auto-apply this suggestion."
        ),
    }


class AIAttentionCenterService:
    """Prioritize FO-089 insights into an informational attention queue."""

    def build(self, user, query_params) -> dict[str, Any]:
        thresholds = get_attention_thresholds()
        insights = build_ai_operational_insights(user, query_params)
        urgency = compute_overall_urgency(insights, thresholds)
        items = self._build_attention_items(insights, thresholds, urgency)
        items.sort(key=lambda row: (-row["urgency_score"], row["code"]))

        critical_items = [item for item in items if item["priority"]["code"] == "critical"]
        grouped = self._group_items(items)

        summary = insights["summary"]
        health = insights["health_score"]

        return {
            "period": insights["period"],
            "comparison_period": insights["comparison_period"],
            "filters": insights["filters"],
            "thresholds": {
                "pending_review_count": thresholds["pending_review_count"],
                "high_override_rate": thresholds["high_override_rate"],
                "low_acceptance_rate": thresholds["low_acceptance_rate"],
                "high_volume_count": thresholds["high_volume_count"],
                "health_needs_review_min": thresholds["health_needs_review_min"],
                "level_critical_min": thresholds["level_critical_min"],
                "level_high_min": thresholds["level_high_min"],
                "level_medium_min": thresholds["level_medium_min"],
            },
            "summary": {
                "attention_count": len(items),
                "critical_count": len(critical_items),
                "high_count": sum(
                    1 for item in items if item["priority"]["code"] == "high"
                ),
                "pending_review_count": summary["pending_review_count"],
                "recommendation_count": summary["recommendation_count"],
                "acceptance_rate": summary["acceptance_rate"],
                "modification_rate": summary["modification_rate"],
                "operational_health_score": health["score"],
                "operational_health_band": health["band"],
            },
            "urgency_score": urgency,
            "attention_items": items,
            "critical_items": critical_items,
            "groups": grouped,
            "trend": insights["trend"],
            "operational_health": {
                "score": health["score"],
                "band": health["band"],
                "label": health["label"],
                "components": health["components"],
            },
            "pending_review_summary": {
                "pending_review_count": summary["pending_review_count"],
                "recommendation_count": summary["recommendation_count"],
                "reviewed_count": summary["reviewed_count"],
            },
            "recent_review_activity": {
                "accepted_rate": summary["acceptance_rate"],
                "modification_rate": summary["modification_rate"],
                "ignore_rate": summary["ignore_rate"],
                "full_agreement_rate": summary["full_agreement_rate"],
                "note": (
                    "Aggregate review activity for the selected period. "
                    "Individual decision histories are not exposed."
                ),
            },
            "interpretation": {
                "note": (
                    "The AI Attention Center is an informational work queue. "
                    "It does not modify tickets, assignments, categories, "
                    "priorities, work orders, prompts, or models."
                ),
                "labels": {
                    "urgency": "Attention Urgency",
                    "health": "AI Operational Health",
                },
            },
            "generated_at": timezone.now().isoformat(),
        }

    def _build_attention_items(
        self,
        insights: dict[str, Any],
        thresholds: dict[str, float | int],
        overall: dict[str, Any],
    ) -> list[dict[str, Any]]:
        summary = insights["summary"]
        trends = insights["trend"]
        health = insights["health_score"]
        category_overrides = insights.get("category_overrides") or []
        priority_overrides = insights.get("priority_overrides") or []
        insight_codes = {item["code"] for item in insights.get("insights") or []}
        now = timezone.now().isoformat()
        items: list[dict[str, Any]] = []

        def add(
            code: str,
            category: str,
            title: str,
            message: str,
            *,
            urgency: int,
            context: dict[str, Any] | None = None,
            trend_direction: str | None = None,
        ):
            urgency = int(max(0, min(100, urgency)))
            priority = _attention_level(urgency, thresholds)
            action = _suggested_action(code, context or {})
            items.append(
                {
                    "code": code,
                    "category": category,
                    "title": title,
                    "message": message,
                    "urgency_score": urgency,
                    "priority": priority,
                    "trend": trend_direction,
                    "suggested_action": action,
                    "created_at": now,
                }
            )

        pending = int(summary["pending_review_count"] or 0)
        volume = int(summary["recommendation_count"] or 0)
        reviewed = int(summary.get("reviewed_count") or 0)
        override_rate = float(summary.get("modification_rate") or 0.0)
        acceptance_rate = float(summary.get("acceptance_rate") or 0.0)

        if volume == 0:
            return items

        if pending >= int(thresholds["pending_review_count"]):
            add(
                "large_pending_review_queue",
                "pending_review",
                "Large Pending Review Queue",
                (
                    f"{pending} recommendations are pending human review "
                    f"(threshold {int(thresholds['pending_review_count'])})."
                ),
                urgency=ITEM_BASE_URGENCY["large_pending_review_queue"]
                + min(15, pending),
            )
            add(
                "long_unreviewed_ai_recommendations",
                "pending_review",
                "Long-Unreviewed AI Recommendations",
                (
                    "A sustained pending review backlog requires manager "
                    "attention before decisions age further."
                ),
                urgency=ITEM_BASE_URGENCY["long_unreviewed_ai_recommendations"]
                + min(10, pending // 2),
            )

        if reviewed > 0 and override_rate >= float(thresholds["high_override_rate"]):
            add(
                "high_override_rate",
                "override",
                "High Override Rate",
                (
                    f"Modification (override) rate is {override_rate:.1%}, at or "
                    "above the configured threshold."
                ),
                urgency=ITEM_BASE_URGENCY["high_override_rate"]
                + int(min(15, override_rate * 20)),
            )

        if (trends.get("override") or {}).get("direction") == "increasing":
            add(
                "increasing_override_trend",
                "trend",
                "Increasing Override Trend",
                "Override rate increased versus the previous equivalent period.",
                urgency=ITEM_BASE_URGENCY["increasing_override_trend"],
                trend_direction="increasing",
            )

        if (trends.get("acceptance") or {}).get("direction") == "decreasing":
            add(
                "decreasing_acceptance_trend",
                "trend",
                "Decreasing Acceptance Trend",
                "Acceptance rate decreased versus the previous equivalent period.",
                urgency=ITEM_BASE_URGENCY["decreasing_acceptance_trend"],
                trend_direction="decreasing",
            )

        confidence_trend = trends.get("confidence") or {}
        if confidence_trend.get("direction") == "decreasing":
            delta = confidence_trend.get("delta")
            add(
                "rapid_confidence_drop",
                "confidence",
                "Rapid Confidence Drop",
                (
                    "Average recommendation confidence declined versus the "
                    "previous equivalent period"
                    + (
                        f" (delta {float(delta):+.1f})."
                        if delta is not None
                        else "."
                    )
                ),
                urgency=ITEM_BASE_URGENCY["rapid_confidence_drop"]
                + (
                    int(min(20, abs(float(delta))))
                    if delta is not None
                    else 0
                ),
                trend_direction="decreasing",
            )

        if category_overrides or "frequently_corrected_categories" in insight_codes:
            top = category_overrides[0] if category_overrides else None
            add(
                "repeated_category_corrections",
                "category_corrections",
                "Repeated Category Corrections",
                (
                    f"Most common category override: {top['recommended']} → "
                    f"{top['final']} ({top['count']} times)."
                    if top
                    else "Category recommendations are frequently corrected."
                ),
                urgency=ITEM_BASE_URGENCY["repeated_category_corrections"]
                + (min(15, int(top["count"]) * 3) if top else 0),
                context={"recommended": top["recommended"]} if top else None,
            )

        if priority_overrides or "frequently_corrected_priorities" in insight_codes:
            top = priority_overrides[0] if priority_overrides else None
            add(
                "repeated_priority_corrections",
                "priority_corrections",
                "Repeated Priority Corrections",
                (
                    f"Most common priority override: {top['recommended']} → "
                    f"{top['final']} ({top['count']} times)."
                    if top
                    else "Priority recommendations are frequently corrected."
                ),
                urgency=ITEM_BASE_URGENCY["repeated_priority_corrections"]
                + (min(15, int(top["count"]) * 3) if top else 0),
                context={"recommended": top["recommended"]} if top else None,
            )

        health_score = int(health.get("score") or 50)
        if health_score < int(thresholds["health_needs_review_min"]):
            add(
                "low_ai_operational_health",
                "operational_health",
                "Low AI Operational Health",
                (
                    f"AI Operational Health is {health_score} "
                    f"({health.get('label', 'Needs Review')})."
                ),
                urgency=ITEM_BASE_URGENCY["low_ai_operational_health"]
                + min(20, int(thresholds["health_needs_review_min"]) - health_score),
            )

        if volume >= int(thresholds["high_volume_count"]) and (
            override_rate >= float(thresholds["high_override_rate"])
            or health_score < int(thresholds["health_healthy_min"])
        ):
            add(
                "high_volume_critical_recommendations",
                "volume",
                "High Volume Critical Recommendations",
                (
                    f"{volume} recommendations completed this period alongside "
                    "elevated override or health risk signals."
                ),
                urgency=ITEM_BASE_URGENCY["high_volume_critical_recommendations"]
                + min(20, volume // 10),
            )

        # Tie-break nudge: if overall urgency is critical but queue empty of
        # matching rules, surface nothing — empty is valid.
        _ = overall
        _ = acceptance_rate
        return items

    def _group_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        order = [
            "pending_review",
            "override",
            "trend",
            "confidence",
            "category_corrections",
            "priority_corrections",
            "operational_health",
            "volume",
        ]
        labels = {
            "pending_review": "Pending Review",
            "override": "Overrides",
            "trend": "Trends",
            "confidence": "Confidence",
            "category_corrections": "Category Corrections",
            "priority_corrections": "Priority Corrections",
            "operational_health": "Operational Health",
            "volume": "Volume",
        }
        buckets: dict[str, list[dict[str, Any]]] = {key: [] for key in order}
        for item in items:
            buckets.setdefault(item["category"], []).append(item)
        grouped = []
        for key in order:
            if buckets.get(key):
                grouped.append(
                    {
                        "category": key,
                        "label": labels.get(key, key),
                        "count": len(buckets[key]),
                        "items": buckets[key],
                    }
                )
        for key, rows in buckets.items():
            if key not in order and rows:
                grouped.append(
                    {
                        "category": key,
                        "label": key.replace("_", " ").title(),
                        "count": len(rows),
                        "items": rows,
                    }
                )
        return grouped


def build_ai_attention_center(user, query_params) -> dict[str, Any]:
    """Public entry point for FO-090 AI Attention Center."""
    return AIAttentionCenterService().build(user, query_params)
