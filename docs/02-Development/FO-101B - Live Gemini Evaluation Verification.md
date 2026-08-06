# FO-101B — Live Gemini Evaluation Verification

**Status:** Complete on diagnostic branch (Draft PR) — **Outcome B**  
**Date:** 2026-08-06  
**Branch:** `fix/fo-101b-live-gemini-verification`  
**Base main:** `8cb18950f05aa8dada3b1896b9705228b7c89c3c`  
**Affected ticket:** `FM-20260805-0001`

## 1. Observed evidence

Historical analysis `52e63bcb-…`:

- status: `completed`
- provider / model: `placeholder` / `placeholder`
- duration ≈ 36 ms
- summary: Placeholder AI analysis completed… gemini provider is enabled
- Celery task id present (worker did run)
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
| Docker / WSL Redis | Not available on this host |
| Celery worker process | Not running |
| CELERY_TASK_ALWAYS_EAGER | `False` |

Async `.delay()` queue path cannot complete until Redis + worker are running with the same `.env`.

## 4. Root cause

1. **Historical placeholder completion:** The completed analysis on `FM-20260805-0001` was produced by `PlaceholderAIProvider` (sub-second, placeholder summary). At that time the worker resolved Placeholder (stale/default provider env or pre-Gemini local settings), not Gemini.
2. **Current Django settings are correct** for Gemini selection.
3. **Live Gemini evaluation attempted** synchronously: API returned safe normalized `PROVIDER_RATE_LIMITED` with upstream `429 RESOURCE_EXHAUSTED` (prepayment credits depleted). This proves the Gemini adapter, key wiring, and image path were invoked.
4. **Async requeue blocked** by Redis/Celery absence.

Classification: expected historical local configuration + current billing/runtime service blockers — not an AI Platform redesign defect.

## 5. Live smoke (controlled sync)

| Step | Result |
| --- | --- |
| Preserve original placeholder analysis | Yes |
| Create new analysis + link same PNG | Yes (`e21be00f-…`) |
| Provider selected | GeminiVisionProvider |
| Model | `gemini-2.5-flash` |
| Lifecycle | queued → processing → failed (`PROVIDER_RATE_LIMITED`) after bounded retries |
| Ticket fields unchanged | `unclassified` / `pending_review` / open / no assignee / no WO |
| Requester-safe serializer | Unchanged (FO-101) |
| Completed Gemini structured output | **Not obtained** (billing) |

## 6. Pending Review semantics

Confirmed: AI completion/failure does **not** mutate final category/priority. `Pending Review` is operational classification state, not AI failure proof.

## 7. Corrective changes

- Persist selected provider/model on analysis **before** provider network I/O so failures are not mislabeled as `placeholder`.
- FM AI panel shows provider/model labels and an operational classification reminder.
- Focused FO-101B provider-selection and failure-metadata tests.

## 8. Local activation procedure (no secrets)

1. Set in `backend/.env` (do not commit):
   - `FACILITYOPS_AI_PROVIDER=gemini`
   - `FACILITYOPS_GEMINI_ENABLED=True`
   - `GEMINI_API_KEY=<local key with credits>`
   - `FACILITYOPS_GEMINI_MODEL=gemini-2.5-flash` (or verified multimodal model)
2. Ensure FO-093 image-analysis flag remains enabled.
3. Start Redis on `localhost:6379`.
4. Start Celery worker from `backend/` so it loads the same `.env` / Django settings.
5. Restart Django `runserver`.
6. Queue a **new** analysis (do not overwrite historical placeholder rows).
7. Confirm analysis `provider=gemini`, real observations, ticket fields unchanged.

## 9. Remaining blockers

1. Gemini API prepayment credits depleted (`429`).
2. Redis/Celery not running locally for async queue verification.

## 10. Outcome

**Outcome B — Configuration corrected but live completed Gemini evaluation blocked** by billing credits and Redis/Celery availability. FacilityOps selects Gemini when configured; recommendations remain advisory.
