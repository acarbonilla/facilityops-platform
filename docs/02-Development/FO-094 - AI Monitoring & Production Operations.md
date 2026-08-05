# FO-094 — AI Monitoring & Production Operations

**Status:** Implemented; Draft PR  
**Date:** 2026-08-05  
**Base:** `main` @ `432124f2f881e14cae4e8b6ea65ba492fac7e53c`  
**Branch:** `feature/fo-094-ai-monitoring-production`  
**PR:** [#60](https://github.com/acarbonilla/facilityops-platform/pull/60)  
**Phase:** Phase 12A — Application Development  
**Epic:** AI Monitoring & Production Operations

## Objective

Provide authorized AI administrators (`settings.manage`) with a centralized production monitoring dashboard for AI provider health, queue activity, runtime metrics, safe error categories, and rule-based informational alerts.

FO-094 is observability only. It never runs analysis, modifies FM Tickets or recommendations, retrains models, edits prompts, exposes secrets, or performs autonomous remediation.

## Architecture

```text
AIProductionMonitoringService
  ├── Provider Monitoring
  ├── Queue Monitoring
  ├── Runtime Statistics
  ├── Health Aggregation
  ├── Error Classification (safe categories)
  └── Informational Alert Engine
```

- Service: `apps/fm_tickets/ai_production_monitoring_service.py`
- Consumes: `AITicketAnalysis`, FO-093 `build_effective_config` / thresholds
- Permission: `settings.manage`
- No new migration (aggregates existing tables)
- FO-095 **not started**

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/ai/monitoring/` | Overview (provider, runtime, queue, health, alerts, recent activity) |
| GET | `/api/admin/ai/monitoring/runtime/` | Runtime metrics |
| GET | `/api/admin/ai/monitoring/queue/` | Queue metrics + recent activity |
| GET | `/api/admin/ai/monitoring/alerts/` | Alerts + health |

## Frontend

- Route: `/admin/ai/monitoring`
- Admin hub card + link from AI Administration
- Sections: Overview, Runtime, Queue, Alerts, Recent Activity, Error categories
- Health levels include visible text labels (Healthy / Warning / Critical / Unavailable)

## Queue / retrying

Database statuses remain `queued`, `processing`, `completed`, `failed`.  
**Retrying** is derived: `status=processing AND retryable=true`.

## Alerts

Informational only (`actionable: false`, `remediation_automatic: false`).  
Thresholds from Django settings (`FACILITYOPS_AI_MONITOR_*`) plus FO-093 override/acceptance rates where applicable.

## Privacy

Never exposes API keys, prompt text, Gemini raw responses, attachment/storage paths, ticket descriptions, requester/reviewer identities, stack traces, or environment variables.

## Validation snapshot

- Focused FO-094 backend: **8 / 8 passed**
- FO-094 + FO-093–089 smoke: **62 passed**
- Focused FO-094 frontend: **4 / 4 passed**
- Full frontend suite: **371 passed / 0 failed**
- ESLint / TypeScript / production build: Passed
- Django check / makemigrations --check: Clean (no new migration)
- FO-095: **not started**

## Limitations

- No Prometheus / Grafana / OpenTelemetry
- No cost / token billing
- No automatic recovery or worker restart
- FO-095 **not started**
