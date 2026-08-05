# FO-097 — AI-First Submission Pipeline

**Status:** Complete; merged via FO-101A / PR #63  
**Date:** 2026-08-05  
**Branch:** `feature/intelligent-employee-intake`  
**Previous checkpoint:** FO-096 (`8eee251…`)  
**FO-097 implementation tip:** `537046e8212677f825eda7324dc773907e26ff71`  
**AI Platform:** FO-084–095 reused (not redesigned)  
**Next:** FO-098 — Facility Manager Review Experience  
**PR policy:** No standalone FO-097 PR; feature remains unmerged

## 1. Objective

Extend FO-096 so eligible image submissions automatically enter the existing AI analysis pipeline, employees receive truthful progress and status feedback, tickets remain usable on AI/upload failure, and completed analyses remain ready for FO-098 FM review — without AI making operational decisions.

## 2. Pipeline (reused)

Employee submits → Ticket created → Images uploaded → Eligibility evaluated → Queue AI (if eligible) → Celery processing → Completed/Failed → FM review (FO-098)

No-image path: ticket usable; AI remains derived **not_requested** (no analysis row).

## 3. Eligibility

AI queues only when images exist, upload succeeded, ticket exists, `image_analysis` feature enabled, and attachments are authorized. Otherwise AI is skipped without blocking the ticket.

## 4. Changes delivered

### Backend

- `queue_ticket_image_analysis`: reuse active queued/processing analysis (no duplicate active queue)

### Frontend

- Employee submit phases: creating → uploading → queueing AI → completed
- Success href outcomes: `ai_queued`, `ai_unavailable`, `ai_not_requested`, `upload_partial`
- Requester-safe AI status copy (`not_requested` included)
- Requester intake timeline
- Partial upload recovery; detail upload can re-queue AI when no active analysis
- Staging `uploadAll` returns `{ uploadedIds, failedCount }` without throwing away successes

## 5. Explicit non-goals

No FO-098–101, text-only AI, new provider/prompts, RAG, auto classification/priority/assignment, notification redesign (FO-099), merge to main.

## 6. Validation

| Gate | Result |
| --- | --- |
| FO-097 + FO-096 backend | 17 passed |
| FO-084 + FO-097 AI | 13 passed |
| Frontend suite | 373 passed |
| TypeScript | clean |
| Production build | clean |
| Django check | clean |
| makemigrations --check | clean |

## 7. Confirmation

- Feature branch unmerged
- FO-098 **not started**
- AI Platform v1.0 architecture unchanged
- Facility Managers remain final classification authority
