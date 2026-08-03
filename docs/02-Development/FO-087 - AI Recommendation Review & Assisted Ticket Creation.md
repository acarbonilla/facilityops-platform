# FO-087 — AI Recommendation Review & Assisted Ticket Creation

**Status:** Acceptance passed (FO-087A); Draft PR #53 Ready for merge  
**Date:** 2026-08-03  
**Base:** `main` @ `769a620…` (FO-086)  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis  
**Post-merge:** See `FO-087A - Finalize, Merge & Post-Merge Verification.md`

## Objective

Add a human-in-the-loop review workflow for FO-086 AI recommendations. Facilities users can accept, modify, or ignore advisory findings before continuing the FM Ticket workflow. AI never auto-updates ticket fields; human decisions remain authoritative.

## Workflow

```text
Completed AI analysis
  → TicketAiAnalysisStatusPanel (review controls)
      ├── Accept  → record decision + populate form category/priority (no auto-save)
      ├── Modify  → choose final category/priority → record + populate form
      └── Ignore  → record decision; continue manual workflow
  → User saves/updates ticket separately
```

## Backend

- Migration `0005_aiticketanalysis_recommendation_decision`
- Service: `ai_recommendation_review.record_recommendation_decision`
- Endpoint: `POST /api/fm-tickets/tickets/{id}/ai-analyses/{analysis_id}/decision/`
- Payload: `decision` (`accepted` | `modified` | `ignored`), optional `final_category` / `final_priority`
- Preserves original `result_json`; stores decision snapshots + final values + `decision_at` / `decision_by`
- Writes `FmTicketHistory` action `ai_recommendation_{decision}`
- Does **not** mutate ticket category/priority/status

## API fields exposed

`decision`, `accepted`, `modified`, `ignored`, `final_category`, `final_priority`, `decision_timestamp`, `decision_user`, plus existing FO-086 recommendation fields.

No prompt text, API keys, or raw provider secrets.

## Frontend

- Enhanced `TicketAiAnalysisStatusPanel` with Accept / Modify / Ignore, comparison UI, decision badge, human-review notice, ARIA live announcements
- Detail: Accept/Modify navigates to edit with `ai_category` / `ai_priority` query params
- Edit: panel can apply values into `TicketForm` via `appliedRecommendation` (dirty form fields; save still required)

## Mapping

AI recommendation labels map to ticket codes (example: Plumbing→plumbing, Critical→urgent, Housekeeping→cleaning).

## Security

Tenant-scoped analysis lookup; decision requires `fm_tickets.update`; cross-tenant returns 404; requesters do not see review controls.

## Tests

- Backend: `test_ai_recommendation_review.py`
- Frontend: FO-087 helpers in `ai-recommendations.test.ts`
