# FO-093 — AI Administration & Governance

**Status:** Ready for Review (FO-093A acceptance PASS)
**Date:** 2026-08-05
**Base:** `main` @ `46d103249be5cc04d9f5c3b73963d8f22f863d5b`
**Branch:** `feature/fo-093-ai-administration-governance`
**PR:** [#59](https://github.com/acarbonilla/facilityops-platform/pull/59)
**Phase:** Phase 12A — Application Development
**Epic:** AI Administration & Governance

## Objective

Provide authorized administrators (`settings.manage`) with a centralized AI Administration & Governance module to configure providers, feature flags, thresholds, review prompt registry metadata, view governance policies, monitor AI health, and audit configuration changes.

FO-093 never runs analysis, mutates tickets, bypasses human review, retrains models, or executes autonomous actions.

## Architecture

```text
AIAdministrationService
  ├── Provider Settings (DB override → env/Django defaults)
  ├── Prompt Registry (read-only metadata)
  ├── Feature Flags (fail-closed when disabled)
  ├── Threshold Configuration
  ├── Governance Policies (read-only)
  ├── Audit History
  └── Health Monitoring
```

- Models: `AIAdminConfig` (global singleton), `AIAdminAuditEntry`
- Service: `apps/fm_tickets/ai_administration_service.py`
- APIs under `/api/admin/ai/`
- Frontend: `/admin/ai`
- Permission: `settings.manage` (Facility Manager / Employee / reporting-only → 403)
- Scope: **platform-global V1** (no TenantSettings store)

## Provider configuration

Editable: provider (`placeholder` | `gemini`), model, enabled, timeout, max images, max upload bytes, retry attempts, store-raw toggle.  
Temperature is readonly. API keys are never exposed or editable.

## Feature flags

Image Analysis, Recommendation Engine, Executive Dashboard, Similar Cases, Attention Center, Operational Insights. Disabled flags deny new access safely.

## Thresholds

Confidence, health warning/healthy-min, attention warning/critical, acceptance healthy rate, override warning rate — validated ranges; persisted in DB; consumed via `get_runtime_setting`.

## Prompt registry / policies

Read-only. No prompt text. No editing.

## Security

No API keys, prompt text, raw Gemini payloads, or attachment paths in responses. All patches audited.

## Migration

`fm_tickets.0006_fo093_ai_admin_governance`

## Validation snapshot

- Focused FO-093 backend: **8 / 8 passed**
- FO-092/091/090/089 smoke: **54 passed** (with FO-093)
- Focused FO-093 frontend: **3 / 3 passed**
- Full frontend suite: **367 passed / 0 failed**
- Django check / makemigrations --check: Clean
- Manual acceptance (FO-093A): **PASS** — see `FO-093A - Finalize Merge and Post-Merge Verification.md`
- FO-088 `test_decision_filter_and_date_filter`: **pre-existing on main** (same failure at `46d1032…`); not introduced by FO-093
- FO-094: **not started**

## Limitations

- Global scope only (V1)
- No prompt editing / API key management
- FO-094 **not started**
