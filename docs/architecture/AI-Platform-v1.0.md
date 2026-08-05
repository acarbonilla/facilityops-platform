# AI Platform v1.0 — Architecture Snapshot

**Release:** AI Platform MVP / AI Platform v1.0  
**Milestone:** RM-001  
**Date:** 2026-08-05  
**Stable Main SHA:** `98c1661d60c8200ae85f717b13fe78bcda1dd716`  
**Type:** Architectural snapshot only (no redesign)

## Purpose

Capture the completed AI Platform architecture as frozen at FO-095 sign-off. This document does not propose changes.

## Pipeline Overview

```text
AI Foundation (FO-084)
  → Gemini Vision (FO-085)
  → Recommendations (FO-086)
  → Human Review (FO-087)
  → Analytics (FO-088)
  → Operational Insights (FO-089)
  → Attention Center (FO-090)
  → Similar Cases (FO-091)
  → Executive Dashboard (FO-092)
  → Administration (FO-093)
  → Production Monitoring (FO-094)
  → Production Readiness (FO-095)
```

## Major Services

| Layer | Primary service / surface |
| --- | --- |
| Foundation / queue | `AITicketAnalysis`, queue + Celery processing |
| Provider | Gemini / placeholder provider abstraction |
| Recommendations | Structured category/priority findings (advisory) |
| Human review | Decision endpoint; original AI output preserved |
| Analytics | Recommendation accuracy / agreement aggregates |
| Operational insights | Rule-based health and insight cards |
| Attention Center | Urgency scoring and informational queue |
| Similar Cases | Tenant-scoped weighted rule scoring (no embeddings) |
| Executive Dashboard | Orchestration of FO-088–090 (read-only) |
| Administration | `AIAdministrationService` (`settings.manage`) |
| Monitoring | `AIProductionMonitoringService` (informational alerts) |

## Data Flow

1. Authorized user creates/updates an FM Ticket and attaches images.
2. Analysis is queued asynchronously (`queued` → `processing` → `completed` / `failed`).
3. Provider returns structured findings; ticket fields are **not** auto-mutated.
4. Facilities staff review recommendations (accept / modify / ignore).
5. Decision history feeds analytics and downstream management views.
6. Administrators configure providers/flags/thresholds and audit changes.
7. Operators observe queue/runtime/health via monitoring (no auto-remediation).

## Human Review Workflow

- Recommendations are advisory only.
- Human review is mandatory before operational use of AI suggestions.
- Original AI result remains preserved; human decisions are recorded separately.
- AI cannot auto-change category, priority, status, assignment, work orders, or closure.

## Analytics Flow

Decision history → FO-088 analytics → FO-089 insights → FO-090 attention → FO-092 executive orchestration. Similar Cases (FO-091) remains a separate tenant-scoped knowledge/read path.

## Governance

- Centralized in FO-093 under `settings.manage`.
- Feature flags fail closed.
- Prompt registry is metadata-only (no prompt text).
- API keys are never editable or returned by admin APIs.
- Configuration changes are audited.

## Monitoring

- Centralized in FO-094 under `settings.manage`.
- Provider, queue, runtime, health aggregation, informational alerts.
- `remediation_automatic: false` — no worker restart, failover, or queue mutation.

## Executive Reporting

FO-092 provides a read-only executive dashboard that reuses existing services. Summaries are deterministic/rule-based; not a generative autonomous agent.

## Explicit Non-Goals (v1.0)

Embeddings, vector DB, RAG, token/cost accounting, Prometheus/Grafana/OpenTelemetry, automatic remediation/scaling, prompt editing, API-key management UI, model retraining.

## Next Feature

FO-096 — Intelligent Employee Ticket Intake (**not started**).
