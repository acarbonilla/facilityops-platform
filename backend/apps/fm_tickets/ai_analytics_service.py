"""FO-088 tenant-scoped AI recommendation analytics (informational only).

Human agreement metrics measure workflow outcomes, not ground-truth
model accuracy. This service never mutates tickets, prompts, or models.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta
from typing import Any

from django.db.models import Q
from django.db.models.fields.json import KeyTextTransform
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError

from apps.fm_tickets.ai_recommendation_review import (
    map_ai_category_to_ticket,
    map_ai_priority_to_ticket,
)
from apps.fm_tickets.intake_reporting import is_non_operational_final_value
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.reporting.tenant_scope import scope_queryset_to_user

DEFAULT_DATE_RANGE_DAYS = 90
MAX_DATE_RANGE_DAYS = 180
SCHEMA_NAME = "FacilityRecommendationV1"
RATE_DECIMALS = 4
CONFIDENCE_DECIMALS = 1

# Confidence bands use FO-086 PercentConfidence scale (0–100 inclusive).
# Low: < 50 | Medium: 50–74 | High: 75–89 | Very High: 90–100
CONFIDENCE_BANDS = (
    ("low", "Low", None, 50),  # value < 50
    ("medium", "Medium", 50, 75),  # 50 <= value < 75
    ("high", "High", 75, 90),  # 75 <= value < 90
    ("very_high", "Very High", 90, 101),  # 90 <= value <= 100
)

PERIOD_PRESETS = {
    "last_7_days": 7,
    "last_30_days": 30,
    "last_90_days": 90,
}


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, RATE_DECIMALS)


def _safe_avg(total: float, count: int) -> float | None:
    if count <= 0:
        return None
    return round(total / count, CONFIDENCE_DECIMALS)


def _parse_bound(raw_value, field_name, *, end_of_day=False):
    """Parse inclusive calendar bounds in Django's current timezone."""
    if raw_value in (None, ""):
        return None

    raw_str = str(raw_value).strip()
    try:
        parsed_date = parse_date(raw_str)
    except ValueError as exc:
        raise ValidationError(
            {field_name: "Must be a valid calendar date."}
        ) from exc

    if parsed_date is not None:
        return datetime.combine(
            parsed_date,
            time.max if end_of_day else time.min,
            tzinfo=timezone.get_current_timezone(),
        )

    parsed = parse_datetime(raw_str)
    if parsed is None:
        raise ValidationError(
            {field_name: "Must be a valid ISO-8601 date or datetime."}
        )
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _echo_bound(bound, *, date_only: bool) -> str:
    if date_only:
        return timezone.localtime(bound).date().isoformat()
    return bound.isoformat()


def _calendar_span_days(date_from, date_to) -> int:
    tz = timezone.get_current_timezone()
    from_day = timezone.localtime(date_from, tz).date()
    to_day = timezone.localtime(date_to, tz).date()
    return (to_day - from_day).days


def _confidence_band_key(value: int | float | None) -> str | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 50:
        return "low"
    if numeric < 75:
        return "medium"
    if numeric < 90:
        return "high"
    if numeric <= 100:
        return "very_high"
    return None


class AIRecommendationAnalyticsService:
    """Compute tenant-scoped AI recommendation usage and agreement metrics."""

    def resolve_filters(self, query_params) -> dict[str, Any]:
        period = (query_params.get("period") or "").strip()
        start_raw = query_params.get("start_date") or query_params.get("date_from")
        end_raw = query_params.get("end_date") or query_params.get("date_to")

        now = timezone.localtime()
        date_only_start = True
        date_only_end = True

        if period == "current_year":
            start = datetime.combine(
                now.date().replace(month=1, day=1),
                time.min,
                tzinfo=timezone.get_current_timezone(),
            )
            end = datetime.combine(
                now.date(),
                time.max,
                tzinfo=timezone.get_current_timezone(),
            )
        elif period in PERIOD_PRESETS:
            days = PERIOD_PRESETS[period]
            end = datetime.combine(
                now.date(),
                time.max,
                tzinfo=timezone.get_current_timezone(),
            )
            start = datetime.combine(
                (now - timedelta(days=days)).date(),
                time.min,
                tzinfo=timezone.get_current_timezone(),
            )
        else:
            if start_raw in (None, "") and end_raw in (None, ""):
                end = datetime.combine(
                    now.date(),
                    time.max,
                    tzinfo=timezone.get_current_timezone(),
                )
                start = datetime.combine(
                    (now - timedelta(days=DEFAULT_DATE_RANGE_DAYS)).date(),
                    time.min,
                    tzinfo=timezone.get_current_timezone(),
                )
            else:
                if start_raw in (None, "") or end_raw in (None, ""):
                    raise ValidationError(
                        {
                            "start_date": (
                                "Both start_date and end_date are required "
                                "unless period is provided."
                            )
                        }
                    )
                date_only_start = parse_date(str(start_raw).strip()) is not None
                date_only_end = parse_date(str(end_raw).strip()) is not None
                start = _parse_bound(start_raw, "start_date", end_of_day=False)
                end = _parse_bound(end_raw, "end_date", end_of_day=True)

        if start > end:
            raise ValidationError(
                {"start_date": "start_date must be on or before end_date."}
            )

        span = _calendar_span_days(start, end)
        if span > MAX_DATE_RANGE_DAYS:
            raise ValidationError(
                {
                    "end_date": (
                        f"Date range may not exceed {MAX_DATE_RANGE_DAYS} days."
                    )
                }
            )

        decision = (query_params.get("decision") or "").strip()
        if decision and decision not in {
            AITicketAnalysis.Decision.ACCEPTED,
            AITicketAnalysis.Decision.MODIFIED,
            AITicketAnalysis.Decision.IGNORED,
            "pending",
        }:
            raise ValidationError(
                {
                    "decision": (
                        "Must be accepted, modified, ignored, or pending."
                    )
                }
            )

        category = (query_params.get("category") or "").strip()
        if category and category not in FmTicket.Category.values:
            raise ValidationError({"category": "Invalid ticket category code."})

        priority = (query_params.get("priority") or "").strip()
        if priority and priority not in FmTicket.Priority.values:
            raise ValidationError({"priority": "Invalid ticket priority code."})

        severity = (query_params.get("severity") or "").strip()
        provider = (query_params.get("provider") or "").strip()
        model = (
            query_params.get("model") or query_params.get("model_name") or ""
        ).strip()

        return {
            "start": start,
            "end": end,
            "start_date": _echo_bound(start, date_only=date_only_start),
            "end_date": _echo_bound(end, date_only=date_only_end),
            "period": period or None,
            "decision": decision or None,
            "category": category or None,
            "priority": priority or None,
            "severity": severity or None,
            "provider": provider or None,
            "model": model or None,
            "inclusive_bounds": True,
        }

    def base_queryset(self, user, filters: dict[str, Any]):
        """Eligible FO-086 recommendations for the actor's tenant and period.

        Inclusive bounds on ``completed_at``. Excludes queued/processing/failed,
        soft-deleted rows, and payloads without FacilityRecommendationV1 data.
        """
        qs = AITicketAnalysis.objects.filter(
            is_deleted=False,
            status=AITicketAnalysis.Status.COMPLETED,
            completed_at__gte=filters["start"],
            completed_at__lte=filters["end"],
            result_json__schema_name=SCHEMA_NAME,
        )
        qs = scope_queryset_to_user(qs, user, tenant_field="tenant_id")

        if filters.get("provider"):
            qs = qs.filter(provider=filters["provider"])
        if filters.get("model"):
            qs = qs.filter(model_name=filters["model"])
        if filters.get("category"):
            # Compare mapped AI label → ticket code against filter.
            # Applied after fetch for mapped labels; also match decision finals.
            pass
        if filters.get("priority"):
            pass
        if filters.get("decision") == "pending":
            qs = qs.filter(Q(decision="") | Q(decision__isnull=True))
        elif filters.get("decision"):
            qs = qs.filter(decision=filters["decision"])

        return qs.select_related("ticket")

    def build(self, user, query_params) -> dict[str, Any]:
        filters = self.resolve_filters(query_params)
        queryset = self.base_queryset(user, filters)

        # Pull lightweight rows once; avoid N+1 and keep aggregation in Python
        # for label→code agreement mapping that SQL cannot express cleanly.
        rows = list(
            queryset.annotate(
                overall_confidence_text=KeyTextTransform(
                    "overall_confidence", "result_json"
                ),
                severity_text=KeyTextTransform("severity", "result_json"),
                recommended_category_json=KeyTextTransform(
                    "recommended_category", "result_json"
                ),
                recommended_priority_json=KeyTextTransform(
                    "recommended_priority", "result_json"
                ),
            ).values(
                "id",
                "decision",
                "decision_recommended_category",
                "decision_recommended_priority",
                "final_category",
                "final_priority",
                "completed_at",
                "decision_at",
                "overall_confidence_text",
                "severity_text",
                "recommended_category_json",
                "recommended_priority_json",
                "ticket__category",
                "ticket__priority",
                "ticket__building_id",
                "ticket__organization_id",
            )
        )

        category_filter = filters.get("category")
        priority_filter = filters.get("priority")
        severity_filter = filters.get("severity")

        records: list[dict[str, Any]] = []
        for row in rows:
            ai_category = (
                row["decision_recommended_category"]
                or row["recommended_category_json"]
                or ""
            )
            ai_priority = (
                row["decision_recommended_priority"]
                or row["recommended_priority_json"]
                or ""
            )
            mapped_category = map_ai_category_to_ticket(ai_category or None)
            mapped_priority = map_ai_priority_to_ticket(ai_priority or None)

            confidence = None
            raw_conf = row["overall_confidence_text"]
            if raw_conf is not None and raw_conf != "":
                try:
                    confidence = int(float(raw_conf))
                except (TypeError, ValueError):
                    confidence = None
                if confidence is not None and not (0 <= confidence <= 100):
                    confidence = None

            severity = row["severity_text"] or None
            decision = row["decision"] or ""

            if category_filter and mapped_category != category_filter:
                # Also allow matching final_category for reviewed rows.
                if row["final_category"] != category_filter:
                    continue
            if priority_filter and mapped_priority != priority_filter:
                if row["final_priority"] != priority_filter:
                    continue
            if severity_filter and severity != severity_filter:
                continue

            records.append(
                {
                    "decision": decision,
                    "ai_category_label": ai_category,
                    "ai_priority_label": ai_priority,
                    "mapped_category": mapped_category,
                    "mapped_priority": mapped_priority,
                    "final_category": row["final_category"] or "",
                    "final_priority": row["final_priority"] or "",
                    "confidence": confidence,
                    "severity": severity,
                    "completed_at": row["completed_at"],
                    "decision_at": row["decision_at"],
                    "ticket_category": row["ticket__category"] or "",
                    "ticket_priority": row["ticket__priority"] or "",
                    "ticket_building_id": row["ticket__building_id"],
                }
            )

        return self._aggregate(filters, records)

    def _aggregate(
        self, filters: dict[str, Any], records: list[dict[str, Any]]
    ) -> dict[str, Any]:
        recommendation_count = len(records)
        accepted = [r for r in records if r["decision"] == "accepted"]
        modified = [r for r in records if r["decision"] == "modified"]
        ignored = [r for r in records if r["decision"] == "ignored"]
        pending = [r for r in records if not r["decision"]]
        reviewed = accepted + modified + ignored
        reviewed_count = len(reviewed)
        accepted_count = len(accepted)
        modified_count = len(modified)
        ignored_count = len(ignored)
        pending_count = len(pending)

        category_agree_num = 0
        category_agree_den = 0
        priority_agree_num = 0
        priority_agree_den = 0
        full_agree_num = 0
        full_agree_den = 0

        for row in reviewed:
            # FO-100: do not let intake placeholders distort agreement rates.
            if is_non_operational_final_value(
                category=row["final_category"],
                priority=row["final_priority"],
            ):
                continue
            has_cat = bool(row["final_category"]) and bool(row["mapped_category"])
            has_pri = bool(row["final_priority"]) and bool(row["mapped_priority"])
            cat_match = False
            pri_match = False
            if has_cat:
                category_agree_den += 1
                cat_match = row["mapped_category"] == row["final_category"]
                if cat_match:
                    category_agree_num += 1
            if has_pri:
                priority_agree_den += 1
                pri_match = row["mapped_priority"] == row["final_priority"]
                if pri_match:
                    priority_agree_num += 1
            if has_cat and has_pri:
                full_agree_den += 1
                if cat_match and pri_match:
                    full_agree_num += 1

        unclassified_ticket_recommendation_count = sum(
            1
            for row in records
            if row.get("ticket_category") == FmTicket.Category.UNCLASSIFIED
        )
        pending_classification_recommendation_count = sum(
            1
            for row in records
            if row.get("ticket_priority") == FmTicket.Priority.PENDING_REVIEW
        )
        ai_ready_awaiting_classification_count = sum(
            1
            for row in records
            if row.get("ticket_category") == FmTicket.Category.UNCLASSIFIED
            or row.get("ticket_priority") == FmTicket.Priority.PENDING_REVIEW
            or not row.get("ticket_building_id")
        )

        confidences = [r["confidence"] for r in records if r["confidence"] is not None]
        avg_confidence = _safe_avg(sum(confidences), len(confidences))

        confidence_by_decision = []
        for key, label, subset in (
            ("accepted", "Accepted", accepted),
            ("modified", "Modified", modified),
            ("ignored", "Ignored", ignored),
            ("pending", "Pending Review", pending),
        ):
            values = [r["confidence"] for r in subset if r["confidence"] is not None]
            confidence_by_decision.append(
                {
                    "decision": key,
                    "label": label,
                    "count": len(subset),
                    "average_confidence": _safe_avg(sum(values), len(values)),
                }
            )

        band_counts: Counter[str] = Counter()
        for row in records:
            band = _confidence_band_key(row["confidence"])
            if band:
                band_counts[band] += 1

        confidence_bands = []
        for key, label, lower, upper in CONFIDENCE_BANDS:
            if key == "low":
                bound_label = "below 50"
            elif key == "medium":
                bound_label = "50–74"
            elif key == "high":
                bound_label = "75–89"
            else:
                bound_label = "90–100"
            count = band_counts.get(key, 0)
            confidence_bands.append(
                {
                    "band": key,
                    "label": label,
                    "bounds": bound_label,
                    "count": count,
                    "percentage": _safe_rate(count, recommendation_count),
                }
            )

        category_overrides = self._override_pairs(
            modified,
            ai_key="ai_category_label",
            final_key="final_category",
            mapped_key="mapped_category",
        )
        priority_overrides = self._override_pairs(
            modified,
            ai_key="ai_priority_label",
            final_key="final_priority",
            mapped_key="mapped_priority",
        )

        decision_trend = self._decision_trend(filters, records)

        return {
            "period": {
                "start_date": filters["start_date"],
                "end_date": filters["end_date"],
                "preset": filters.get("period"),
                "inclusive": True,
                "max_range_days": MAX_DATE_RANGE_DAYS,
            },
            "filters": {
                "decision": filters.get("decision"),
                "category": filters.get("category"),
                "priority": filters.get("priority"),
                "severity": filters.get("severity"),
                "provider": filters.get("provider"),
                "model": filters.get("model"),
            },
            "summary": {
                "recommendation_count": recommendation_count,
                "reviewed_count": reviewed_count,
                "pending_review_count": pending_count,
                "accepted_count": accepted_count,
                "modified_count": modified_count,
                "ignored_count": ignored_count,
                "acceptance_rate": _safe_rate(accepted_count, reviewed_count),
                "modification_rate": _safe_rate(modified_count, reviewed_count),
                "ignore_rate": _safe_rate(ignored_count, reviewed_count),
                "category_agreement_rate": _safe_rate(
                    category_agree_num, category_agree_den
                ),
                "priority_agreement_rate": _safe_rate(
                    priority_agree_num, priority_agree_den
                ),
                "full_agreement_rate": _safe_rate(full_agree_num, full_agree_den),
                "average_confidence": avg_confidence,
                "category_agreement_sample_size": category_agree_den,
                "priority_agreement_sample_size": priority_agree_den,
                "full_agreement_sample_size": full_agree_den,
                "unclassified_ticket_recommendation_count": (
                    unclassified_ticket_recommendation_count
                ),
                "pending_classification_recommendation_count": (
                    pending_classification_recommendation_count
                ),
                "ai_ready_awaiting_classification_count": (
                    ai_ready_awaiting_classification_count
                ),
            },
            "decision_distribution": [
                {
                    "decision": "accepted",
                    "label": "Accepted",
                    "count": accepted_count,
                },
                {
                    "decision": "modified",
                    "label": "Modified",
                    "count": modified_count,
                },
                {
                    "decision": "ignored",
                    "label": "Ignored",
                    "count": ignored_count,
                },
                {
                    "decision": "pending",
                    "label": "Pending Review",
                    "count": pending_count,
                },
            ],
            "decision_trend": decision_trend,
            "confidence_by_decision": confidence_by_decision,
            "category_overrides": category_overrides,
            "priority_overrides": priority_overrides,
            "confidence_bands": confidence_bands,
            "interpretation": {
                "note": (
                    "Rates reflect human agreement with AI recommendations "
                    "in FacilityOps workflows. They are not a ground-truth "
                    "accuracy score for maintenance diagnosis or compliance. "
                    "pending_review_count is AI decision backlog (FO-087), not "
                    "ticket priority pending_review (FO-096 classification)."
                ),
                "labels": {
                    "acceptance_rate": "Recommendation Acceptance",
                    "modification_rate": "Human Override Rate (modified)",
                    "ignore_rate": "Ignore Rate",
                    "pending_review_count": "AI Decision Pending",
                    "pending_classification_recommendation_count": (
                        "Ticket Classification Pending"
                    ),
                    "ai_ready_awaiting_classification_count": (
                        "AI Ready Awaiting Classification"
                    ),
                    "category_agreement_rate": "Category Agreement",
                    "priority_agreement_rate": "Priority Agreement",
                    "full_agreement_rate": "Full Recommendation Agreement",
                },
            },
        }

    def _override_pairs(
        self,
        modified_rows: list[dict[str, Any]],
        *,
        ai_key: str,
        final_key: str,
        mapped_key: str,
    ) -> list[dict[str, Any]]:
        pairs: Counter[tuple[str, str]] = Counter()
        for row in modified_rows:
            ai_label = row[ai_key] or ""
            final_value = row[final_key] or ""
            if not ai_label or not final_value:
                continue
            if row[mapped_key] == final_value:
                # Not an override when mapped recommendation equals final.
                continue
            pairs[(ai_label, final_value)] += 1

        total = sum(pairs.values())
        items = []
        for (ai_value, final_value), count in pairs.most_common(20):
            items.append(
                {
                    "recommended": ai_value,
                    "final": final_value,
                    "count": count,
                    "percentage": _safe_rate(count, total if total else 0),
                }
            )
        return items

    def _decision_trend(
        self, filters: dict[str, Any], records: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        span = _calendar_span_days(filters["start"], filters["end"])
        if span <= 31:
            grain = "day"
        elif span <= 120:
            grain = "week"
        else:
            grain = "month"

        buckets: dict[str, dict[str, int]] = defaultdict(
            lambda: {
                "accepted": 0,
                "modified": 0,
                "ignored": 0,
                "pending": 0,
            }
        )

        for row in records:
            when = row["decision_at"] or row["completed_at"]
            if when is None:
                continue
            local = timezone.localtime(when)
            if grain == "day":
                key = local.date().isoformat()
            elif grain == "week":
                iso = local.isocalendar()
                key = f"{iso.year}-W{iso.week:02d}"
            else:
                key = f"{local.year:04d}-{local.month:02d}"

            decision = row["decision"] or "pending"
            if decision not in buckets[key]:
                decision = "pending"
            buckets[key][decision] += 1

        trend = []
        for period_key in sorted(buckets.keys()):
            counts = buckets[period_key]
            trend.append(
                {
                    "period": period_key,
                    "grain": grain,
                    "accepted": counts["accepted"],
                    "modified": counts["modified"],
                    "ignored": counts["ignored"],
                    "pending": counts["pending"],
                    "total": sum(counts.values()),
                }
            )
        return trend


def build_ai_recommendation_analytics(user, query_params) -> dict[str, Any]:
    return AIRecommendationAnalyticsService().build(user, query_params)
