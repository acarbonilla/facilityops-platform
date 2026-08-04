"""FO-089 rule-based AI operational insights (informational only).

Transforms FO-088 recommendation analytics into management insights,
trend comparisons, recommendations, and an AI Operational Health score.

Never retrains models, mutates prompts/tickets, or executes workflow changes.
Human decision-making remains authoritative.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.fm_tickets.ai_analytics_service import (
    MAX_DATE_RANGE_DAYS,
    AIRecommendationAnalyticsService,
    build_ai_recommendation_analytics,
)

# ---------------------------------------------------------------------------
# Defaults (overridable via Django settings / env). Documented in FO-089.
# ---------------------------------------------------------------------------

DEFAULT_HIGH_OVERRIDE_RATE = 0.40
DEFAULT_LOW_ACCEPTANCE_RATE = 0.40
DEFAULT_HIGH_ACCEPTANCE_RATE = 0.70
DEFAULT_PENDING_REVIEW_COUNT = 10
DEFAULT_LOW_CONFIDENCE = 50.0
DEFAULT_HIGH_CONFIDENCE = 75.0
DEFAULT_HIGH_VOLUME_COUNT = 50
DEFAULT_LOW_VOLUME_COUNT = 5
DEFAULT_TREND_STABLE_DELTA = 0.05
DEFAULT_HEALTH_HEALTHY_MIN = 75
DEFAULT_HEALTH_NEEDS_REVIEW_MIN = 50
DEFAULT_WEIGHT_ACCEPTANCE = 0.30
DEFAULT_WEIGHT_AGREEMENT = 0.30
DEFAULT_WEIGHT_PENDING = 0.20
DEFAULT_WEIGHT_CONFIDENCE = 0.20
DEFAULT_NEUTRAL_COMPONENT = 50.0


def _setting_float(name: str, default: float) -> float:
    value = getattr(settings, name, default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _setting_int(name: str, default: int) -> int:
    value = getattr(settings, name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def get_insight_thresholds() -> dict[str, float | int]:
    """Resolve configurable insight thresholds with documented defaults."""
    return {
        "high_override_rate": _setting_float(
            "FACILITYOPS_AI_HIGH_OVERRIDE_RATE", DEFAULT_HIGH_OVERRIDE_RATE
        ),
        "low_acceptance_rate": _setting_float(
            "FACILITYOPS_AI_LOW_ACCEPTANCE_RATE", DEFAULT_LOW_ACCEPTANCE_RATE
        ),
        "high_acceptance_rate": _setting_float(
            "FACILITYOPS_AI_HIGH_ACCEPTANCE_RATE", DEFAULT_HIGH_ACCEPTANCE_RATE
        ),
        "pending_review_count": _setting_int(
            "FACILITYOPS_AI_PENDING_REVIEW_COUNT", DEFAULT_PENDING_REVIEW_COUNT
        ),
        "low_confidence": _setting_float(
            "FACILITYOPS_AI_LOW_CONFIDENCE_THRESHOLD", DEFAULT_LOW_CONFIDENCE
        ),
        "high_confidence": _setting_float(
            "FACILITYOPS_AI_HIGH_CONFIDENCE_THRESHOLD", DEFAULT_HIGH_CONFIDENCE
        ),
        "high_volume_count": _setting_int(
            "FACILITYOPS_AI_HIGH_VOLUME_COUNT", DEFAULT_HIGH_VOLUME_COUNT
        ),
        "low_volume_count": _setting_int(
            "FACILITYOPS_AI_LOW_VOLUME_COUNT", DEFAULT_LOW_VOLUME_COUNT
        ),
        "trend_stable_delta": _setting_float(
            "FACILITYOPS_AI_TREND_STABLE_DELTA", DEFAULT_TREND_STABLE_DELTA
        ),
        "health_healthy_min": _setting_int(
            "FACILITYOPS_AI_HEALTH_HEALTHY_MIN", DEFAULT_HEALTH_HEALTHY_MIN
        ),
        "health_needs_review_min": _setting_int(
            "FACILITYOPS_AI_HEALTH_NEEDS_REVIEW_MIN",
            DEFAULT_HEALTH_NEEDS_REVIEW_MIN,
        ),
        "weight_acceptance": _setting_float(
            "FACILITYOPS_AI_HEALTH_WEIGHT_ACCEPTANCE", DEFAULT_WEIGHT_ACCEPTANCE
        ),
        "weight_agreement": _setting_float(
            "FACILITYOPS_AI_HEALTH_WEIGHT_AGREEMENT", DEFAULT_WEIGHT_AGREEMENT
        ),
        "weight_pending": _setting_float(
            "FACILITYOPS_AI_HEALTH_WEIGHT_PENDING", DEFAULT_WEIGHT_PENDING
        ),
        "weight_confidence": _setting_float(
            "FACILITYOPS_AI_HEALTH_WEIGHT_CONFIDENCE", DEFAULT_WEIGHT_CONFIDENCE
        ),
    }


def _classify_trend(
    current: float | None,
    previous: float | None,
    stable_delta: float,
) -> str:
    """Return increasing | stable | decreasing for comparable numeric metrics."""
    if current is None or previous is None:
        return "stable"
    delta = current - previous
    if abs(delta) <= stable_delta:
        return "stable"
    return "increasing" if delta > 0 else "decreasing"


def _health_band(score: int | None, thresholds: dict[str, float | int]) -> str:
    if score is None:
        return "needs_review"
    healthy_min = int(thresholds["health_healthy_min"])
    needs_min = int(thresholds["health_needs_review_min"])
    if score >= healthy_min:
        return "healthy"
    if score >= needs_min:
        return "needs_review"
    return "attention"


def compute_operational_health(
    summary: dict[str, Any],
    thresholds: dict[str, float | int] | None = None,
) -> dict[str, Any]:
    """Compute informational AI Operational Health (0–100).

    Formula (explicit weights, no hidden terms):

        score = round(
            W_a * acceptance_component
          + W_g * agreement_component
          + W_p * pending_component
          + W_c * confidence_component
        )

    Components (each 0–100):
    - acceptance_component = acceptance_rate * 100
      when reviewed_count > 0; else NEUTRAL (50)
    - agreement_component = full_agreement_rate * 100
      when full_agreement_sample_size > 0; else NEUTRAL (50)
    - pending_component = 100 * (1 - pending_ratio)
      pending_ratio = pending_review_count / recommendation_count
      when recommendation_count > 0; else NEUTRAL (50)
    - confidence_component = average_confidence
      when average_confidence is not null; else NEUTRAL (50)

    Default weights: 0.30 / 0.30 / 0.20 / 0.20 (configurable). Weights are
    normalized to sum to 1.0 before scoring. This is NOT model accuracy.
    """
    thresholds = thresholds or get_insight_thresholds()
    neutral = DEFAULT_NEUTRAL_COMPONENT

    reviewed = int(summary.get("reviewed_count") or 0)
    acceptance_rate = float(summary.get("acceptance_rate") or 0.0)
    if reviewed > 0:
        acceptance_component = acceptance_rate * 100.0
    else:
        acceptance_component = neutral

    agreement_sample = int(summary.get("full_agreement_sample_size") or 0)
    full_agreement = float(summary.get("full_agreement_rate") or 0.0)
    if agreement_sample > 0:
        agreement_component = full_agreement * 100.0
    else:
        agreement_component = neutral

    recommendation_count = int(summary.get("recommendation_count") or 0)
    pending = int(summary.get("pending_review_count") or 0)
    if recommendation_count > 0:
        pending_ratio = pending / recommendation_count
        pending_component = max(0.0, min(100.0, 100.0 * (1.0 - pending_ratio)))
    else:
        pending_component = neutral

    avg_confidence = summary.get("average_confidence")
    if avg_confidence is None:
        confidence_component = neutral
    else:
        confidence_component = max(0.0, min(100.0, float(avg_confidence)))

    weights = [
        float(thresholds["weight_acceptance"]),
        float(thresholds["weight_agreement"]),
        float(thresholds["weight_pending"]),
        float(thresholds["weight_confidence"]),
    ]
    weight_sum = sum(weights) or 1.0
    weights = [w / weight_sum for w in weights]

    components = [
        acceptance_component,
        agreement_component,
        pending_component,
        confidence_component,
    ]
    raw = sum(w * c for w, c in zip(weights, components, strict=True))
    score = int(round(max(0.0, min(100.0, raw))))
    band = _health_band(score, thresholds)

    return {
        "score": score,
        "band": band,
        "label": {
            "healthy": "Healthy",
            "needs_review": "Needs Review",
            "attention": "Attention",
        }.get(band, "Needs Review"),
        "components": {
            "acceptance": round(acceptance_component, 1),
            "agreement": round(agreement_component, 1),
            "pending_throughput": round(pending_component, 1),
            "confidence": round(confidence_component, 1),
        },
        "weights": {
            "acceptance": round(weights[0], 4),
            "agreement": round(weights[1], 4),
            "pending_throughput": round(weights[2], 4),
            "confidence": round(weights[3], 4),
        },
        "interpretation": (
            "AI Operational Health is an informational workflow score based on "
            "acceptance, full recommendation agreement, pending-review "
            "throughput, and average confidence. It is not model accuracy."
        ),
    }


def _previous_period_bounds(start: datetime, end: datetime) -> tuple[datetime, datetime]:
    """Mirror the current inclusive span immediately before the current start."""
    tz = timezone.get_current_timezone()
    start_day = timezone.localtime(start, tz).date()
    end_day = timezone.localtime(end, tz).date()
    span_days = (end_day - start_day).days
    prev_end_day = start_day - timedelta(days=1)
    prev_start_day = prev_end_day - timedelta(days=span_days)
    prev_start = datetime.combine(prev_start_day, time.min, tzinfo=tz)
    prev_end = datetime.combine(prev_end_day, time.max, tzinfo=tz)
    return prev_start, prev_end


def _trend_badge(direction: str) -> dict[str, str]:
    mapping = {
        "increasing": ("improving", "Improving"),
        "decreasing": ("declining", "Declining"),
        "stable": ("stable", "Stable"),
    }
    code, label = mapping.get(direction, ("stable", "Stable"))
    return {"code": code, "label": label}


class AIOperationalInsightsService:
    """Derive operational insights from FO-088 analytics payloads."""

    def __init__(self, analytics_service: AIRecommendationAnalyticsService | None = None):
        self.analytics = analytics_service or AIRecommendationAnalyticsService()

    def build(self, user, query_params) -> dict[str, Any]:
        thresholds = get_insight_thresholds()
        filters = self.analytics.resolve_filters(query_params)

        current = build_ai_recommendation_analytics(user, query_params)

        prev_start, prev_end = _previous_period_bounds(filters["start"], filters["end"])
        # Guard previous span against reporting max; truncate if needed.
        prev_span = (prev_end.date() - prev_start.date()).days
        if prev_span > MAX_DATE_RANGE_DAYS:
            prev_start = datetime.combine(
                (prev_end - timedelta(days=MAX_DATE_RANGE_DAYS)).date(),
                time.min,
                tzinfo=timezone.get_current_timezone(),
            )

        previous_params = {
            "start_date": prev_start.date().isoformat(),
            "end_date": prev_end.date().isoformat(),
        }
        for key in ("decision", "category", "priority", "severity", "provider", "model"):
            if filters.get(key):
                previous_params[key] = filters[key]

        previous = build_ai_recommendation_analytics(user, previous_params)

        current_summary = current["summary"]
        previous_summary = previous["summary"]
        health = compute_operational_health(current_summary, thresholds)
        trends = self._build_trends(current_summary, previous_summary, thresholds)
        insights = self._generate_insights(
            current, previous_summary, trends, thresholds
        )
        recommendations = self._generate_recommendations(insights, current, thresholds)

        return {
            "period": current["period"],
            "comparison_period": {
                "start_date": previous["period"]["start_date"],
                "end_date": previous["period"]["end_date"],
                "inclusive": True,
                "max_range_days": MAX_DATE_RANGE_DAYS,
            },
            "filters": current["filters"],
            "thresholds": {
                "high_override_rate": thresholds["high_override_rate"],
                "low_acceptance_rate": thresholds["low_acceptance_rate"],
                "high_acceptance_rate": thresholds["high_acceptance_rate"],
                "pending_review_count": thresholds["pending_review_count"],
                "low_confidence": thresholds["low_confidence"],
                "high_confidence": thresholds["high_confidence"],
                "high_volume_count": thresholds["high_volume_count"],
                "low_volume_count": thresholds["low_volume_count"],
                "trend_stable_delta": thresholds["trend_stable_delta"],
                "health_healthy_min": thresholds["health_healthy_min"],
                "health_needs_review_min": thresholds["health_needs_review_min"],
            },
            "summary": {
                "recommendation_count": current_summary["recommendation_count"],
                "reviewed_count": current_summary["reviewed_count"],
                "pending_review_count": current_summary["pending_review_count"],
                "acceptance_rate": current_summary["acceptance_rate"],
                "modification_rate": current_summary["modification_rate"],
                "ignore_rate": current_summary["ignore_rate"],
                "full_agreement_rate": current_summary["full_agreement_rate"],
                "average_confidence": current_summary["average_confidence"],
            },
            "health_score": health,
            "trend": trends,
            "comparison": {
                "current": {
                    "recommendation_count": current_summary["recommendation_count"],
                    "acceptance_rate": current_summary["acceptance_rate"],
                    "modification_rate": current_summary["modification_rate"],
                    "full_agreement_rate": current_summary["full_agreement_rate"],
                    "average_confidence": current_summary["average_confidence"],
                    "pending_review_count": current_summary["pending_review_count"],
                },
                "previous": {
                    "recommendation_count": previous_summary["recommendation_count"],
                    "acceptance_rate": previous_summary["acceptance_rate"],
                    "modification_rate": previous_summary["modification_rate"],
                    "full_agreement_rate": previous_summary["full_agreement_rate"],
                    "average_confidence": previous_summary["average_confidence"],
                    "pending_review_count": previous_summary["pending_review_count"],
                },
            },
            "insights": insights,
            "recommendations": recommendations,
            "cards": self._build_cards(current, health, trends),
            "category_overrides": current.get("category_overrides", [])[:5],
            "priority_overrides": current.get("priority_overrides", [])[:5],
            "manager_notes": {
                "placeholder": True,
                "message": (
                    "Manager notes are read-only in FO-089. Capturing and "
                    "editing operational notes is reserved for a future task."
                ),
            },
            "interpretation": {
                "note": (
                    "Operational insights are rule-based and informational. "
                    "They do not retrain models, change prompts, or mutate "
                    "tickets, categories, priorities, or assignments."
                ),
                "labels": {
                    "health": "AI Operational Health",
                    "acceptance": "Recommendation Acceptance",
                    "override": "Human Override Rate",
                    "agreement": "Full Recommendation Agreement",
                },
            },
        }

    def _build_trends(
        self,
        current: dict[str, Any],
        previous: dict[str, Any],
        thresholds: dict[str, float | int],
    ) -> dict[str, Any]:
        delta = float(thresholds["trend_stable_delta"])
        metrics = {
            "acceptance": (
                current.get("acceptance_rate"),
                previous.get("acceptance_rate"),
            ),
            "override": (
                current.get("modification_rate"),
                previous.get("modification_rate"),
            ),
            "confidence": (
                current.get("average_confidence"),
                previous.get("average_confidence"),
            ),
            "agreement": (
                current.get("full_agreement_rate"),
                previous.get("full_agreement_rate"),
            ),
            "volume": (
                float(current.get("recommendation_count") or 0),
                float(previous.get("recommendation_count") or 0),
            ),
        }
        # Volume uses absolute count delta relative to previous (or 1).
        result = {}
        for key, (cur, prev) in metrics.items():
            if key == "volume":
                base = prev if prev and prev > 0 else 1.0
                relative = ((cur or 0) - (prev or 0)) / base
                direction = _classify_trend(relative, 0.0, delta)
                # _classify_trend(current_relative, 0) works if we pass relative as delta from 0
                if abs(relative) <= delta:
                    direction = "stable"
                elif relative > 0:
                    direction = "increasing"
                else:
                    direction = "decreasing"
                result[key] = {
                    "direction": direction,
                    "badge": _trend_badge(direction),
                    "current": int(cur or 0),
                    "previous": int(prev or 0),
                    "delta": int((cur or 0) - (prev or 0)),
                }
            elif key == "confidence":
                # Confidence is 0–100; convert stable delta to points (~5).
                conf_delta = delta * 100.0
                direction = _classify_trend(cur, prev, conf_delta)
                result[key] = {
                    "direction": direction,
                    "badge": _trend_badge(direction),
                    "current": cur,
                    "previous": prev,
                    "delta": (
                        None
                        if cur is None or prev is None
                        else round(float(cur) - float(prev), 1)
                    ),
                }
            else:
                direction = _classify_trend(cur, prev, delta)
                result[key] = {
                    "direction": direction,
                    "badge": _trend_badge(direction),
                    "current": cur,
                    "previous": prev,
                    "delta": (
                        None
                        if cur is None or prev is None
                        else round(float(cur) - float(prev), 4)
                    ),
                }
        return result

    def _generate_insights(
        self,
        current_payload: dict[str, Any],
        previous_summary: dict[str, Any],
        trends: dict[str, Any],
        thresholds: dict[str, float | int],
    ) -> list[dict[str, Any]]:
        summary = current_payload["summary"]
        insights: list[dict[str, Any]] = []

        severity_badges = {
            "healthy": {"code": "healthy", "label": "Healthy"},
            "positive": {"code": "improving", "label": "Improving"},
            "info": {"code": "stable", "label": "Stable"},
            "warning": {"code": "needs_review", "label": "Needs Review"},
            "attention": {"code": "attention", "label": "Attention"},
        }

        def add(
            code: str,
            severity: str,
            title: str,
            message: str,
            *,
            metric: str | None = None,
            value: float | int | None = None,
        ):
            insights.append(
                {
                    "code": code,
                    "severity": severity,
                    "badge": severity_badges.get(
                        severity,
                        {"code": "needs_review", "label": "Needs Review"},
                    ),
                    "title": title,
                    "message": message,
                    "metric": metric,
                    "value": value,
                }
            )

        acceptance = float(summary["acceptance_rate"] or 0.0)
        override = float(summary["modification_rate"] or 0.0)
        pending = int(summary["pending_review_count"] or 0)
        volume = int(summary["recommendation_count"] or 0)
        reviewed = int(summary["reviewed_count"] or 0)
        avg_conf = summary.get("average_confidence")
        category_overrides = current_payload.get("category_overrides") or []
        priority_overrides = current_payload.get("priority_overrides") or []

        if volume == 0:
            add(
                "no_data",
                "info",
                "No Recommendation Data",
                "No eligible AI recommendations were found for this period.",
                metric="recommendation_count",
                value=0,
            )
            return insights

        if reviewed > 0 and acceptance >= float(thresholds["high_acceptance_rate"]):
            add(
                "high_ai_acceptance",
                "positive",
                "High AI Acceptance",
                (
                    f"Acceptance rate is {acceptance:.1%} for reviewed "
                    "recommendations in this period."
                ),
                metric="acceptance_rate",
                value=acceptance,
            )

        if reviewed > 0 and acceptance <= float(thresholds["low_acceptance_rate"]):
            add(
                "low_ai_acceptance",
                "warning",
                "Low AI Acceptance",
                (
                    f"Acceptance rate is {acceptance:.1%}, at or below the "
                    "configured low-acceptance threshold."
                ),
                metric="acceptance_rate",
                value=acceptance,
            )

        if reviewed > 0 and override >= float(thresholds["high_override_rate"]):
            add(
                "high_override_rate",
                "attention",
                "High Override Rate",
                (
                    f"Modification (override) rate is {override:.1%}, at or "
                    "above the configured threshold."
                ),
                metric="modification_rate",
                value=override,
            )

        if category_overrides:
            top = category_overrides[0]
            add(
                "frequently_corrected_categories",
                "warning",
                "Frequently Corrected Categories",
                (
                    f"Most common category override: {top['recommended']} → "
                    f"{top['final']} ({top['count']} times)."
                ),
                metric="category_overrides",
                value=top["count"],
            )

        if priority_overrides:
            top = priority_overrides[0]
            add(
                "frequently_corrected_priorities",
                "warning",
                "Frequently Corrected Priorities",
                (
                    f"Most common priority override: {top['recommended']} → "
                    f"{top['final']} ({top['count']} times)."
                ),
                metric="priority_overrides",
                value=top["count"],
            )

        if avg_conf is not None and float(avg_conf) < float(thresholds["low_confidence"]):
            add(
                "low_confidence_recommendations",
                "warning",
                "Low Confidence Recommendations",
                (
                    f"Average confidence is {float(avg_conf):.1f}, below the "
                    "configured low-confidence threshold."
                ),
                metric="average_confidence",
                value=float(avg_conf),
            )

        accepted_conf = None
        for row in current_payload.get("confidence_by_decision") or []:
            if row.get("decision") == "accepted":
                accepted_conf = row.get("average_confidence")
                break
        if (
            accepted_conf is not None
            and float(accepted_conf) >= float(thresholds["high_confidence"])
        ):
            add(
                "high_confidence_accepted",
                "positive",
                "High Confidence Accepted Recommendations",
                (
                    f"Accepted recommendations average "
                    f"{float(accepted_conf):.1f} confidence."
                ),
                metric="accepted_average_confidence",
                value=float(accepted_conf),
            )

        if pending >= int(thresholds["pending_review_count"]):
            add(
                "recommendations_awaiting_review",
                "attention",
                "Recommendations Awaiting Review",
                (
                    f"{pending} recommendations are pending human review "
                    "(threshold "
                    f"{int(thresholds['pending_review_count'])})."
                ),
                metric="pending_review_count",
                value=pending,
            )

        if volume >= int(thresholds["high_volume_count"]):
            add(
                "high_recommendation_volume",
                "info",
                "High Recommendation Volume",
                f"{volume} eligible recommendations were completed this period.",
                metric="recommendation_count",
                value=volume,
            )
        elif volume <= int(thresholds["low_volume_count"]):
            add(
                "low_recommendation_volume",
                "info",
                "Low Recommendation Volume",
                f"Only {volume} eligible recommendations were completed this period.",
                metric="recommendation_count",
                value=volume,
            )

        acceptance_trend = trends.get("acceptance", {}).get("direction")
        agreement_trend = trends.get("agreement", {}).get("direction")
        if acceptance_trend == "increasing" or agreement_trend == "increasing":
            add(
                "rapid_improvement_trend",
                "positive",
                "Rapid Improvement Trend",
                (
                    "Acceptance and/or full agreement improved versus the "
                    "previous equivalent period."
                ),
                metric="acceptance_trend",
                value=None,
            )
        if agreement_trend == "decreasing":
            add(
                "declining_agreement_trend",
                "attention",
                "Declining Agreement Trend",
                (
                    "Full recommendation agreement declined versus the "
                    "previous equivalent period."
                ),
                metric="agreement_trend",
                value=None,
            )

        return insights

    def _generate_recommendations(
        self,
        insights: list[dict[str, Any]],
        current_payload: dict[str, Any],
        thresholds: dict[str, float | int],
    ) -> list[dict[str, Any]]:
        recs: list[dict[str, Any]] = []
        codes = {item["code"] for item in insights}
        category_overrides = current_payload.get("category_overrides") or []
        priority_overrides = current_payload.get("priority_overrides") or []

        def add(code: str, title: str, message: str):
            recs.append(
                {
                    "code": code,
                    "title": title,
                    "message": message,
                    "actionable": False,
                    "note": (
                        "Informational only. FacilityOps does not auto-apply "
                        "this recommendation."
                    ),
                }
            )

        if "high_override_rate" in codes and category_overrides:
            top = category_overrides[0]
            add(
                "review_category_guidelines",
                "Review category guidelines",
                (
                    f"Review {top['recommended']} category guidelines. "
                    f"Recommendations are frequently changed to {top['final']}."
                ),
            )
        elif "frequently_corrected_categories" in codes and category_overrides:
            top = category_overrides[0]
            add(
                "review_category_guidelines",
                "Review category guidelines",
                f"Review {top['recommended']} category guidelines.",
            )

        if "frequently_corrected_priorities" in codes and priority_overrides:
            top = priority_overrides[0]
            add(
                "review_priority_guidance",
                "Review priority guidance",
                (
                    f"Priority recommendations for {top['recommended']} are "
                    f"frequently changed to {top['final']}."
                ),
            )

        if "recommendations_awaiting_review" in codes:
            pending = current_payload["summary"]["pending_review_count"]
            add(
                "clear_pending_reviews",
                "Clear pending AI reviews",
                f"Large number of pending AI reviews ({pending}).",
            )

        if "low_ai_acceptance" in codes:
            add(
                "review_recommendation_workflows",
                "Review recommendation workflows",
                (
                    "Consider reviewing how recommendation outcomes are applied "
                    "in ticket creation workflows."
                ),
            )

        if "low_confidence_recommendations" in codes:
            add(
                "review_low_confidence_inputs",
                "Review low-confidence inputs",
                (
                    "Consider reviewing photo quality and staging guidance for "
                    "low-confidence recommendation cases."
                ),
            )

        if not recs and current_payload["summary"]["recommendation_count"] > 0:
            add(
                "continue_monitoring",
                "Continue monitoring",
                (
                    "No threshold-based operational actions are suggested for "
                    "this period. Continue monitoring FO-088 analytics."
                ),
            )

        return recs

    def _build_cards(
        self,
        current_payload: dict[str, Any],
        health: dict[str, Any],
        trends: dict[str, Any],
    ) -> list[dict[str, Any]]:
        summary = current_payload["summary"]
        category_overrides = current_payload.get("category_overrides") or []
        priority_overrides = current_payload.get("priority_overrides") or []
        top_category = category_overrides[0]["recommended"] if category_overrides else None
        top_priority = priority_overrides[0]["recommended"] if priority_overrides else None

        improving = trends.get("acceptance", {}).get("direction") == "increasing"
        declining = trends.get("agreement", {}).get("direction") == "decreasing"

        return [
            {
                "code": "health",
                "label": "AI Operational Health",
                "value": health["score"],
                "display": str(health["score"]),
                "badge": {"code": health["band"], "label": health["label"]},
            },
            {
                "code": "acceptance_rate",
                "label": "Acceptance Rate",
                "value": summary["acceptance_rate"],
                "display": f"{float(summary['acceptance_rate']) * 100:.1f}%",
                "badge": trends.get("acceptance", {}).get("badge")
                or {"code": "stable", "label": "Stable"},
            },
            {
                "code": "pending_reviews",
                "label": "Pending Reviews",
                "value": summary["pending_review_count"],
                "display": str(summary["pending_review_count"]),
                "badge": {"code": "needs_review", "label": "Needs Review"}
                if summary["pending_review_count"]
                else {"code": "healthy", "label": "Healthy"},
            },
            {
                "code": "average_confidence",
                "label": "Average Confidence",
                "value": summary["average_confidence"],
                "display": (
                    "—"
                    if summary["average_confidence"] is None
                    else f"{float(summary['average_confidence']):.1f}"
                ),
                "badge": {"code": "stable", "label": "Stable"},
            },
            {
                "code": "most_overridden_category",
                "label": "Most Overridden Category",
                "value": top_category,
                "display": top_category or "—",
                "badge": {"code": "attention", "label": "Attention"}
                if top_category
                else {"code": "stable", "label": "Stable"},
            },
            {
                "code": "most_overridden_priority",
                "label": "Most Overridden Priority",
                "value": top_priority,
                "display": top_priority or "—",
                "badge": {"code": "attention", "label": "Attention"}
                if top_priority
                else {"code": "stable", "label": "Stable"},
            },
            {
                "code": "improving_trend",
                "label": "Improving Trend",
                "value": improving,
                "display": "Yes" if improving else "No",
                "badge": {"code": "improving", "label": "Improving"}
                if improving
                else {"code": "stable", "label": "Stable"},
            },
            {
                "code": "declining_trend",
                "label": "Declining Trend",
                "value": declining,
                "display": "Yes" if declining else "No",
                "badge": {"code": "declining", "label": "Declining"}
                if declining
                else {"code": "stable", "label": "Stable"},
            },
            {
                "code": "recommendation_volume",
                "label": "Recommendation Volume",
                "value": summary["recommendation_count"],
                "display": str(summary["recommendation_count"]),
                "badge": trends.get("volume", {}).get("badge")
                or {"code": "stable", "label": "Stable"},
            },
        ]


def build_ai_operational_insights(user, query_params) -> dict[str, Any]:
    """Public entry point for FO-089 operational insights."""
    return AIOperationalInsightsService().build(user, query_params)
