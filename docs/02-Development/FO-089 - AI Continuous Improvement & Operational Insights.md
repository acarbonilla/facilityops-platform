# FO-089 — AI Continuous Improvement & Operational Insights

**Status:** Complete; Draft PR ready  
**Date:** 2026-08-04  
**Base:** `main` @ `b4d2cb5dd6b6f5982ab83130fce21f7467288dc7` (FO-088 baseline)  
**Branch:** `feature/fo-089-ai-operational-insights`  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Transform FO-088 recommendation analytics into rule-based operational insights for Facilities Managers. Insights are **observational only**. FacilityOps never auto-retrains models, changes prompts, mutates tickets/categories/priorities, assigns technicians, creates work orders, or alters AI confidence.

## Architecture

- Service: `apps/fm_tickets/ai_operational_insights_service.py` → `AIOperationalInsightsService`
- Reuses FO-088 `build_ai_recommendation_analytics` for current and previous periods (no duplicate rate calculations)
- Endpoint: `GET /api/reporting/ai-operational-insights/`
- Permission: `reporting.view`
- Frontend: `/reporting/ai-operational-insights`

## AI Operational Health formula

Informational score **0–100** (not model accuracy):

```
score = round(
    W_a * acceptance_component
  + W_g * agreement_component
  + W_p * pending_component
  + W_c * confidence_component
)
```

| Component | Definition | Neutral when unavailable |
| --------- | ---------- | ------------------------ |
| Acceptance | `acceptance_rate * 100` when `reviewed_count > 0` | 50 |
| Agreement | `full_agreement_rate * 100` when sample size > 0 | 50 |
| Pending throughput | `100 * (1 - pending/recommendation_count)` when volume > 0 | 50 |
| Confidence | `average_confidence` (0–100) when present | 50 |

Default weights (normalized to sum 1.0): **0.30 / 0.30 / 0.20 / 0.20**.

Bands (configurable): Healthy ≥ 75; Needs Review ≥ 50; Attention &lt; 50.

## Insight rules (examples)

| Rule | Condition | Insight |
| ---- | --------- | ------- |
| High acceptance | acceptance ≥ `high_acceptance_rate` | High AI Acceptance |
| Low acceptance | acceptance ≤ `low_acceptance_rate` | Low AI Acceptance |
| High override | modification ≥ `high_override_rate` | High Override Rate |
| Category corrections | top category override present | Frequently Corrected Categories |
| Priority corrections | top priority override present | Frequently Corrected Priorities |
| Low confidence | average confidence &lt; threshold | Low Confidence Recommendations |
| High-confidence accepts | accepted avg confidence ≥ threshold | High Confidence Accepted |
| Pending backlog | pending ≥ threshold | Recommendations Awaiting Review |
| Volume | count ≥/≤ volume thresholds | High/Low Recommendation Volume |
| Improvement | acceptance or agreement increasing | Rapid Improvement Trend |
| Decline | agreement decreasing | Declining Agreement Trend |

## Threshold defaults (Django settings / env)

| Setting | Default |
| ------- | ------- |
| `FACILITYOPS_AI_HIGH_OVERRIDE_RATE` | 0.40 |
| `FACILITYOPS_AI_LOW_ACCEPTANCE_RATE` | 0.40 |
| `FACILITYOPS_AI_HIGH_ACCEPTANCE_RATE` | 0.70 |
| `FACILITYOPS_AI_PENDING_REVIEW_COUNT` | 10 |
| `FACILITYOPS_AI_LOW_CONFIDENCE_THRESHOLD` | 50 |
| `FACILITYOPS_AI_HIGH_CONFIDENCE_THRESHOLD` | 75 |
| `FACILITYOPS_AI_HIGH_VOLUME_COUNT` | 50 |
| `FACILITYOPS_AI_LOW_VOLUME_COUNT` | 5 |
| `FACILITYOPS_AI_TREND_STABLE_DELTA` | 0.05 |
| `FACILITYOPS_AI_HEALTH_HEALTHY_MIN` | 75 |
| `FACILITYOPS_AI_HEALTH_NEEDS_REVIEW_MIN` | 50 |
| Health weights acceptance/agreement/pending/confidence | 0.30 / 0.30 / 0.20 / 0.20 |

## Trend analysis

Current inclusive period vs previous equivalent span immediately before.

Metrics: acceptance, override (modification), confidence, agreement, volume.  
Directions: Increasing / Stable / Decreasing (`|delta| ≤ trend_stable_delta` ⇒ Stable; confidence uses point delta = rate delta × 100).

## Recommendations

Informational management suggestions only (`actionable: false`). Examples: review category guidelines, review priority guidance, clear pending reviews. Never auto-executed.

## Security and privacy

- `reporting.view` required; Employee / unauthorized → 403
- Tenant scope via FO-088 analytics (client tenant IDs never trusted)
- No requester/employee names, prompts, images, attachment IDs, provider secrets, or raw Gemini payloads

## Frontend

- Health score, insight cards with accessible badges, trend table, recommendations, top overrides, pending summary, manager-notes placeholder
- Loading / empty / error states; responsive layout

## Tests

- Backend: `apps/fm_tickets/test_ai_operational_insights.py`
- Frontend: `lib/reporting/ai-operational-insights.test.ts`

## Limitations

- No ML / model retraining / prompt tuning
- No automatic workflow mutation
- Manager notes are read-only placeholders
- No CSV/PDF export
- FO-090 not started

## Manual acceptance

- Environment: Local Django on PostgreSQL; isolated Tenant A/B fixtures
- Result: PASS (health, insights, recommendations, trends, permissions, tenant isolation)
- Defects: None

## Validation snapshot

- Focused FO-089 backend (PostgreSQL): **14 passed**
- FO-088 regression: **14 passed**
- FO-087 regression: **8 passed**
- Reporting regression: **86 passed**
- AI combo (FO-089–FO-085 focused): **63 passed**
- Focused FO-089 frontend: **8 passed**
- Full frontend suite: **348 passed / 0 failed**
- ESLint / TypeScript / production build: Passed (`/reporting/ai-operational-insights` present)
- Django check / makemigrations --check / git diff --check: Clean
- Secret scan: CLEAN
- FO-090: not started
