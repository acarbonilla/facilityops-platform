# FO-092 — Executive AI Dashboard

**Status:** Ready for Review (FO-092A acceptance PASS)  
**Date:** 2026-08-04  
**Base:** `main` @ `d5751ee6ba1ecdbf0697c022cef994b370b2c871`  
**Branch:** `feature/fo-092-executive-ai-dashboard`  
**PR:** [#58](https://github.com/acarbonilla/facilityops-platform/pull/58)  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Provide authorized executives and Facilities leaders with a consolidated, tenant-scoped, read-only Executive AI Dashboard that orchestrates FO-088 analytics, FO-089 operational insights, FO-090 attention center, and FO-091 knowledge indicators (where supported) into one management view.

FO-092 is reporting and decision support only. It never modifies FM Tickets, accepts/rejects recommendations, changes category/priority, assigns technicians, creates work orders or inspections, retrains models, edits prompts, or triggers autonomous actions.

## Architecture

```text
ExecutiveAIDashboardService / build_executive_ai_dashboard
        │
        ├── FO-088 build_ai_recommendation_analytics
        ├── FO-089 build_ai_operational_insights
        ├── FO-090 build_ai_attention_center
        └── FO-091 knowledge_summary (deferred usage metrics)
```

- Service: `apps/fm_tickets/executive_ai_dashboard_service.py`
- Endpoint: `GET /api/reporting/ai-executive-dashboard/`
- Permission: `reporting.view`
- Frontend: `/reporting/ai-executive-dashboard`
- No new Gemini call; no generative summary; no caching; no migration

### Service reuse

FO-092 does **not** reimplement FO-088/089/090 rate math. It calls the existing builders and selects/assembles executive fields.

**Query-cost note (V1):** FO-090 already nests FO-089→FO-088. FO-092 additionally calls FO-089 and FO-088 once for comparison/trend/override fields FO-090 does not fully echo. Approximate orchestration = 1× FO-090 + 1× FO-089 + 1× FO-088 (FO-090 internally adds further FO-088/089 work). Acceptable for V1; no premature cache.

## KPI definitions

| KPI | Source | Definition |
| --- | ------ | ---------- |
| Completed analyses | FO-088 `recommendation_count` | Completed FacilityRecommendationV1 analyses in period |
| Recommendations generated | FO-088 | Same as completed analyses (V1) |
| Reviewed / pending / accepted / modified / ignored | FO-088 | Human review outcome counts |
| Acceptance / override / ignore rates | FO-088 | Rates over reviewed (override = modification rate) |
| Category / priority / full agreement | FO-088 | Agreement among rows with finals |
| Average confidence | FO-088 | Mean overall confidence |
| AI Operational Health | FO-089 | Health score/band/label |
| Attention Urgency | FO-090 | Urgency score/level |
| Critical / high attention counts | FO-090 | Attention summary |

## Executive-summary rules

Deterministic, rule-based only (`_build_executive_summary`):

- **Empty:** no volume → Stable + empty headline
- **Needs Attention:** health band attention, critical urgency, urgency ≥ 80, critical items, rising pending ≥ 10, override ≥ 0.40 (unless decreasing), or acceptance < 0.35
- **Healthy:** healthy band, urgency < 60, acceptance ≥ 0.55, no critical items, pending < 10, acceptance trend increase/stable
- Else **Stable**

Claims are limited to adoption, review outcomes, health, and attention. Never claims accuracy, employee performance, or compliance.

## Period-comparison logic

Compares selected period vs immediately preceding equal-length period via FO-089 trends/comparison where available.

| Direction | Rule |
| --------- | ---- |
| Stable | rate Δ ≤ ±0.05; confidence Δ ≤ ±2.0; count Δ = 0 |
| Increase / Decrease | otherwise |

Documented in `period_comparison.stable_tolerance`. Some agreement/ignore previous values may be current-only when FO-089 does not expose them.

## Filters

Date bounds reuse reporting conventions (tenant timezone, inclusive, max 180 days). Optional: `decision`, `category`, `priority` forwarded to underlying services. Unsupported filters for a nested section behave as that service already documents.

## API contract

`GET /api/reporting/ai-executive-dashboard/`

Response (validated by `ExecutiveAIDashboardSerializer`):

- `period` (current + previous bounds)
- `summary` (executive KPIs)
- `executive_summary` (status, headline, details, positive/concern/review)
- `period_comparison`
- `decision_distribution` / `decision_trend`
- `confidence_by_decision` / `confidence_bands`
- `top_category_overrides` / `top_priority_overrides`
- `attention_summary` / `operational_health` / `operational_insights`
- `knowledge_summary` (deferred search-usage; corpus proxies only)
- `interpretation` / `generated_at`

## Permission model

- Requires authenticated user + `reporting.view`
- Employee Requester and unauthorized operational users → 403
- No new permission code

## Tenant isolation

All underlying services use existing tenant-scoped querysets. Tenant A never sees Tenant B metrics.

## Privacy

Aggregated only. No employee/requester/reviewer identities, emails, phones, attachment names/IDs, image content, prompts, raw Gemini, provider secrets, storage paths, or ticket descriptions.

## Knowledge reuse

FO-091 does not persist search-usage telemetry. `knowledge_summary.status = "deferred"`. Shows corpus proxies from FO-088 + link to Similar Cases UI. No invented usage statistics.

## Frontend layout

Route: `/reporting/ai-executive-dashboard` (reporting nav link from overview).

Sections: filters, executive summary, primary KPIs (health, urgency, acceptance, pending), secondary KPIs, period comparison, decision distribution, agreement/confidence/trend table, overrides, operational health & attention, deferred knowledge.

Uses existing LoadingState / EmptyState / ErrorState. CSS bars + tables (no new chart library). Status labels include visible text (not color alone).

## Accessibility & responsive

Semantic headings, keyboard filters, focus rings, SR captions on tables, text status badges. Desktop multi-column; tablet two-column; mobile single-column with horizontal-safe tables.

## Database / dependencies

- No migration
- No new Python/JS dependencies
- No caching

## Limitations

- Nested FO-090/089/088 query cost (V1)
- Knowledge search-usage deferred
- Some comparison previous values current-only when upstream omits them
- Helper-level frontend tests only (repo pattern)
- FO-093 **not started**

## Validation snapshot

- Focused FO-092 backend (PostgreSQL keepdb): **9 / 9 passed**
- FO-091–088 + FO-092 combo: **60 / 60 passed**
- Reporting regression: **86 passed**
- AI + reporting combo (reporting + FO-087/086/085 analysis): **110 passed**
- Focused FO-092 frontend helpers: **4 passed**
- Full frontend suite: **364 passed / 0 failed**
- ESLint / TypeScript / production build: Passed (`/reporting/ai-executive-dashboard` present)
- Django check / makemigrations --check: Clean
- Manual acceptance (FO-092A): **PASS** — see `FO-092A - Finalize Merge and Post-Merge Verification.md`
- FO-093: **not started**

## Manual acceptance

- Date: 2026-08-04
- Environment: Local Django on PostgreSQL; Tenant A/B fixtures; UI/API code-path review
- Result: **PASS**
- Defects: None
- See `FO-092A - Finalize Merge and Post-Merge Verification.md`

## Explicit exclusions

No embeddings, vector DB, RAG, retraining, prompt UI, automated actions, exports, scheduled emails, FO-093.
