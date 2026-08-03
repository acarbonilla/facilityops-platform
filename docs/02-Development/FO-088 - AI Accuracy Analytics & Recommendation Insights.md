# FO-088 — AI Accuracy Analytics & Recommendation Insights

**Status:** Complete; Draft PR ready  
**Date:** 2026-08-03  
**Base:** `main` @ `8dbf5a6938866e89e5a72b9e892273da8d09bd37` (FO-087 baseline)  
**Branch:** `feature/fo-088-ai-accuracy-analytics`  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Provide tenant-scoped management analytics for the FO-084–FO-087 AI recommendation workflow. FacilityOps measures how users respond to AI recommendations **without** retraining models or changing ticket workflows.

Analytics are informational only. Human agreement is a workflow metric, not ground-truth accuracy.

## Metric definitions

| Metric | Definition |
| ------ | ---------- |
| Recommendation volume | Completed analyses with `result_json.schema_name = FacilityRecommendationV1`. Excludes queued/processing/failed, soft-deleted rows, and non-recommendation payloads. Period filter uses inclusive `completed_at` bounds. |
| Reviewed | Decision in `accepted` \| `modified` \| `ignored`. |
| Pending review | Eligible recommendation with blank decision. |
| Acceptance rate | `accepted / reviewed` (0 when reviewed = 0). |
| Modification rate | `modified / reviewed`. |
| Ignore rate | `ignored / reviewed`. |
| Category agreement | Reviewed rows where mapped AI category == `final_category`, divided by reviewed rows with both values present. Ignored rows without finals are excluded. |
| Priority agreement | Same pattern for priority (Critical→urgent mapping applied). |
| Full agreement | Both category and priority match when both pairs are present. |
| Average confidence | Mean of FO-086 `overall_confidence` (0–100) for eligible rows. |
| Confidence bands | Low &lt;50; Medium 50–74; High 75–89; Very High 90–100. |
| Overrides | Modified rows where mapped recommendation ≠ final; grouped by AI label → final code. |

Rates are returned as fractions in `[0, 1]` rounded to 4 decimals. Confidence averages use 1 decimal.

### Interpretation limitations

Do **not** treat these metrics as:

- model accuracy against objective truth
- maintenance diagnosis accuracy
- safety/compliance accuracy
- universal category/priority correctness

Preferred labels: Category Agreement, Priority Agreement, Human Override Rate, Recommendation Acceptance. Avoid unqualified “AI Accuracy Score”.

## Backend

- Service: `apps/fm_tickets/ai_analytics_service.py` → `AIRecommendationAnalyticsService`
- Endpoint: `GET /api/reporting/ai-insights/`
- Permission: `reporting.view` (Employee role has no access)
- Tenant scope: `scope_queryset_to_user` before aggregation; client tenant IDs never trusted
- Date filters: `start_date`/`end_date` (aliases `date_from`/`date_to`), presets `last_7_days`, `last_30_days`, `last_90_days`, `current_year`
- Bounds: inclusive; max span 180 calendar days (aligned with Reporting)
- Additional filters: `decision`, `category`, `priority`, `severity`, `provider`, `model`
- Agreement mapping reuses FO-087 `map_ai_category_to_ticket` / `map_ai_priority_to_ticket`

No caching added (Reporting has no tenant-aware cache pattern). No new migration (existing indexes + bounded date range).

## Frontend

- Route: `/reporting/ai-insights` (requires `reporting.view`; hidden from Employee nav)
- Link from Reporting overview
- Sections: filters, summary cards, decision distribution (+ accessible table), trend table, category/priority overrides, confidence by decision + bands
- Empty copy: “No reviewed AI recommendations are available for this period.”
- Aggregates only — no requester identities, prompts, images, secrets, or raw Gemini payloads

## Security and privacy

- Unauthorized / Employee → 403
- Cross-tenant aggregates impossible via service scoping
- Response contains no employee names, decision-user PII, attachment IDs, or provider secrets

## No model retraining

FO-088 does not retrain Gemini, fine-tune models, auto-tune prompts/thresholds, mutate tickets/categories/priorities, or send analytics to Gemini.

## Tests

- Backend: `apps/fm_tickets/test_ai_analytics.py` (14 tests)
- Frontend: `lib/reporting/ai-insights.test.ts` (8 tests; suite 340)

## Validation snapshot

- Focused FO-088 backend: 14 passed
- AI + reporting regression: 128 passed
- Django check: clean
- makemigrations --check: no changes
- Frontend focused + full suite: 340 passed, 0 failed
- FO-089: not started

## Deferred

- Model improvement feedback loops
- CSV/PDF export
- New chart library
- Cross-tenant benchmarking
- Personal employee performance scoring
