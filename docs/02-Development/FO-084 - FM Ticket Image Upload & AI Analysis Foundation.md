# FO-084 — FM Ticket Image Upload & AI Analysis Foundation

**Status:** Implemented on `feature/fo-084-fm-ticket-ai-analysis-foundation`  
**Date:** 2026-07-30  
**Phase:** Phase 12A — Application Development  
**Stage:** Stage 3 — Business Modules  
**Epic:** AI-Assisted FM Ticket Analysis

## Summary

FO-084 integrates optional image upload into the FM Ticket Create workflow (internal `/fm-tickets/new` and Employee `/my-requests/new`) and establishes the background AI analysis pipeline foundation. After ticket creation and attachment association, the backend queues a Celery job that transitions an `AITicketAnalysis` record through Queued → Processing → Completed/Failed using a placeholder provider. Real AI recommendations, dashboards, and predictions remain deferred.

## Business workflow

```text
Employee / Internal operator
        ↓
Create FM Ticket (title, category, location, description, optional images)
        ↓
Submit Ticket
        ↓
Validate form → Create ticket → Upload images (owner=fm_ticket) → Queue AI job
        ↓
Navigate to detail with success banner
        ↓
User may leave immediately; AI continues asynchronously
```

## Architecture

```text
Ticket Created
      ↓
Attachment Service (FO-079–FO-083 owned upload)
      ↓
AI Queue Service (queue_ticket_image_analysis)
      ↓
Celery Worker (fm_tickets.process_fm_ticket_ai_analysis)
      ↓
AI Provider Adapter (PlaceholderAIProvider → future Gemini)
      ↓
Result Persistence (AITicketAnalysis.result_json)
      ↓
Future Recommendation Engine (deferred)
```

Controllers do not contain AI provider logic. Provider swap is isolated to `ai_provider.get_ai_provider()`.

## Backend

### Models (migration `0003_aiticketanalysis_foundation`)

| Entity | Purpose |
| --- | --- |
| `AITicketAnalysis` | Ticket-scoped analysis job with status, timestamps, duration, model/version, result JSON, error message, requester, celery task id |
| `AITicketAnalysisAttachment` | Authorized attachment mapping for a job |

Statuses: `queued`, `processing`, `completed`, `failed`.

### Services

| Module | Role |
| --- | --- |
| `ai_queue_service.py` | Tenant-scoped queue; validates attachment IDs belong to the ticket; creates records; dispatches Celery |
| `ai_processing_service.py` | Status transitions and provider invocation |
| `ai_provider.py` | Placeholder adapter with factory hook for Gemini later |
| `tasks.py` | `fm_tickets.process_fm_ticket_ai_analysis` |

### Internal APIs (authenticated, ticket-scoped — not public)

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/api/fm-tickets/tickets/{id}/ai-analyses/` | `fm_tickets.create` |
| GET | `/api/fm-tickets/tickets/{id}/ai-analyses/` | `fm_tickets.view` |
| GET | `/api/fm-tickets/tickets/{id}/ai-analyses/{analysis_id}/` | `fm_tickets.view` |

Queue payload: `{ "attachment_ids": ["…"] }`. Cross-tenant / unauthorized ticket access → generic 404. Unauthorized attachment IDs → 400 validation error.

### Security

- Tenant isolation via `scope_fm_ticket_queryset`
- Queued jobs store only authorized attachment IDs already owned by the ticket
- No unauthenticated AI endpoints
- No notifications in this task

### Performance

Ticket create returns before AI completion. Celery performs image analysis asynchronously. Placeholder processing is intentionally lightweight.

## Frontend

### Create form image staging

`TicketCreateImageStaging` reuses FO-080 attachment validation/helpers with create-flow behavior:

- drag-and-drop + browse
- image thumbnails + remove before submit
- upload progress on submit
- validation messages, attachment count, formats, max size
- deferred upload (files leave local queue only on Submit Ticket)

Integrated before Submit on:

- `/fm-tickets/new`
- `/my-requests/new`

### Submission orchestration

1. Validate form  
2. Create FM Ticket  
3. Upload staged images with `owner_type=fm_ticket`  
4. POST AI analysis queue with returned attachment IDs  
5. Navigate to detail with `?created=1` and optional `ai_queued=1`

### Success UI

Detail / My Request detail shows:

- Ticket Submitted Successfully  
- Ticket Number  
- When AI queued: “AI analysis is processing in the background…”

## Deferred (later FO tasks)

- AI recommendations / summaries  
- Priority / category prediction  
- AI dashboard  
- User notifications for AI completion  
- Gemini (or other) real provider wiring  

## Tests

| Suite | Coverage |
| --- | --- |
| `apps.fm_tickets.test_ai_analysis` | Queue creation, status transitions, attachment mapping, authorization, failure recovery, placeholder processing, API endpoints |
| `create-image-staging.test.ts` | Image validation, enqueue, success href helpers |

## Validation checklist

- Backend FO-084 tests  
- Frontend FO-084 helper tests  
- ESLint / TypeScript / production build  
- Django check  
- Migration `0003_aiticketanalysis_foundation` present  

## Future expansion

Replace `PlaceholderAIProvider` via `get_ai_provider()` without changing queue/worker contracts. Result JSON remains extensible for recommendations and predictions.
