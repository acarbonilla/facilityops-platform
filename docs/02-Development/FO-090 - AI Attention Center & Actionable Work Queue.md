# FO-090 — AI Attention Center & Actionable Work Queue

**Status:** Complete; Draft PR ready  
**Date:** 2026-08-04  
**Base:** `feature/fo-089-ai-operational-insights` @ `ffd8ec7…` (FO-089 tip; `main` @ `b4d2cb5…`)  
**Branch:** `feature/fo-090-ai-attention-center`  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Consolidate FO-088/FO-089 analytics into a prioritized, informational attention queue for Facilities Managers. Observational only — never auto-modifies tickets, assignments, categories, priorities, work orders, prompts, or models.

## Architecture

- Service: `apps/fm_tickets/ai_attention_center_service.py` → `AIAttentionCenterService`
- Reuses FO-089 `build_ai_operational_insights` (which reuses FO-088 analytics)
- Endpoint: `GET /api/reporting/ai-attention-center/`
- Permission: `reporting.view`
- Frontend: `/reporting/ai-attention-center`

## Attention Urgency formula (0–100)

```
urgency = round(
    W_p * pending_component
  + W_o * override_component
  + W_h * health_inverse_component
  + W_t * trend_component
  + W_c * confidence_component
  + W_v * volume_component
)
```

| Component | Definition |
| --------- | ---------- |
| Pending | `min(100, pending / pending_threshold * 100)` |
| Override | `modification_rate * 100` when reviewed > 0 |
| Health inverse | `100 - AI Operational Health` |
| Trend | 100 if override↑ or acceptance↓; 50 if other non-stable; else 0 |
| Confidence | `min(100, max(0, -confidence_delta))` when confidence decreasing |
| Volume | `min(100, recommendation_count / high_volume_count * 100)` |

Default weights (normalized): **0.25 / 0.20 / 0.20 / 0.15 / 0.10 / 0.10**.

### Attention levels

| Level | Score |
| ----- | ----- |
| Critical | ≥ 80 |
| High | ≥ 60 |
| Medium | ≥ 40 |
| Low | &lt; 40 |

## Attention rules (examples)

High Override Rate · Large Pending Review Queue · Long-Unreviewed AI Recommendations · Rapid Confidence Drop · Repeated Category/Priority Corrections · High Volume Critical Recommendations · Low AI Operational Health · Increasing Override Trend · Decreasing Acceptance Trend

## Suggested actions

Informational only (`actionable: false`). Examples: review AI backlog, investigate overrides, review category/priority guidance.

## Security / privacy

- `reporting.view`; Employee / unauthorized → 403
- Tenant scope via FO-089/FO-088
- No identities, prompts, attachments, secrets, or raw Gemini payloads

## Limitations

- No automation / ML / prompt tuning
- Branch stacked on FO-089 Draft PR #55 (not yet on `main`)
- FO-091 not started

## Validation snapshot

- Focused FO-090 backend (PostgreSQL): **11 passed**
- FO-089 regression: **14 passed**
- FO-088 regression: **14 passed**
- Reporting regression: **86 passed**
- AI combo (FO-090–FO-085 focused): **74 passed**
- Focused FO-090 frontend: **6 passed**
- Full frontend suite: **354 passed / 0 failed** (expected 348+6)
- ESLint / TypeScript / production build: Passed (`/reporting/ai-attention-center` present)
- Django check / makemigrations --check: Clean
- FO-091: not started

## Manual acceptance

- Environment: Local Django on PostgreSQL; isolated Tenant A/B fixtures
- Result: **PASS** (queue, urgency ordering, permissions, tenant isolation)
- Defects: None
