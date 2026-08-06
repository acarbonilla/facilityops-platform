# FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

**Status:** Complete on feature branch (Draft PR #65)  
**Date:** 2026-08-06  
**Branch:** `feature/ai-platform-reliability`  
**Draft PR:** https://github.com/acarbonilla/facilityops-platform/pull/65  
**Phase:** Phase 12A — Application Development  
**Module:** AI Platform Reliability  

## Objective

Distinguish Gemini Vision failures (billing, quota, auth, RPM/RPD, model, timeout, unavailable) from a single coarse “rate limit” message, persist sanitized diagnostics, schedule delayed retries, and surface signals on AI Monitoring — without changing Intelligent Employee Intake workflow behavior.

## Outcome

Administrators can identify whether failures are caused by:

| Signal | Internal code(s) |
| --- | --- |
| Invalid API key | `INVALID_API_KEY` |
| Billing disabled / unpaid | `BILLING_DISABLED` |
| Quota / prepaid exhaustion | `QUOTA_EXHAUSTED` |
| Requests per minute | `RATE_LIMIT_RPM` |
| Requests per day | `RATE_LIMIT_RPD` |
| Model not found | `MODEL_NOT_FOUND` |
| Permission denied | `PERMISSION_DENIED` |
| Network / provider timeout | `NETWORK_TIMEOUT`, `PROVIDER_TIMEOUT` |
| Provider unavailable | `PROVIDER_UNAVAILABLE` |
| Unknown provider error | `UNKNOWN_PROVIDER_ERROR` |

Each code has a user-safe message and an admin diagnostic message. Guided Review no longer collapses everything into a vague “Analysis Failed” when `error_code` / admin text is available.

**Honesty note:** Google often returns generic `429 RESOURCE_EXHAUSTED` for billing and quota alike. FO-102 classifies billing when the message mentions billing/payment; otherwise quota. Ambiguous RPM vs prepaid may still need Google console confirmation.

## New analysis states

| Status | Meaning |
| --- | --- |
| `waiting_for_retry` | Transient failure; Celery countdown scheduled |
| `retrying` | Worker executing a delayed retry attempt |
| `retry_failed` | Retryable errors exhausted max attempts |
| `permanently_failed` | Non-retryable failure (auth, billing, schema, etc.) |
| `failed` | Legacy terminal status (still treated as terminal) |

## Delayed retry schedule

After attempt *N* fails with a retryable code: **1m → 5m → 15m → 30m** (capped).  
Configurable max attempts via `FACILITYOPS_AI_MAX_ATTEMPTS` (default **5** in processing path).

## Diagnostics persistence

On `AITicketAnalysis` (migration `0008`):

- `provider_diagnostics` (JSON) — HTTP status, provider error code, sanitized message, retryable, timestamp, model  
- `admin_diagnostic_message`  
- `next_retry_at`  

Never stores prompts, images, or API keys.

## Manual retry

`POST /api/fm-tickets/tickets/{id}/ai-analyses/{analysis_id}/retry/`

- Requeues the **same** analysis row  
- Blocks when another analysis is active (no duplicates)  
- Employee requesters denied  
- FM UI: **Retry AI Analysis** button on failed analyses  

## AI Monitoring

Overview payload includes `diagnostics` with provider status, billing/quota/rate-limit/auth signals, last error, current model, retry queue, success rate, average retry count, last successful analysis.

## Validation

| Gate | Result |
| --- | --- |
| FO-102 + Gemini + Celery + monitoring + FO-084 analysis tests | **47 passed** (`--keepdb`) |
| Migration `0008` | Applied locally |

## Out of scope (honored)

- Other LLM providers, prompt redesign, recommendation changes, cost analytics, OpenTelemetry, RAG, multi-provider failover, intake workflow redesign  

## Related

- FO-101B live Gemini schema fixes remain on `fix/fo-101b-live-gemini-verification` (not required for FO-102 diagnostics, recommended before production vision success).
