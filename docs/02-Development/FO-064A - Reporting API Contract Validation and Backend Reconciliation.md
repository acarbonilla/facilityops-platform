# FO-064A - Reporting API Contract Validation and Backend Reconciliation

## Status

Complete

## Purpose

Correct and validate the FO-064 Reporting backend contract before FO-065 frontend work.

## Confirmed Defects

1. `building` and `organization` were accepted as opaque strings without UUID or access validation.
2. Cross-module `status` and `priority` query filters were implemented before the FO-066 filter contract.
3. Cumulative backend validation for FO-064 had not been completed.
4. Focused error, isolation, scope, and non-mutation coverage was incomplete.

## Corrections

### UUID validation

- Empty or omitted `building` / `organization` resolve to no filter.
- Malformed UUID values return HTTP 400 with field-keyed DRF errors:
  - `{"building": ["Must be a valid UUID."]}`
  - `{"organization": ["Must be a valid UUID."]}`
- Accepted values are normalized to UUID before ORM use.

### Accessible master-data validation

Eligible Building / Organization rows must satisfy:

- `is_deleted=False`
- `is_active=True`
- Tenant scope for non-global users (`tenant_id == request.user.tenant_id`)

Inaccessible but syntactically valid identifiers return generic HTTP 404:

- `"Building not found."`
- `"Organization not found."`

This equalizes missing, cross-tenant, inactive, and soft-deleted cases so existence is not leaked.

Global users (`superuser` or `system_admin`) may resolve eligible Buildings / Organizations across tenants.

Tenantless non-global users cannot use Building or Organization filters to access data; requests return HTTP 404.

### Building / Organization relationship

When both filters are supplied:

- Building must belong to the selected Organization.
- Mismatch returns HTTP 400:
  - `{"building": ["Building must belong to the selected organization."]}`

### Removed premature filters

Public FO-064A contract rejects:

- `status`
- `priority`

Behavior: HTTP 400 explaining the filter is unsupported by the current Reporting overview contract.
Cross-module filter UX remains deferred to FO-066.

## Final Supported Query Parameters

- `date_from`
- `date_to`
- `building`
- `organization`

## Date Contract

- Input: ISO-8601 datetime
- Default: last 90 days through now when bounds are omitted
- Only `date_from`: `date_to` defaults to now
- Only `date_to`: `date_from` defaults to `date_to - 90 days`
- Both bounds inclusive (`__gte` / `__lte`)
- Equal bounds accepted
- Reversed bounds return HTTP 400
- Malformed datetime returns HTTP 400
- Naive datetimes are made timezone-aware in the current timezone
- Maximum inclusive span: 180 days (exact 180 accepted; above 180 rejected)

## Response Contract

Preserved sections:

- `filters`
- `tickets`
- `work_orders`
- `inspections`

`filters` echo contains only:

- `date_from`
- `date_to`
- `building`
- `organization`

## Tenant and Global Scope

Unchanged accepted decisions:

- Tenant-bound users limited to their tenant aggregates
- Users without a tenant receive empty aggregates when no master-data filter is supplied
- Superuser and `system_admin` retain global reporting scope
- Soft-deleted operational rows remain excluded

## Permission Seeding

Unchanged:

- `reporting.view` for `system_admin`, `facility_manager`, and `viewer`
- Backend-authoritative via `HasPermissionCode`

## Tests Added / Updated

`apps.reporting.tests.test_reporting` now covers:

- UUID malformed / unknown / access failures
- Building and Organization success, inactive, deleted, cross-tenant, mismatch
- Tenantless filter denial
- Global `system_admin` and superuser scope
- Rejection of `status` / `priority`
- Expanded date-bound cases
- Null-score inspection average behavior
- Read-only / no Notification side effects
- Bounded query count as rows grow
- Empty tenant zero payload
- Seed RBAC role assignment for `reporting.view`

## Validation Results

Focused Reporting suite and cumulative backend suites executed during FO-064A (see final report).

## Migration Status

- No Reporting model
- No new migration
- `makemigrations --check --dry-run` expected clean

## Dependency Status

- No new dependencies

## PR State

- Continues on `feature/reporting`
- Continues draft PR #38
- PR remains open, draft, and unmerged
- FO-065 has not started

## Explicit Confirmation

FO-064A is complete on `feature/reporting`. PR #38 remains open, draft, and unmerged. FO-065 has not started.
