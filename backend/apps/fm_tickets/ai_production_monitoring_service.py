"""FO-094 AI Production Monitoring — operational observability only.

Provides provider, queue, runtime, health, and alert visibility for AI
administrators. Does not run analysis, mutate tickets, retrain models,
edit prompts, expose secrets, or perform autonomous remediation.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils import timezone

from apps.fm_tickets.ai.errors import AIErrorCode
from apps.fm_tickets.ai_administration_service import (
    assert_ai_admin,
    build_effective_config,
    get_runtime_setting,
)
from apps.fm_tickets.models import AITicketAnalysis

# Safe error categories — never expose raw exceptions or stack traces.
ERROR_CATEGORY_TIMEOUT = "timeout"
ERROR_CATEGORY_PROVIDER_UNAVAILABLE = "provider_unavailable"
ERROR_CATEGORY_VALIDATION = "validation_failure"
ERROR_CATEGORY_RETRY_EXHAUSTED = "retry_exhausted"
ERROR_CATEGORY_CONFIGURATION = "configuration_error"
ERROR_CATEGORY_OTHER = "other"

ERROR_CODE_CATEGORIES = {
    AIErrorCode.PROVIDER_TIMEOUT: ERROR_CATEGORY_TIMEOUT,
    AIErrorCode.PROVIDER_UNAVAILABLE: ERROR_CATEGORY_PROVIDER_UNAVAILABLE,
    AIErrorCode.PROVIDER_RATE_LIMITED: ERROR_CATEGORY_PROVIDER_UNAVAILABLE,
    AIErrorCode.PROVIDER_NOT_CONFIGURED: ERROR_CATEGORY_CONFIGURATION,
    AIErrorCode.PROVIDER_AUTH_FAILED: ERROR_CATEGORY_CONFIGURATION,
    AIErrorCode.NO_VALID_IMAGES: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.UNSUPPORTED_IMAGE_TYPE: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.IMAGE_LIMIT_EXCEEDED: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.INPUT_TOO_LARGE: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.SCHEMA_VALIDATION_FAILED: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.INVALID_PROVIDER_RESPONSE: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.SAFETY_BLOCKED: ERROR_CATEGORY_VALIDATION,
    AIErrorCode.STORAGE_READ_FAILED: ERROR_CATEGORY_OTHER,
    AIErrorCode.ANALYSIS_INTERNAL_ERROR: ERROR_CATEGORY_OTHER,
}

HEALTH_HEALTHY = "healthy"
HEALTH_WARNING = "warning"
HEALTH_CRITICAL = "critical"
HEALTH_UNAVAILABLE = "unavailable"

HEALTH_LABELS = {
    HEALTH_HEALTHY: "Healthy",
    HEALTH_WARNING: "Warning",
    HEALTH_CRITICAL: "Critical",
    HEALTH_UNAVAILABLE: "Unavailable",
}

RECENT_ACTIVITY_LIMIT = 25


def _setting(name: str, default: float | int) -> float | int:
    return getattr(settings, name, default)


def classify_error_code(error_code: str | None) -> str:
    if not error_code:
        return ERROR_CATEGORY_OTHER
    return ERROR_CODE_CATEGORIES.get(error_code, ERROR_CATEGORY_OTHER)


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(float(numerator) / float(denominator), 4)


def _health_payload(status: str) -> dict[str, str]:
    return {
        "status": status,
        "status_label": HEALTH_LABELS.get(status, status.title()),
    }


def _analysis_queryset(user):
    qs = AITicketAnalysis.objects.all()
    tenant = getattr(user, "tenant", None)
    scope = "global"
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
        scope = "tenant"
    return qs, scope


def _retrying_filter() -> Q:
    """Derived retrying state — DB has no dedicated retrying status."""
    return Q(
        status=AITicketAnalysis.Status.PROCESSING,
        retryable=True,
        attempt_count__gte=1,
    )


def _monitoring_thresholds() -> dict[str, float | int]:
    """Configurable alert thresholds (Django settings; FO-093 rates reused)."""
    effective = build_effective_config()
    thresholds = effective["thresholds"]
    return {
        "failure_rate_warning": float(
            _setting("FACILITYOPS_AI_MONITOR_FAILURE_RATE_WARNING", 0.15)
        ),
        "failure_rate_critical": float(
            _setting("FACILITYOPS_AI_MONITOR_FAILURE_RATE_CRITICAL", 0.30)
        ),
        "retry_rate_warning": float(
            _setting("FACILITYOPS_AI_MONITOR_RETRY_RATE_WARNING", 0.20)
        ),
        "timeout_rate_warning": float(
            _setting("FACILITYOPS_AI_MONITOR_TIMEOUT_RATE_WARNING", 0.10)
        ),
        "queue_backlog_warning": int(
            _setting("FACILITYOPS_AI_MONITOR_QUEUE_BACKLOG_WARNING", 10)
        ),
        "queue_backlog_critical": int(
            _setting("FACILITYOPS_AI_MONITOR_QUEUE_BACKLOG_CRITICAL", 50)
        ),
        "override_warning_rate": float(thresholds["override_warning_rate"]),
        "acceptance_healthy_rate": float(thresholds["acceptance_healthy_rate"]),
        "provider_timeout_seconds": int(
            get_runtime_setting("FACILITYOPS_GEMINI_TIMEOUT_SECONDS", 60)
        ),
    }


class AIProductionMonitoringService:
    """Central FO-094 production monitoring orchestration."""

    def get_overview(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        provider = self._provider_snapshot()
        queue = self._queue_metrics(user)
        runtime = self._runtime_metrics(user)
        health = self._aggregate_health(provider, queue, runtime)
        alerts = self._build_alerts(provider, queue, runtime, health)
        qs, scope = _analysis_queryset(user)
        return {
            "scope": scope,
            "overview": {
                "provider": provider["provider"],
                "model": provider["model"],
                "enabled": provider["enabled"],
                "provider_available": provider["provider_available"],
                "health": health,
            },
            "provider": provider,
            "runtime": runtime,
            "queue": queue,
            "health": health,
            "alerts": alerts,
            "recent_activity": self._recent_activity(qs),
            "error_categories": self._error_category_counts(qs),
            "thresholds_used": _monitoring_thresholds(),
            "interpretation": {
                "note": (
                    "FO-094 monitoring is informational only. It never runs analysis, "
                    "modifies tickets, remediates failures, or exposes secrets."
                ),
                "retrying_definition": (
                    "retrying = status processing AND retryable=true "
                    "(no dedicated retrying status in the database)."
                ),
            },
            "generated_at": timezone.localtime().isoformat(),
        }

    def get_runtime(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        qs, scope = _analysis_queryset(user)
        return {
            "scope": scope,
            "runtime": self._runtime_metrics(user),
            "error_categories": self._error_category_counts(qs),
            "generated_at": timezone.localtime().isoformat(),
        }

    def get_queue(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        qs, scope = _analysis_queryset(user)
        return {
            "scope": scope,
            "queue": self._queue_metrics(user),
            "recent_activity": self._recent_activity(qs),
            "generated_at": timezone.localtime().isoformat(),
        }

    def get_alerts(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        provider = self._provider_snapshot()
        queue = self._queue_metrics(user)
        runtime = self._runtime_metrics(user)
        health = self._aggregate_health(provider, queue, runtime)
        alerts = self._build_alerts(provider, queue, runtime, health)
        _, scope = _analysis_queryset(user)
        return {
            "scope": scope,
            "health": health,
            "alerts": alerts,
            "thresholds_used": _monitoring_thresholds(),
            "remediation": {
                "automatic": False,
                "note": "Alerts are informational. Human operators decide all remediation.",
            },
            "generated_at": timezone.localtime().isoformat(),
        }

    def _provider_snapshot(self) -> dict[str, Any]:
        effective = build_effective_config()
        provider = effective["provider"]
        name = provider["provider"]
        enabled = bool(provider["enabled"]) or name == "placeholder"
        api_key_ok = bool(provider["api_key_configured"])
        if name in {"gemini", "gemini_vision"} and not api_key_ok:
            available = False
            availability_label = "Unavailable — API key not configured"
        elif not enabled:
            available = False
            availability_label = "Disabled"
        else:
            available = True
            availability_label = "Available"
        return {
            "provider": name,
            "model": provider["model"] or name,
            "enabled": enabled,
            "api_key_configured": api_key_ok,
            "provider_available": available,
            "provider_availability_label": availability_label,
            "timeout_seconds": provider["timeout_seconds"],
            "retry_attempts": provider["retry_attempts"],
            "feature_image_analysis": effective["feature_flags"]["image_analysis"],
        }

    def _queue_metrics(self, user) -> dict[str, Any]:
        qs, _ = _analysis_queryset(user)
        aggregates = qs.aggregate(
            queued=Count("id", filter=Q(status=AITicketAnalysis.Status.QUEUED)),
            processing=Count(
                "id", filter=Q(status=AITicketAnalysis.Status.PROCESSING)
            ),
            completed=Count(
                "id", filter=Q(status=AITicketAnalysis.Status.COMPLETED)
            ),
            failed=Count("id", filter=Q(status=AITicketAnalysis.Status.FAILED)),
            retrying=Count("id", filter=_retrying_filter()),
        )
        queued = aggregates["queued"] or 0
        processing = aggregates["processing"] or 0
        retrying = aggregates["retrying"] or 0
        backlog = queued + processing
        return {
            "queued": queued,
            "processing": processing,
            "completed": aggregates["completed"] or 0,
            "failed": aggregates["failed"] or 0,
            "retrying": retrying,
            "backlog": backlog,
            "depth": backlog,
        }

    def _runtime_metrics(self, user) -> dict[str, Any]:
        qs, _ = _analysis_queryset(user)
        now = timezone.now()
        start_of_day = timezone.localtime(now).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        total = qs.count()
        today = qs.filter(queued_at__gte=start_of_day).count()
        completed = qs.filter(status=AITicketAnalysis.Status.COMPLETED).count()
        failed = qs.filter(status=AITicketAnalysis.Status.FAILED).count()
        finished = completed + failed
        timeouts = qs.filter(
            status=AITicketAnalysis.Status.FAILED,
            error_code=AIErrorCode.PROVIDER_TIMEOUT,
        ).count()
        retries = qs.filter(attempt_count__gte=2).count()
        retrying_now = qs.filter(_retrying_filter()).count()

        avg_duration = qs.filter(
            status=AITicketAnalysis.Status.COMPLETED,
            duration_ms__isnull=False,
        ).aggregate(avg=Avg("duration_ms"))["avg"]

        wait_qs = qs.filter(
            started_at__isnull=False,
            queued_at__isnull=False,
        ).annotate(
            wait=ExpressionWrapper(
                F("started_at") - F("queued_at"),
                output_field=DurationField(),
            )
        )
        avg_wait = wait_qs.aggregate(avg=Avg("wait"))["avg"]
        avg_wait_ms = None
        if avg_wait is not None:
            avg_wait_ms = int(avg_wait.total_seconds() * 1000)

        return {
            "total_analyses": total,
            "analyses_today": today,
            "completed": completed,
            "failed": failed,
            "finished": finished,
            "success_rate": _safe_rate(completed, finished),
            "failure_rate": _safe_rate(failed, finished),
            "retry_rate": _safe_rate(retries, total),
            "timeout_rate": _safe_rate(timeouts, finished),
            "retrying_now": retrying_now,
            "average_duration_ms": int(avg_duration) if avg_duration is not None else None,
            "average_queue_wait_ms": avg_wait_ms,
        }

    def _error_category_counts(self, qs) -> dict[str, int]:
        counts = {
            ERROR_CATEGORY_TIMEOUT: 0,
            ERROR_CATEGORY_PROVIDER_UNAVAILABLE: 0,
            ERROR_CATEGORY_VALIDATION: 0,
            ERROR_CATEGORY_RETRY_EXHAUSTED: 0,
            ERROR_CATEGORY_CONFIGURATION: 0,
            ERROR_CATEGORY_OTHER: 0,
        }
        failed = qs.filter(status=AITicketAnalysis.Status.FAILED).values_list(
            "error_code", "attempt_count", "retryable"
        )
        max_attempts = int(get_runtime_setting("FACILITYOPS_AI_MAX_ATTEMPTS", 3))
        for error_code, attempt_count, retryable in failed:
            category = classify_error_code(error_code)
            if (
                not retryable
                and attempt_count
                and int(attempt_count) >= max_attempts
                and category
                in {
                    ERROR_CATEGORY_TIMEOUT,
                    ERROR_CATEGORY_PROVIDER_UNAVAILABLE,
                    ERROR_CATEGORY_OTHER,
                }
            ):
                counts[ERROR_CATEGORY_RETRY_EXHAUSTED] += 1
            else:
                counts[category] += 1
        return counts

    def _recent_activity(self, qs) -> list[dict[str, Any]]:
        """Safe recent jobs — no identities, ticket text, paths, or raw errors."""
        rows = qs.order_by("-queued_at")[:RECENT_ACTIVITY_LIMIT]
        activity = []
        for row in rows:
            derived_status = row.status
            if (
                row.status == AITicketAnalysis.Status.PROCESSING
                and row.retryable
                and row.attempt_count >= 1
            ):
                derived_status = "retrying"
            activity.append(
                {
                    "id": str(row.id),
                    "status": derived_status,
                    "status_label": derived_status.replace("_", " ").title(),
                    "error_category": (
                        classify_error_code(row.error_code)
                        if row.status == AITicketAnalysis.Status.FAILED
                        else None
                    ),
                    "attempt_count": row.attempt_count,
                    "duration_ms": row.duration_ms,
                    "queued_at": row.queued_at.isoformat() if row.queued_at else None,
                    "completed_at": (
                        row.completed_at.isoformat() if row.completed_at else None
                    ),
                    "provider": row.provider or "",
                    "model_name": row.model_name or "",
                }
            )
        return activity

    def _aggregate_health(
        self,
        provider: dict[str, Any],
        queue: dict[str, Any],
        runtime: dict[str, Any],
    ) -> dict[str, Any]:
        thresholds = _monitoring_thresholds()
        provider_health = HEALTH_HEALTHY
        if not provider["provider_available"]:
            provider_health = HEALTH_UNAVAILABLE
        elif not provider["feature_image_analysis"]:
            provider_health = HEALTH_WARNING
        elif not provider["enabled"]:
            provider_health = HEALTH_UNAVAILABLE

        backlog = queue["backlog"]
        if backlog >= thresholds["queue_backlog_critical"]:
            queue_health = HEALTH_CRITICAL
        elif backlog >= thresholds["queue_backlog_warning"]:
            queue_health = HEALTH_WARNING
        else:
            queue_health = HEALTH_HEALTHY

        # Worker heuristic: large processing set with zero completions today
        # and high backlog suggests workers may be offline.
        worker_health = HEALTH_HEALTHY
        if queue["processing"] >= thresholds["queue_backlog_warning"] and runtime[
            "analyses_today"
        ] == 0 and queue["queued"] >= thresholds["queue_backlog_warning"]:
            worker_health = HEALTH_CRITICAL
        elif queue["retrying"] >= thresholds["queue_backlog_warning"]:
            worker_health = HEALTH_WARNING

        failure_rate = runtime["failure_rate"]
        if failure_rate >= thresholds["failure_rate_critical"]:
            ai_health = HEALTH_CRITICAL
        elif failure_rate >= thresholds["failure_rate_warning"]:
            ai_health = HEALTH_WARNING
        elif provider_health == HEALTH_UNAVAILABLE:
            ai_health = HEALTH_UNAVAILABLE
        else:
            ai_health = HEALTH_HEALTHY

        overall = HEALTH_HEALTHY
        for candidate in (
            provider_health,
            queue_health,
            worker_health,
            ai_health,
        ):
            overall = _worse_health(overall, candidate)

        return {
            "overall": _health_payload(overall),
            "provider": _health_payload(provider_health),
            "queue": _health_payload(queue_health),
            "worker": _health_payload(worker_health),
            "ai": _health_payload(ai_health),
        }

    def _build_alerts(
        self,
        provider: dict[str, Any],
        queue: dict[str, Any],
        runtime: dict[str, Any],
        health: dict[str, Any],
    ) -> list[dict[str, Any]]:
        thresholds = _monitoring_thresholds()
        alerts: list[dict[str, Any]] = []

        def add(
            code: str,
            title: str,
            severity: str,
            message: str,
        ) -> None:
            alerts.append(
                {
                    "code": code,
                    "title": title,
                    "severity": severity,
                    "severity_label": HEALTH_LABELS.get(severity, severity.title()),
                    "message": message,
                    "actionable": False,
                    "remediation_automatic": False,
                }
            )

        if not provider["enabled"]:
            add(
                "provider_disabled",
                "Provider Disabled",
                HEALTH_CRITICAL,
                "The AI provider is disabled. New analysis will not run.",
            )
        if not provider["provider_available"] and provider["enabled"]:
            add(
                "provider_unavailable",
                "Provider Unavailable",
                HEALTH_UNAVAILABLE,
                "The configured AI provider is unavailable (configuration or connectivity).",
            )
        if not provider["feature_image_analysis"]:
            add(
                "configuration_issue",
                "Configuration Issue",
                HEALTH_WARNING,
                "Image analysis feature flag is disabled. Analysis requests fail closed.",
            )
        if runtime["failure_rate"] >= thresholds["failure_rate_critical"]:
            add(
                "high_failure_rate",
                "High Failure Rate",
                HEALTH_CRITICAL,
                "Failure rate exceeds the critical monitoring threshold.",
            )
        elif runtime["failure_rate"] >= thresholds["failure_rate_warning"]:
            add(
                "high_failure_rate",
                "Elevated Failure Rate",
                HEALTH_WARNING,
                "Failure rate exceeds the warning monitoring threshold.",
            )
        if runtime["retry_rate"] >= thresholds["retry_rate_warning"]:
            add(
                "high_retry_rate",
                "High Retry Rate",
                HEALTH_WARNING,
                "Retry rate exceeds the configured monitoring threshold.",
            )
        if runtime["timeout_rate"] >= thresholds["timeout_rate_warning"]:
            add(
                "provider_timeout_increase",
                "Provider Timeout Increase",
                HEALTH_WARNING,
                "Timeout rate exceeds the configured monitoring threshold.",
            )
        if queue["backlog"] >= thresholds["queue_backlog_critical"]:
            add(
                "queue_backlog",
                "Queue Backlog",
                HEALTH_CRITICAL,
                "Queue backlog exceeds the critical monitoring threshold.",
            )
        elif queue["backlog"] >= thresholds["queue_backlog_warning"]:
            add(
                "queue_backlog",
                "Queue Backlog",
                HEALTH_WARNING,
                "Queue backlog exceeds the warning monitoring threshold.",
            )
        if health["worker"]["status"] == HEALTH_CRITICAL:
            add(
                "worker_offline",
                "Worker Offline",
                HEALTH_CRITICAL,
                "Processing backlog with no recent completions suggests workers may be offline.",
            )
        # Reuse FO-093 override warning rate as an elevated-ops signal on failure rate.
        if runtime["failure_rate"] >= thresholds["override_warning_rate"]:
            if not any(a["code"] == "high_failure_rate" for a in alerts):
                add(
                    "high_failure_rate",
                    "Failure Rate Above Override Warning",
                    HEALTH_WARNING,
                    "Failure rate exceeds the FO-093 override warning rate threshold.",
                )

        return alerts


def _worse_health(current: str, candidate: str) -> str:
    rank = {
        HEALTH_HEALTHY: 0,
        HEALTH_WARNING: 1,
        HEALTH_CRITICAL: 2,
        HEALTH_UNAVAILABLE: 3,
    }
    return candidate if rank.get(candidate, 0) > rank.get(current, 0) else current


def get_monitoring_overview(user) -> dict[str, Any]:
    return AIProductionMonitoringService().get_overview(user)


def get_monitoring_runtime(user) -> dict[str, Any]:
    return AIProductionMonitoringService().get_runtime(user)


def get_monitoring_queue(user) -> dict[str, Any]:
    return AIProductionMonitoringService().get_queue(user)


def get_monitoring_alerts(user) -> dict[str, Any]:
    return AIProductionMonitoringService().get_alerts(user)
