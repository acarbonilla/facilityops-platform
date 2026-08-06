# FO-101B — Live Gemini Evaluation Verification

**Status:** Complete on diagnostic branch (Draft PR #64) — **Outcome A**  
**Date:** 2026-08-06  
**Branch:** `fix/fo-101b-live-gemini-verification`  
**Draft PR:** https://github.com/acarbonilla/facilityops-platform/pull/64  
**Base main:** `8cb18950f05aa8dada3b1896b9705228b7c89c3c`  
**Affected ticket:** `FM-20260805-0001`

## 1. Observed evidence (historical)

Historical analysis `52e63bcb-…`:

- status: `completed`
- provider / model: `placeholder` / `placeholder`
- duration ≈ 36 ms
- summary: Placeholder AI analysis completed… gemini provider is enabled
- Celery task id present (worker did run at that time)
- Ticket remained `unclassified` / `pending_review` / building null / open

## 2. Effective configuration (Django process)

| Setting | Effective value |
| --- | --- |
| FACILITYOPS_AI_PROVIDER | `gemini` |
| FACILITYOPS_GEMINI_ENABLED | `True` |
| FACILITYOPS_GEMINI_MODEL | `gemini-2.5-flash` |
| FACILITYOPS_GEMINI_TIMEOUT_SECONDS | `60` |
| FACILITYOPS_GEMINI_MAX_IMAGES | `5` |
| FACILITYOPS_GEMINI_MAX_TOTAL_BYTES | `15728640` |
| FACILITYOPS_AI_MAX_ATTEMPTS | `3` |
| FACILITYOPS_AI_STORE_RAW_RESPONSE | `False` |
| GEMINI_API_KEY | **configured** (not printed) |
| FO-093 DB provider override | empty (falls back to Django settings) |
| image_analysis feature flag | enabled |
| `get_ai_provider()` | **GeminiVisionProvider** |
| google-genai | `2.15.0` import OK |

## 3. Celery / Redis

| Check | Result |
| --- | --- |
| Redis `localhost:6379` | **Unavailable** (connection refused) |
| Celery worker process | Not running |
| CELERY_TASK_ALWAYS_EAGER | `False` |

Async `.delay()` queue path was **not** re-verified in this session. Live Gemini success used the **synchronous** `process_ticket_ai_analysis` path.

## 4. Root cause chain

1. **Historical placeholder completion:** earlier analysis used `PlaceholderAIProvider` (sub-second placeholder summary).
2. **Current Django settings correctly select Gemini.**
3. First live attempts failed on billing (`429 RESOURCE_EXHAUSTED`) with the prior API key.
4. After API key replacement, text probe succeeded; vision failed on Gemini structured-schema serving:
   - `400 too many states for serving` → simplified response schema (strip tight bounds)
   - property-name collision dropped `title`/`description` under `properties` → preserve field maps
   - Gemini invented/mismatched identity labels → pin `schema_name` / `schema_version`
   - FO-085 nested confidence is `0.0–1.0` but Gemini emitted `0–100` → normalize before Pydantic
5. **Async requeue** still blocked until Redis + Celery run with the same `.env`.

## 5. Live smoke (controlled sync) — Outcome A

| Step | Result |
| --- | --- |
| Text probe (`Reply with exactly: ok`) | OK |
| Preserve historical placeholder row | Yes |
| New analysis + same PNG | Yes (`1c58084a-…`) |
| Provider / model | `gemini` / `gemini-2.5-flash` |
| Lifecycle | queued → processing → **completed** (~10.9s) |
| Structured output | `FacilityRecommendationV1` with findings (not placeholder) |
| Example advisory result | category `General Maintenance`, priority `Low`, finding title damaged table |
| Ticket fields unchanged | `unclassified` / `pending_review` / open / no assignee / building null |
| Auto WO / assignment | None |

## 6. Pending Review semantics

Confirmed: Gemini completion does **not** mutate final category/priority/assignment/status. `Pending Review` remains operational classification state; AI stays advisory.

## 7. Corrective changes

- Stamp selected provider/model on analysis **before** provider I/O (failures no longer labeled `placeholder`).
- FM AI panel: provider/model labels + classification reminder.
- Gemini-serving JSON schema simplification that **preserves** property names like `title` / `description`.
- Harden serving `schema_name` / `schema_version` enums; pin identity before validate.
- Normalize FO-085 nested percent confidences (`>1` → `/100`) in the Gemini adapter.
- Map schema-serving `400` / “too many states” to `INVALID_PROVIDER_RESPONSE`; Pydantic failures to `SCHEMA_VALIDATION_FAILED`.
- Focused FO-101B tests (provider selection, failure metadata, schema/normalize).

## 8. Local activation procedure (no secrets)

1. Set in `backend/.env` (do not commit):
   - `FACILITYOPS_AI_PROVIDER=gemini`
   - `FACILITYOPS_GEMINI_ENABLED=True`
   - `GEMINI_API_KEY=<local key with credits>`
   - `FACILITYOPS_GEMINI_MODEL=gemini-2.5-flash`
2. Ensure FO-093 image-analysis flag remains enabled.
3. Start Redis on `localhost:6379`.
4. Start Celery worker from `backend/` with the same `.env`.
5. Restart Django `runserver`.
6. Queue a **new** analysis (do not overwrite historical placeholder rows).
7. Confirm `provider=gemini`, real findings, ticket fields unchanged.

## 9. Remaining limitations (accepted)

1. Redis/Celery async path not verified in this session.
2. Full interactive browser matrix not re-run.
3. Rotate any API key that was pasted into chat/logs.

## 10. Outcome

**Outcome A — Live Gemini evaluation verified.** FacilityOps sent the ticket image to Gemini Vision, stored a completed non-placeholder `FacilityRecommendationV1` result, and left ticket workflow fields unchanged. Recommendations remain advisory-only.
