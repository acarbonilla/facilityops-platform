# FO-096 — Intelligent Employee Intake Foundation

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-05  
**Branch:** `feature/intelligent-employee-intake`  
**Base main:** `0033655aeaee5c2e774d2162e551c7988f54f0f5`  
**UX baseline:** UX-001 COMPLETE AND MERGED  
**AI Platform v1.0:** FROZEN AND UNCHANGED  
**Next:** FO-097 — AI-First Submission Pipeline  
**PR policy:** No standalone FO-096 PR; feature PR after FO-101

## 1. Objective

Implement the foundation of the simplified Employee Requester intake workflow:

- Employee-visible fields: Title (required), Description (optional), Images (recommended, optional)
- Server-derived requester, tenant, organization
- No employee operational classification controls
- Facility Manager retains classification authority

## 2. Feature branching

Long-lived shared branch: `feature/intelligent-employee-intake`

Checkpoints: FO-096 → FO-097 → FO-098 → FO-099 → FO-100 → FO-101

FO-096 is **not** merged to main and has **no** standalone PR.

## 3. Architecture discovery

| Topic | Finding |
| --- | --- |
| Prior employee create | Required title, description, category, building; forced `priority=medium` |
| Ownership | Already server-derived for employee path; client ownership rejected |
| `unclassified` / `pending_review` | Did **not** exist as ticket choices |
| Building | Required FK |
| Description | Required TextField |
| Status `open` | Existing; reused |
| AI `not_requested` | Remains derived (no analysis row); not a persisted enum |

## 4. Selected classification representation

**Persisted TextChoices values** (preferred over null/sentinel):

- `category = unclassified`
- `priority = pending_review`

Rationale: avoids fake Medium/Other defaults; keeps CharFields non-null; clear FM/reporting gates; additive migration.

**Also:**

- `description` blank allowed (`blank=True`, default `""`)
- `building` nullable for employee intake (`null=True`, `blank=True`)
- Internal FM create still requires building via serializer

## 5. Migration

`fm_tickets.0007_fo096_employee_intake_foundation`

- Alter category choices (add unclassified)
- Alter priority choices (add pending_review)
- Alter description blank
- Alter building nullable

Rollback: reverse migration restores prior field definitions; existing unclassified/pending_review rows would need data cleanup before reverse if any exist.

## 6. Employee create API

`EmployeeFmTicketCreateSerializer` accepts only:

- `title`
- `description` (optional)

Protected / rejected if client-supplied: requester, tenant, organization, category, priority, building, floor, area, asset, assignee, status, and prior protected fields.

Server sets: requester/tenant/organization from session; `category=unclassified`; `priority=pending_review`; `status=open`; location/assignee null; `source=web`.

## 7. Frontend

`/my-requests/new` simplified to:

- Read-only requester + organization context
- Title *
- Description (optional)
- Image staging (recommended)
- Soft warning when description and images both empty (non-blocking)
- Submit Concern with double-submit guard

Internal FM create/edit forms retain full classification controls; filters/badges include new choices.

## 8. AI boundary

Existing post-create image upload + AI queue retained when images upload successfully. No text-only AI. No automatic final classification. FO-097 owns AI-first pipeline redesign.

## 9. Validation results

| Gate | Result |
| --- | --- |
| FO-096 + employee requester backend | 33 passed |
| FM ticket tests + FO-096 | 75 passed |
| Frontend suite | 372 passed |
| ESLint | clean (prior run) |
| TypeScript | clean |
| Production build | clean |
| Django check | clean |
| makemigrations --check | clean |
| Manual browser acceptance | Automated coverage complete; interactive browser checklist pending operator run |

## 10. Manual acceptance checklist (operator)

Documented in task FO-096 §21. Automated tests cover create contract, ownership, classification defaults, and form payload rules. Interactive UI/mobile verification remains for operator confirmation on the feature branch.

## 11. Exclusions (confirmed not done)

FO-097–FO-101, text-only AI, prompt changes, auto classification/assignment, notification redesign, reporting redesign, merge to main, standalone FO-096 PR.

## 12. Confirmation

- Feature branch remains unmerged
- FO-097 has **not started**
- AI Platform v1.0 unchanged
