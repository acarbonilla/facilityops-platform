# FO-100 — Reporting & Analytics Alignment

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-05  
**Branch:** `feature/intelligent-employee-intake`  
**Previous checkpoint:** FO-099 (`761eb8e…`)  
**Implementation tip:** see branch HEAD after FO-100 commits  
**Next:** FO-101 — Intelligent Intake QA and Production Readiness (**not started**)  
**PR policy:** No standalone FO-100 PR; feature remains unmerged until FO-101A

## 1. Objective

Align FO-088–092 reporting and the operational overview with Intelligent Employee Intake (FO-096–099) so metrics understand unclassified tickets, pending-review priority, nullable building, and AI-ready awaiting classification — without redesigning dashboards, analytics, or visualization frameworks.

## 2. Naming clarification (critical)

| Metric / field | Meaning |
| --- | --- |
| `pending_review_count` (FO-088+) | AI decision backlog (empty FO-087 human decision) |
| Ticket `priority=pending_review` | Awaiting FM operational classification (FO-096) |
| `ai_ready_awaiting_classification_count` | Completed AI + incomplete classification |
| `unclassified_count` / `pending_classification_count` | Ticket category / priority intake states |
| `employee_intake_count` | Web-sourced tickets still in unclassified + pending_review |

UI labels disambiguate: **AI Decision Pending** vs **AI Ready · Awaiting Classification** vs ticket **Pending Review** priority.

## 3. Reporting discovery (affected surfaces)

| Module | Alignment |
| --- | --- |
| FM reporting overview (`build_ticket_summary`) | Intake counts on ticket summary |
| FO-088 AI Analytics | Intake fields on records; agreement skips non-operational finals; new summary keys |
| FO-089 Operational Insights | Reuses AI pending semantics; does not treat raw submission volume as health failure |
| FO-090 Attention Center | Classification backlog / delay / AI-ready awaiting FM items |
| FO-091 Similar Cases | Excludes unclassified / pending_review completed tickets from historical candidates |
| FO-092 Executive Dashboard | Passthrough intake KPIs + AI-ready awaiting classification concern |

Historical assumptions that required category, priority, and building are no longer universal at create time; reports now count incomplete classification explicitly.

## 4. Employee intake metrics

Overview / helpers expose:

- Unclassified tickets  
- Pending classification (`priority=pending_review`)  
- Missing building  
- Classification incomplete / classified  
- Employee intake (web + unclassified + pending_review)  
- AI-ready awaiting classification (via AI analytics / executive / attention)

Workflow stages remain Submitted → AI Queued → Processing → Completed → FM Review → Classification → Assignment → Work Order → Completion; counts use existing status fields plus intake flags — no duplicate report pages.

## 5. Dashboard / insights / attention / similar cases

- **Executive:** KPI card for AI-ready awaiting classification; existing pending-review KPI remains AI-decision pending.  
- **Operational Insights:** Agreement and health continue to use reviewed / operational samples; intake placeholders excluded from agreement distortion.  
- **Attention Center:** Items for unclassified backlog, long classification delay, AI-ready awaiting FM classification (`classification` group + `classification_backlog_summary`).  
- **Similar Cases:** Candidates exclude incomplete classification so unclassified tickets do not pollute matching.

## 6. Filters, charts, frontend

- Priority filter includes `pending_review`; category labels include `unclassified`.  
- AI insights filters include intake category/priority options.  
- Overview and executive cards extended; no new navigation routes; visualization framework unchanged.

## 7. Backend reuse

- New helper: `apps/fm_tickets/intake_reporting.py`  
- Extended builders: reporting services, `ai_analytics_service`, `ai_attention_center_service`, `ai_similar_case_service`, `executive_ai_dashboard_service`  
- Serializer optional fields only; **no database redesign / no migrations**

## 8. Security

- Tenant scoping via existing reporting scope helpers  
- `reporting.view` unchanged  
- No raw Gemini output, prompts, or private attachments in reporting payloads  
- Employee-facing surfaces unchanged by this task

## 9. Accessibility

- Existing card/table/chart patterns retained; new metrics use same MetricCard / section labeling patterns and keyboard-reachable filters.

## 10. Tests

- Backend: `apps.fm_tickets.test_fo100_reporting_alignment`  
- Frontend: `lib/reporting/fo100-reporting-alignment.test.ts` (+ AI insights card count regression update)  
- Regression suites: FO-088–092 / reporting tests; full frontend suite

## 11. Explicit non-goals

FO-101, feature merge, standalone PR, notification redesign, AI redesign, RAG, vector search, cost analytics, OTel, Prometheus, new AI capabilities, dashboard redesign.

## 12. Confirmation

- Feature branch unmerged  
- FO-101 **not started**  
- AI Platform freeze `98c1661…` unchanged  
