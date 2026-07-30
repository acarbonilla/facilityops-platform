# FO-085 — Gemini Vision Integration & Structured Image Analysis

**Status:** Implemented on `feature/fo-085-gemini-vision-structured-analysis`  
**Date:** 2026-07-30  
**Base branch:** `feature/fo-084-fm-ticket-ai-analysis-foundation`  
**Starting SHA:** `565204420b26f30ff2974cc44ceae956a52f50b9`  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Replace the FO-084 placeholder analysis behavior with a configuration-driven Gemini Vision provider that returns validated, structured **observations** about authorized FM Ticket images. No automatic category/priority/assignment/work-order mutations.

## Scope and exclusions

**In scope:** Gemini provider adapter, structured schema, prompt versioning, private image loading, retries, safe APIs, minimal status UI.

**Out of scope (FO-086 / FO-087):** recommendations, human-review panel depth, automatic workflow decisions, final diagnosis presentation.

## Provider architecture

```text
get_ai_provider()
  ├── PlaceholderAIProvider (default / tests)
  └── GeminiVisionProvider (FACILITYOPS_AI_PROVIDER=gemini)
        ↓
ai_processing_service.process_ticket_ai_analysis
        ↓
Celery: fm_tickets.process_fm_ticket_ai_analysis (bounded retries)
```

Controllers and serializers contain no Gemini request construction.

## SDK choice

| Item | Value |
| --- | --- |
| Package | `google-genai==2.15.0` |
| Import | `from google import genai` |
| API mode | `client.models.generate_content` + `GenerateContentConfig` |
| Structured output | `response_mime_type=application/json` + `response_json_schema` from Pydantic |
| Older SDK | `google-generativeai` **not** introduced |

Also depends on `pydantic>=2.9,<3` for independent schema validation.

## Image input strategy

**Inline bytes** via `types.Part.from_bytes` for configured aggregate limits.

Files API is **not** used in FO-085 (simpler secure path; no temporary Gemini file lifecycle).

Images are read only through `get_attachment_storage().open(storage_key)` after ownership/tenant checks. No remote URLs, no client storage paths, no signed URL exposure.

## Configuration

| Variable | Purpose |
| --- | --- |
| `FACILITYOPS_AI_PROVIDER` | `placeholder` (default) or `gemini` |
| `FACILITYOPS_GEMINI_ENABLED` | Must be true for Gemini selection |
| `GEMINI_API_KEY` | Secret; never logged or returned |
| `FACILITYOPS_GEMINI_MODEL` | Configurable model id (default `gemini-2.0-flash`) |
| `FACILITYOPS_GEMINI_TIMEOUT_SECONDS` | Provider timeout |
| `FACILITYOPS_GEMINI_MAX_IMAGES` | Max images per analysis |
| `FACILITYOPS_GEMINI_MAX_TOTAL_BYTES` | Aggregate byte cap |
| `FACILITYOPS_GEMINI_TEMPERATURE` | Generation temperature |
| `FACILITYOPS_AI_STORE_RAW_RESPONSE` | Default false |
| `FACILITYOPS_AI_MAX_ATTEMPTS` | Bounded processing attempts |

## Structured schema

- Name: `FacilityImageAnalysisV1`
- Version: `1.0`
- Module: `apps/fm_tickets/ai/schema_v1.py`
- Always forces `requires_human_review=true`
- Confidence 0.0–1.0; bounded arrays/strings; enums for quality/severity

## Prompt

- Name: `fm_ticket_image_analysis`
- Version: `v1`
- Module: `apps/fm_tickets/ai/prompts/fm_ticket_image_analysis_v1.py`
- Observation vs inference vs unsupported diagnosis guidance
- Prompt-injection resistance for image-embedded text/QR/URLs

## Ticket context sent

title, description, location label, category, image count/sequence ids.

**Excluded:** requester email/phone/employee id, tokens, storage paths, permissions, history.

## Lifecycle / retries / errors

Preserve Queued → Processing → Completed|Failed.

Transient codes (`PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`) use Celery `autoretry_for` with backoff/jitter (`max_retries=2`).

Completed analyses are idempotent. Safe public error messages only; normalized `error_code`.

## Persistence

Migration `0004_aiticketanalysis_gemini_metadata` adds provider/prompt/schema/error/attempt/input counters/correlation fields. Structured payload stored in `result_json` (no API keys, no image bytes).

## Frontend

`TicketAiAnalysisStatusPanel` on FM Ticket detail (internal) and My Requests detail (requester-safe messaging). Labels AI-generated + human review required. No category/priority mutation.

## Opt-in smoke test

With a real `GEMINI_API_KEY` and `FACILITYOPS_AI_PROVIDER=gemini` / `FACILITYOPS_GEMINI_ENABLED=True`, manually submit synthetic non-client images and verify schema validation, mapping, and no workflow mutation. **Not part of automated CI.**

## Deferred

Recommendations, Gemini-driven priority/category, rich review panel, notifications.
