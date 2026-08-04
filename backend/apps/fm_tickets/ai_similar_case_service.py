"""FO-091 AI Knowledge Base — rule-based similar historical cases.

Tenant-scoped, read-only discovery of related FM Tickets, Maintenance Work
Orders, and 5S Inspections. Reuses stored AI recommendation / human decision
fields without duplicating FO-088 analytics math.

Version 1 uses weighted rule scoring only (no embeddings / vector DB /
external AI calls). The response contract is designed so FO-092 can swap the
matcher while keeping the API shape stable.

Never mutates tickets, categories, priorities, work orders, inspections,
prompts, or models. Never exposes identities, attachments, prompts, or raw
Gemini payloads.
"""

from __future__ import annotations

import re
from datetime import datetime, time, timedelta
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db.models import Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import NotFound, ValidationError

from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
from apps.reporting.tenant_scope import scope_queryset_to_user

ALGORITHM_VERSION = "rule_v1"
ALGORITHM_NAME = "weighted_rule_similarity"
SCHEMA_NAME = "FacilityRecommendationV1"

DEFAULT_DATE_RANGE_DAYS = 90
MAX_DATE_RANGE_DAYS = 180
DEFAULT_MIN_SIMILARITY = 40
DEFAULT_RESULT_LIMIT = 10
MAX_RESULT_LIMIT = 25
CANDIDATE_LIMIT_PER_SOURCE = 150

DEFAULT_WEIGHT_CATEGORY = 25
DEFAULT_WEIGHT_KEYWORDS = 20
DEFAULT_WEIGHT_LOCATION = 15
DEFAULT_WEIGHT_ASSET = 15
DEFAULT_WEIGHT_RECOMMENDATION = 10
DEFAULT_WEIGHT_FINDINGS = 10
DEFAULT_WEIGHT_PRIORITY = 5

TICKET_COMPLETED_STATUSES = (
    FmTicket.Status.RESOLVED,
    FmTicket.Status.CLOSED,
)
WORK_ORDER_COMPLETED_STATUSES = (
    MaintenanceWorkOrder.Status.COMPLETED,
    MaintenanceWorkOrder.Status.CLOSED,
)
INSPECTION_COMPLETED_STATUSES = (
    Inspection.Status.COMPLETED,
    Inspection.Status.VERIFIED,
)

STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "at",
        "by",
        "from",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "this",
        "that",
        "it",
        "as",
        "into",
        "over",
        "under",
        "near",
        "unit",
        "area",
        "room",
        "please",
        "need",
        "needs",
        "issue",
        "issues",
        "problem",
        "problems",
        "request",
        "ticket",
        "work",
        "order",
        "inspection",
    }
)

TOKEN_RE = re.compile(r"[a-z0-9]{3,}")

PRIORITY_ALIASES = {
    "urgent": "urgent",
    "critical": "urgent",
    "high": "high",
    "medium": "medium",
    "low": "low",
}


def _setting_int(name: str, default: int) -> int:
    value = getattr(settings, name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def get_similarity_weights() -> dict[str, int]:
    """Documented FO-091 rule weights (points summing toward 0–100)."""
    return {
        "category": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_CATEGORY", DEFAULT_WEIGHT_CATEGORY
        ),
        "keywords": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_KEYWORDS", DEFAULT_WEIGHT_KEYWORDS
        ),
        "location": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_LOCATION", DEFAULT_WEIGHT_LOCATION
        ),
        "asset": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_ASSET", DEFAULT_WEIGHT_ASSET
        ),
        "recommendation": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_RECOMMENDATION",
            DEFAULT_WEIGHT_RECOMMENDATION,
        ),
        "findings": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_FINDINGS", DEFAULT_WEIGHT_FINDINGS
        ),
        "priority": _setting_int(
            "FACILITYOPS_AI_SIMILAR_WEIGHT_PRIORITY", DEFAULT_WEIGHT_PRIORITY
        ),
    }


def _parse_bound(raw_value, field_name, *, end_of_day=False):
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


def _calendar_span_days(date_from, date_to) -> int:
    tz = timezone.get_current_timezone()
    from_day = timezone.localtime(date_from, tz).date()
    to_day = timezone.localtime(date_to, tz).date()
    return (to_day - from_day).days


def _echo_bound(bound) -> str:
    return timezone.localtime(bound).date().isoformat()


def _parse_uuid(raw_value, field_name: str) -> UUID | None:
    if raw_value in (None, ""):
        return None
    try:
        return UUID(str(raw_value).strip())
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValidationError({field_name: "Must be a valid UUID."}) from exc


def extract_keywords(*texts: str | None) -> set[str]:
    tokens: set[str] = set()
    for text in texts:
        if not text:
            continue
        for match in TOKEN_RE.findall(str(text).lower()):
            if match not in STOPWORDS:
                tokens.add(match)
    return tokens


def _normalize_priority(value: str | None) -> str | None:
    if not value:
        return None
    key = str(value).strip().lower()
    return PRIORITY_ALIASES.get(key, key)


def _normalize_category(value: str | None) -> str | None:
    if not value:
        return None
    return str(value).strip().lower()


def _truncate(text: str | None, limit: int = 180) -> str:
    cleaned = " ".join(str(text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _overlap_ratio(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    intersection = left & right
    if not intersection:
        return 0.0
    return len(intersection) / max(len(left), len(right))


def _award_keyword_points(weight: int, ratio: float) -> int:
    if ratio <= 0:
        return 0
    if ratio >= 0.35:
        return weight
    if ratio >= 0.18:
        return max(1, int(round(weight * 0.6)))
    return max(1, int(round(weight * min(1.0, ratio / 0.18) * 0.4)))


def _label(value: str | None) -> str:
    if not value:
        return ""
    return str(value).replace("_", " ").strip().title()


def compute_similarity(
    current: dict[str, Any],
    candidate: dict[str, Any],
    weights: dict[str, int] | None = None,
) -> tuple[int, list[str], dict[str, int]]:
    """Return (score 0–100, reasons, component points)."""
    weights = weights or get_similarity_weights()
    components = {
        "category": 0,
        "keywords": 0,
        "location": 0,
        "asset": 0,
        "recommendation": 0,
        "findings": 0,
        "priority": 0,
    }
    reasons: list[str] = []

    cur_cat = _normalize_category(current.get("category"))
    cand_cat = _normalize_category(candidate.get("category"))
    if cur_cat and cand_cat and cur_cat == cand_cat:
        components["category"] = weights["category"]
        reasons.append(f"Category matched ({_label(cur_cat)})")

    keyword_ratio = _overlap_ratio(
        set(current.get("keywords") or []),
        set(candidate.get("keywords") or []),
    )
    keyword_points = _award_keyword_points(weights["keywords"], keyword_ratio)
    if keyword_points:
        components["keywords"] = keyword_points
        reasons.append("Shared keywords in title/description")

    cur_building = current.get("building_id")
    cand_building = candidate.get("building_id")
    if cur_building and cand_building and str(cur_building) == str(cand_building):
        components["location"] = weights["location"]
        building_label = candidate.get("building_code") or current.get(
            "building_code"
        )
        if building_label:
            reasons.append(f"Same building ({building_label})")
        else:
            reasons.append("Same building")

    cur_asset = current.get("asset_id")
    cand_asset = candidate.get("asset_id")
    if cur_asset and cand_asset and str(cur_asset) == str(cand_asset):
        components["asset"] = weights["asset"]
        asset_label = candidate.get("asset_code") or current.get("asset_code")
        if asset_label:
            reasons.append(f"Same asset ({asset_label})")
        else:
            reasons.append("Same asset")

    cur_rec_cat = _normalize_category(current.get("recommended_category"))
    cand_rec_cat = _normalize_category(candidate.get("recommended_category"))
    cur_rec_pri = _normalize_priority(current.get("recommended_priority"))
    cand_rec_pri = _normalize_priority(candidate.get("recommended_priority"))
    rec_points = 0
    if cur_rec_cat and cand_rec_cat and cur_rec_cat == cand_rec_cat:
        rec_points += int(round(weights["recommendation"] * 0.6))
    if cur_rec_pri and cand_rec_pri and cur_rec_pri == cand_rec_pri:
        rec_points += int(round(weights["recommendation"] * 0.4))
    if rec_points:
        components["recommendation"] = min(weights["recommendation"], rec_points)
        reasons.append("Similar AI recommendation")

    findings_ratio = _overlap_ratio(
        set(current.get("finding_keywords") or []),
        set(candidate.get("finding_keywords") or []),
    )
    findings_points = _award_keyword_points(weights["findings"], findings_ratio)
    if findings_points:
        components["findings"] = findings_points
        reasons.append("Similar findings")

    cur_pri = _normalize_priority(current.get("priority"))
    cand_pri = _normalize_priority(candidate.get("priority"))
    if cur_pri and cand_pri and cur_pri == cand_pri:
        components["priority"] = weights["priority"]
        reasons.append(f"Priority matched ({_label(cur_pri)})")

    if candidate.get("decision") in {
        AITicketAnalysis.Decision.ACCEPTED,
        AITicketAnalysis.Decision.MODIFIED,
    }:
        # Soft bonus explanation only when already scoring; does not inflate score.
        if components["recommendation"] or components["category"]:
            if candidate.get("decision") == AITicketAnalysis.Decision.ACCEPTED:
                reasons.append("Human accepted AI recommendation")
            else:
                reasons.append("Human modified AI recommendation")

    # Deduplicate reasons while preserving order.
    seen: set[str] = set()
    unique_reasons: list[str] = []
    for reason in reasons:
        if reason not in seen:
            seen.add(reason)
            unique_reasons.append(reason)

    score = min(100, sum(components.values()))
    return score, unique_reasons, components


def _analysis_recommendation_fields(analysis: AITicketAnalysis | None) -> dict[str, Any]:
    if analysis is None:
        return {
            "recommended_category": None,
            "recommended_priority": None,
            "finding_keywords": set(),
            "decision": "",
            "final_category": "",
            "final_priority": "",
            "analysis_id": None,
        }
    payload = analysis.result_json if isinstance(analysis.result_json, dict) else {}
    findings = payload.get("findings") if isinstance(payload.get("findings"), list) else []
    finding_texts: list[str] = []
    for item in findings:
        if isinstance(item, dict):
            finding_texts.append(str(item.get("title") or ""))
            # Use description for matching keywords only; never return raw text.
            finding_texts.append(str(item.get("description") or ""))
    rec_category = (
        analysis.decision_recommended_category
        or payload.get("recommended_category")
        or ""
    )
    rec_priority = (
        analysis.decision_recommended_priority
        or payload.get("recommended_priority")
        or ""
    )
    return {
        "recommended_category": str(rec_category).strip() or None,
        "recommended_priority": str(rec_priority).strip() or None,
        "finding_keywords": extract_keywords(*finding_texts),
        "decision": analysis.decision or "",
        "final_category": analysis.final_category or "",
        "final_priority": analysis.final_priority or "",
        "analysis_id": str(analysis.id),
    }


def _ai_decision_summary(analysis_fields: dict[str, Any]) -> dict[str, Any] | None:
    if not analysis_fields.get("analysis_id"):
        return None
    return {
        "recommended_category": _normalize_category(
            analysis_fields.get("recommended_category")
        ),
        "recommended_priority": _normalize_priority(
            analysis_fields.get("recommended_priority")
        ),
        "has_findings": bool(analysis_fields.get("finding_keywords")),
        "note": "AI suggestion snapshot only; raw Gemini output is not exposed.",
    }


def _human_decision_summary(analysis_fields: dict[str, Any]) -> dict[str, Any] | None:
    decision = analysis_fields.get("decision") or ""
    if not decision:
        return {
            "decision_outcome": "none",
            "final_category": None,
            "final_priority": None,
            "note": "No human AI recommendation decision recorded.",
        }
    return {
        "decision_outcome": decision,
        "final_category": _normalize_category(analysis_fields.get("final_category"))
        or None,
        "final_priority": _normalize_priority(analysis_fields.get("final_priority"))
        or None,
        "note": "Human decision remains authoritative; this endpoint is read-only.",
    }


def _case_fingerprint_from_ticket(
    ticket: FmTicket, analysis: AITicketAnalysis | None
) -> dict[str, Any]:
    analysis_fields = _analysis_recommendation_fields(analysis)
    keywords = extract_keywords(ticket.title, ticket.description)
    return {
        "source_type": "fm_ticket",
        "case_id": str(ticket.id),
        "reference": ticket.ticket_number or str(ticket.id),
        "title": ticket.title,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "building_id": ticket.building_id,
        "building_code": getattr(ticket.building, "code", None),
        "asset_id": ticket.asset_id,
        "asset_code": getattr(ticket.asset, "code", None) if ticket.asset_id else None,
        "keywords": keywords,
        "finding_keywords": analysis_fields["finding_keywords"],
        "recommended_category": analysis_fields["recommended_category"],
        "recommended_priority": analysis_fields["recommended_priority"],
        "decision": analysis_fields["decision"],
        "final_category": analysis_fields["final_category"],
        "final_priority": analysis_fields["final_priority"],
        "analysis_id": analysis_fields["analysis_id"],
        "resolution_summary": _truncate(ticket.description),
        "updated_at": ticket.updated_at,
    }


def _case_fingerprint_from_work_order(work_order: MaintenanceWorkOrder) -> dict[str, Any]:
    keywords = extract_keywords(work_order.title, work_order.description)
    return {
        "source_type": "maintenance_work_order",
        "case_id": str(work_order.id),
        "reference": work_order.work_order_number or str(work_order.id),
        "title": work_order.title,
        "category": None,
        "priority": work_order.priority,
        "status": work_order.status,
        "building_id": work_order.building_id,
        "building_code": getattr(work_order.building, "code", None),
        "asset_id": work_order.asset_id,
        "asset_code": getattr(work_order.asset, "code", None)
        if work_order.asset_id
        else None,
        "keywords": keywords,
        "finding_keywords": set(),
        "recommended_category": None,
        "recommended_priority": None,
        "decision": "",
        "final_category": "",
        "final_priority": "",
        "analysis_id": None,
        "resolution_summary": _truncate(work_order.description),
        "updated_at": work_order.updated_at,
    }


def _case_fingerprint_from_inspection(inspection: Inspection) -> dict[str, Any]:
    keywords = extract_keywords(
        inspection.title,
        inspection.remarks,
        inspection.five_s_category,
        inspection.inspection_type,
    )
    return {
        "source_type": "inspection",
        "case_id": str(inspection.id),
        "reference": inspection.inspection_number or str(inspection.id),
        "title": inspection.title,
        "category": None,
        "priority": inspection.priority,
        "status": inspection.status,
        "building_id": inspection.building_id,
        "building_code": getattr(inspection.building, "code", None),
        "asset_id": None,
        "asset_code": None,
        "keywords": keywords,
        "finding_keywords": set(),
        "recommended_category": None,
        "recommended_priority": None,
        "decision": "",
        "final_category": "",
        "final_priority": "",
        "analysis_id": None,
        "resolution_summary": _truncate(inspection.remarks)
        or f"Inspection {_label(inspection.status)}",
        "updated_at": inspection.updated_at,
    }


def _public_case_card(fingerprint: dict[str, Any]) -> dict[str, Any]:
    analysis_fields = {
        "analysis_id": fingerprint.get("analysis_id"),
        "recommended_category": fingerprint.get("recommended_category"),
        "recommended_priority": fingerprint.get("recommended_priority"),
        "finding_keywords": fingerprint.get("finding_keywords") or set(),
        "decision": fingerprint.get("decision") or "",
        "final_category": fingerprint.get("final_category") or "",
        "final_priority": fingerprint.get("final_priority") or "",
    }
    return {
        "source_type": fingerprint["source_type"],
        "case_id": fingerprint["case_id"],
        "reference": fingerprint["reference"],
        "title": fingerprint["title"],
        "category": _normalize_category(fingerprint.get("category")),
        "priority": _normalize_priority(fingerprint.get("priority")),
        "status": fingerprint.get("status"),
        "building_code": fingerprint.get("building_code"),
        "asset_code": fingerprint.get("asset_code"),
        "ai_decision_summary": _ai_decision_summary(analysis_fields),
        "human_decision_summary": _human_decision_summary(analysis_fields),
    }


def _historical_outcome(fingerprint: dict[str, Any]) -> dict[str, Any]:
    analysis_fields = {
        "decision": fingerprint.get("decision") or "",
        "final_category": fingerprint.get("final_category") or "",
        "final_priority": fingerprint.get("final_priority") or "",
    }
    resolved_category = (
        _normalize_category(analysis_fields["final_category"])
        or _normalize_category(fingerprint.get("category"))
    )
    resolved_priority = (
        _normalize_priority(analysis_fields["final_priority"])
        or _normalize_priority(fingerprint.get("priority"))
    )
    decision = analysis_fields["decision"] or "none"
    return {
        "resolved_category": resolved_category,
        "resolved_priority": resolved_priority,
        "status": fingerprint.get("status"),
        "resolution_summary": fingerprint.get("resolution_summary") or "",
        "decision_outcome": decision,
    }


class AISimilarCaseService:
    """Secure tenant-scoped similar-case retrieval and ranking."""

    def resolve_filters(self, query_params) -> dict[str, Any]:
        period = (query_params.get("period") or "").strip()
        start_raw = query_params.get("start_date") or query_params.get("date_from")
        end_raw = query_params.get("end_date") or query_params.get("date_to")
        now = timezone.localtime()

        if period in {"last_7_days", "last_30_days", "last_90_days"}:
            days = {"last_7_days": 7, "last_30_days": 30, "last_90_days": 90}[period]
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
                period = "last_90_days"
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
                start = _parse_bound(start_raw, "start_date", end_of_day=False)
                end = _parse_bound(end_raw, "end_date", end_of_day=True)
                period = period or None

        if start > end:
            raise ValidationError(
                {"start_date": "start_date must be on or before end_date."}
            )
        if _calendar_span_days(start, end) > MAX_DATE_RANGE_DAYS:
            raise ValidationError(
                {
                    "end_date": (
                        f"Date range may not exceed {MAX_DATE_RANGE_DAYS} days."
                    )
                }
            )

        ticket_id = _parse_uuid(query_params.get("ticket_id"), "ticket_id")
        analysis_id = _parse_uuid(query_params.get("analysis_id"), "analysis_id")
        if ticket_id is None and analysis_id is None:
            raise ValidationError(
                {
                    "ticket_id": (
                        "Provide ticket_id or analysis_id to define the current case."
                    )
                }
            )

        category = (query_params.get("category") or "").strip()
        if category and category not in FmTicket.Category.values:
            raise ValidationError({"category": "Invalid ticket category code."})

        priority = (query_params.get("priority") or "").strip()
        if priority and priority not in {
            *FmTicket.Priority.values,
            *MaintenanceWorkOrder.Priority.values,
        }:
            raise ValidationError({"priority": "Invalid priority code."})

        status = (query_params.get("status") or "").strip()
        building = _parse_uuid(query_params.get("building"), "building")
        asset = _parse_uuid(query_params.get("asset"), "asset")

        min_similarity_raw = query_params.get("min_similarity")
        if min_similarity_raw in (None, ""):
            min_similarity = DEFAULT_MIN_SIMILARITY
        else:
            try:
                min_similarity = int(min_similarity_raw)
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    {"min_similarity": "Must be an integer between 0 and 100."}
                ) from exc
            if min_similarity < 0 or min_similarity > 100:
                raise ValidationError(
                    {"min_similarity": "Must be an integer between 0 and 100."}
                )

        limit_raw = query_params.get("limit")
        if limit_raw in (None, ""):
            limit = DEFAULT_RESULT_LIMIT
        else:
            try:
                limit = int(limit_raw)
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    {"limit": f"Must be an integer between 1 and {MAX_RESULT_LIMIT}."}
                ) from exc
            if limit < 1 or limit > MAX_RESULT_LIMIT:
                raise ValidationError(
                    {"limit": f"Must be an integer between 1 and {MAX_RESULT_LIMIT}."}
                )

        source = (query_params.get("source") or "all").strip().lower()
        if source not in {
            "all",
            "fm_ticket",
            "maintenance_work_order",
            "inspection",
        }:
            raise ValidationError(
                {
                    "source": (
                        "Must be all, fm_ticket, maintenance_work_order, or inspection."
                    )
                }
            )

        return {
            "start": start,
            "end": end,
            "period": period,
            "ticket_id": ticket_id,
            "analysis_id": analysis_id,
            "category": category or None,
            "priority": priority or None,
            "status": status or None,
            "building": building,
            "asset": asset,
            "min_similarity": min_similarity,
            "limit": limit,
            "source": source,
        }

    def _latest_analysis_for_ticket(
        self, user, ticket: FmTicket
    ) -> AITicketAnalysis | None:
        qs = scope_queryset_to_user(
            AITicketAnalysis.objects.filter(
                is_deleted=False,
                ticket_id=ticket.id,
                status=AITicketAnalysis.Status.COMPLETED,
            ),
            user,
            tenant_field="tenant_id",
        ).order_by("-completed_at", "-created_at")
        return qs.first()

    def resolve_current_case(self, user, filters: dict[str, Any]) -> dict[str, Any]:
        analysis: AITicketAnalysis | None = None
        ticket: FmTicket | None = None

        if filters["analysis_id"] is not None:
            analysis = (
                scope_queryset_to_user(
                    AITicketAnalysis.objects.filter(
                        is_deleted=False,
                        id=filters["analysis_id"],
                    ).select_related(
                        "ticket",
                        "ticket__building",
                        "ticket__asset",
                    ),
                    user,
                    tenant_field="tenant_id",
                ).first()
            )
            if analysis is None:
                raise NotFound("AI analysis not found for this tenant.")
            ticket = analysis.ticket
            if ticket is None or ticket.is_deleted:
                raise NotFound("Related ticket not found for this analysis.")
            if filters["ticket_id"] is not None and ticket.id != filters["ticket_id"]:
                raise ValidationError(
                    {"ticket_id": "Does not match the ticket for analysis_id."}
                )
        else:
            ticket = (
                scope_queryset_to_user(
                    FmTicket.objects.filter(
                        is_deleted=False,
                        id=filters["ticket_id"],
                    ).select_related("building", "asset"),
                    user,
                    tenant_field="tenant_id",
                ).first()
            )
            if ticket is None:
                raise NotFound("Ticket not found for this tenant.")
            analysis = self._latest_analysis_for_ticket(user, ticket)

        return _case_fingerprint_from_ticket(ticket, analysis)

    def _ticket_candidates(self, user, filters: dict[str, Any], current: dict[str, Any]):
        qs = scope_queryset_to_user(
            FmTicket.objects.filter(
                is_deleted=False,
                status__in=TICKET_COMPLETED_STATUSES,
                updated_at__gte=filters["start"],
                updated_at__lte=filters["end"],
            )
            .exclude(id=current["case_id"])
            .select_related("building", "asset")
            .prefetch_related(
                Prefetch(
                    "ai_analyses",
                    queryset=AITicketAnalysis.objects.filter(
                        is_deleted=False,
                        status=AITicketAnalysis.Status.COMPLETED,
                    ).order_by("-completed_at", "-created_at"),
                    to_attr="prefetched_analyses",
                )
            ),
            user,
            tenant_field="tenant_id",
        )
        if filters["category"]:
            qs = qs.filter(category=filters["category"])
        if filters["priority"]:
            qs = qs.filter(priority=filters["priority"])
        if filters["status"]:
            qs = qs.filter(status=filters["status"])
        if filters["building"]:
            qs = qs.filter(building_id=filters["building"])
        if filters["asset"]:
            qs = qs.filter(asset_id=filters["asset"])
        return list(qs.order_by("-updated_at")[:CANDIDATE_LIMIT_PER_SOURCE])

    def _work_order_candidates(
        self, user, filters: dict[str, Any], current: dict[str, Any]
    ):
        qs = scope_queryset_to_user(
            MaintenanceWorkOrder.objects.filter(
                is_deleted=False,
                status__in=WORK_ORDER_COMPLETED_STATUSES,
                updated_at__gte=filters["start"],
                updated_at__lte=filters["end"],
            )
            .select_related("building", "asset")
            .filter(~Q(source_ticket_id=current["case_id"])),
            user,
            tenant_field="tenant_id",
        )
        if filters["priority"]:
            # Map ticket urgent → WO critical when filtering.
            priority = filters["priority"]
            if priority == FmTicket.Priority.URGENT:
                qs = qs.filter(priority=MaintenanceWorkOrder.Priority.CRITICAL)
            elif priority in MaintenanceWorkOrder.Priority.values:
                qs = qs.filter(priority=priority)
            else:
                qs = qs.none()
        if filters["status"]:
            qs = qs.filter(status=filters["status"])
        if filters["building"]:
            qs = qs.filter(building_id=filters["building"])
        if filters["asset"]:
            qs = qs.filter(asset_id=filters["asset"])
        if filters["category"]:
            # Work orders have no category; optional filter excludes them unless
            # keyword/category filters are not applied — keep accessible by skipping
            # hard exclusion so location/asset matches remain available.
            pass
        return list(qs.order_by("-updated_at")[:CANDIDATE_LIMIT_PER_SOURCE])

    def _inspection_candidates(self, user, filters: dict[str, Any]):
        qs = scope_queryset_to_user(
            Inspection.objects.filter(
                is_deleted=False,
                status__in=INSPECTION_COMPLETED_STATUSES,
                updated_at__gte=filters["start"],
                updated_at__lte=filters["end"],
            ).select_related("building"),
            user,
            tenant_field="tenant_id",
        )
        if filters["priority"]:
            priority = filters["priority"]
            if priority == FmTicket.Priority.URGENT:
                qs = qs.filter(priority=Inspection.Priority.CRITICAL)
            elif priority in Inspection.Priority.values:
                qs = qs.filter(priority=priority)
            else:
                qs = qs.none()
        if filters["status"]:
            qs = qs.filter(status=filters["status"])
        if filters["building"]:
            qs = qs.filter(building_id=filters["building"])
        if filters["asset"]:
            qs = qs.none()
        return list(qs.order_by("-updated_at")[:CANDIDATE_LIMIT_PER_SOURCE])

    def build(self, user, query_params) -> dict[str, Any]:
        filters = self.resolve_filters(query_params)
        weights = get_similarity_weights()
        current = self.resolve_current_case(user, filters)

        fingerprints: list[dict[str, Any]] = []
        source = filters["source"]

        if source in {"all", "fm_ticket"}:
            for ticket in self._ticket_candidates(user, filters, current):
                analyses = getattr(ticket, "prefetched_analyses", None) or []
                analysis = analyses[0] if analyses else None
                fingerprints.append(_case_fingerprint_from_ticket(ticket, analysis))

        if source in {"all", "maintenance_work_order"}:
            for work_order in self._work_order_candidates(user, filters, current):
                fingerprints.append(_case_fingerprint_from_work_order(work_order))

        if source in {"all", "inspection"}:
            for inspection in self._inspection_candidates(user, filters):
                fingerprints.append(_case_fingerprint_from_inspection(inspection))

        scored: list[dict[str, Any]] = []
        for fingerprint in fingerprints:
            score, reasons, components = compute_similarity(
                current, fingerprint, weights
            )
            if score < filters["min_similarity"]:
                continue
            if not reasons:
                continue
            card = _public_case_card(fingerprint)
            scored.append(
                {
                    **card,
                    "similarity_score": score,
                    "reasons": reasons,
                    "components": components,
                    "historical_outcome": _historical_outcome(fingerprint),
                    "updated_at": timezone.localtime(
                        fingerprint["updated_at"]
                    ).isoformat()
                    if fingerprint.get("updated_at")
                    else None,
                }
            )

        scored.sort(
            key=lambda item: (
                -int(item["similarity_score"]),
                item.get("updated_at") or "",
                item["reference"],
            )
        )
        top = scored[: filters["limit"]]
        top_score = top[0]["similarity_score"] if top else 0

        return {
            "period": {
                "start_date": _echo_bound(filters["start"]),
                "end_date": _echo_bound(filters["end"]),
                "preset": filters["period"],
                "inclusive": True,
                "max_range_days": MAX_DATE_RANGE_DAYS,
            },
            "filters": {
                "ticket_id": str(filters["ticket_id"])
                if filters["ticket_id"]
                else None,
                "analysis_id": str(filters["analysis_id"])
                if filters["analysis_id"]
                else None,
                "category": filters["category"],
                "priority": filters["priority"],
                "status": filters["status"],
                "building": str(filters["building"]) if filters["building"] else None,
                "asset": str(filters["asset"]) if filters["asset"] else None,
                "min_similarity": filters["min_similarity"],
                "limit": filters["limit"],
                "source": filters["source"],
            },
            "algorithm": {
                "version": ALGORITHM_VERSION,
                "name": ALGORITHM_NAME,
                "weights": weights,
                "note": (
                    "Rule-based Version 1 matcher. FO-092 may replace the scorer "
                    "with semantic/embedding search without changing this API contract."
                ),
            },
            "current_case": _public_case_card(current),
            "similar_cases": top,
            "summary": {
                "match_count": len(top),
                "candidate_evaluated": len(fingerprints),
                "min_similarity": filters["min_similarity"],
                "top_score": top_score,
            },
            "interpretation": {
                "note": (
                    "Similar cases are ranked by transparent rule-based similarity. "
                    "Results are informational only and never modify the current ticket. "
                    "Version 1 uses weighted rules only (no embeddings or vector search). "
                    "Soft-deleted and cross-tenant records are excluded. "
                    "Attachments, prompts, raw Gemini output, and identities are never exposed."
                ),
                "labels": {
                    "score": "Similarity Score",
                    "reasons": "Why Similar",
                    "outcome": "Historical Outcome",
                },
            },
            "generated_at": timezone.localtime().isoformat(),
        }


def build_ai_similar_cases(user, query_params) -> dict[str, Any]:
    return AISimilarCaseService().build(user, query_params)
