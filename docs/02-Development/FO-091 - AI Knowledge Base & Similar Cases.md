# FO-091 — AI Knowledge Base & Similar Cases

**Status:** Complete; merged  
**Date:** 2026-08-04  
**Base:** `main` @ `f1e6168…` (FO-091 merge)  
**Branch:** merged via PR #57  
**PR:** [#57](https://github.com/acarbonilla/facilityops-platform/pull/57) MERGED  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Provide a tenant-scoped, read-only AI Knowledge Base that surfaces similar historical FM Tickets, Maintenance Work Orders, and 5S Inspection cases during ticket review. Results are informational only — FacilityOps never auto-modifies tickets, categories, priorities, work orders, inspections, prompts, or models.

## Architecture

- Service: `apps/fm_tickets/ai_similar_case_service.py` → `AISimilarCaseService` / `build_ai_similar_cases`
- Endpoint: `GET /api/reporting/ai-similar-cases/`
- Permission: `reporting.view`
- Frontend: `/reporting/ai-similar-cases`
- Reuses stored AI recommendation / human decision fields from `AITicketAnalysis`
- Does **not** duplicate FO-088 analytics math

## Similarity algorithm (Version 1 — `rule_v1`)

Weighted rule scoring (0–100). No embeddings. No vector database. No external AI calls.

| Component | Points | Match rule |
| --------- | ------ | ---------- |
| Category | 25 | Exact ticket category match |
| Keywords | 20 | Title/description token overlap (tiered) |
| Location | 15 | Same building |
| Asset | 15 | Same asset |
| Recommendation | 10 | Shared AI recommended category/priority |
| Findings | 10 | AI finding keyword overlap (tiered) |
| Priority | 5 | Normalized priority match (`critical` ≡ `urgent`) |

Explainable `reasons[]` accompany every score. Soft narrative notes may mention human accept/modify decisions without changing the numeric score.

### Search sources

| Source | Completed statuses |
| ------ | ------------------ |
| FM Tickets | `resolved`, `closed` |
| Maintenance Work Orders | `completed`, `closed` |
| 5S Inspections | `completed`, `verified` |

Excluded: soft-deleted, cross-tenant, current ticket, inaccessible records.

### Inputs used

Ticket title/description/category/priority/location/asset, AI findings/recommendations, human final decision fields, keywords.

### Inputs never used

Emails, employee IDs, attachments, prompt text, provider secrets, raw Gemini payloads.

## API contract (FO-092 stable)

Query params: `ticket_id` **or** `analysis_id` (required), date bounds, `category`, `priority`, `status`, `building`, `asset`, `min_similarity` (default 40), `limit` (default 10, max 25), `source`.

Response includes: `current_case`, ranked `similar_cases` (score, reasons, components, historical outcome, AI/human decision summaries), `algorithm` metadata (`version`, `weights`, FO-092 note), `summary`, `interpretation`.

FO-092 may replace the matcher with semantic/embedding search without changing this response shape.

## Security & privacy

- `reporting.view`; Employee / unauthorized → 403
- Tenant scope via `scope_queryset_to_user`
- No identities, emails, attachments, storage paths, prompts, raw Gemini, or provider secrets
- Building/asset exposed by **code** only

## Limitations

- Rule-based Version 1 only
- Candidate cap per source (150) for performance
- Work orders have no category; inspections have no asset — those components score 0 when absent
- FO-092 (embeddings / semantic search) **not started**

## Validation snapshot (FO-091A)

- Focused FO-091 backend (SQLite keepdb / PostgreSQL): **12 / 12 passed**
- FO-090 / FO-089 / FO-088 / FO-087 / FO-086: **11 / 14 / 14 / 8 / 8 passed**
- FO-085 analysis + celery: **15 passed**
- Reporting regression: **86 passed**
- AI combo FO-091–FO-085: **82 passed**
- Focused FO-091 frontend: **6 passed**
- Full frontend suite: **360 passed / 0 failed**
- ESLint / TypeScript / production build: Passed (`/reporting/ai-similar-cases` present)
- Django check / makemigrations --check: Clean
- FO-092: not started

## Manual acceptance

- Date: 2026-08-04
- Environment: Local Django on PostgreSQL; Tenant A/B fixtures; code-path review
- Result: **PASS** (ranking, reasons, outcomes, permissions, tenant isolation, privacy, no workflow mutation)
- Defects: None
- See `FO-091A - Finalize, Merge & Post-Merge Verification.md`
