# FO-066 - Reporting Cross-Module Filters and Drill-Down Workflows

## Objective

Add explicitly module-scoped Reporting filters and safe, permission-aware drill-downs to existing operational lists.

## Preflight

- Branch: `feature/reporting`
- Starting HEAD: `115191caef252b8e204b26f9ea1fda47eb26cc0c`
- FO-064 through FO-065A foundation retained
- PR #38 remains draft and unmerged

## Final Filter Contract

Common: `date_from`, `date_to`, `organization`, `building`.

Module-specific: `ticket_status`, `ticket_priority`, `work_order_status`, `work_order_priority`, `inspection_status`.

Generic `status` and `priority` remain rejected with HTTP 400. Unknown unrelated query parameters retain the existing ignored behavior. Inspection priority remains deferred because the Reporting response has no inspection priority breakdown and destination date/priority contracts for Inspection lists are incomplete for Reporting parity.

## Module-Specific Semantics

- `ticket_status` / `ticket_priority` affect only FM Ticket aggregation.
- `work_order_status` / `work_order_priority` affect only Work Order aggregation.
- `inspection_status` affects only Inspection aggregation.
- Organization, Building, and date range continue applying to every module.
- Multiple module-specific filters may be active simultaneously.
- Empty or omitted module filters mean no module-specific restriction.

## Validation Behavior

- Valid canonical model enum values are accepted exactly.
- Empty or omitted values are ignored.
- Unsupported values return field-specific HTTP 400 details.
- No silent normalization of unknown values.
- Generic `status` / `priority` remain explicitly rejected under the FO-064A contract.
- Unrelated unknown query parameters continue to be ignored by the Reporting filter resolver.

## Response Changes

The overview `filters` echo now includes:

- `ticket_status`
- `ticket_priority`
- `work_order_status`
- `work_order_priority`
- `inspection_status`

Canonical values are echoed when active; empty filters echo `null`. Existing metric field names are unchanged. Zero-result filtered modules remain valid. Average Inspection score remains null when no scored Inspection matches.

## Frontend Filter Groups

- Common Scope: Date From, Date To, Organization, Building
- FM Tickets: Ticket Status, Ticket Priority
- Maintenance Work Orders: Work Order Status, Work Order Priority
- 5S Inspections: Inspection Status

Draft filters do not fire requests until Apply. Reset clears every module-specific filter. Organization/Building relationship behavior and date validation remain intact. No tenant selector.

Active-filter summary uses module-qualified labels and Organization/Building display names when available.

## Query Keys and API Changes

- Reporting parameter and response filter types include the five module-specific fields.
- Serialization omits blanks and never emits generic `status` / `priority`.
- Query-key normalization includes all approved module parameters.
- Equivalent filters produce stable keys; different module filters produce distinct keys.
- Auth / `reporting.view` gating remains unchanged.

## Drill-Down Mappings

- `/fm-tickets`: `status`, `priority`, `organization`, `building`, plus fixed `from=reporting`
- `/maintenance/work-orders`: `status`, `priority`, `organization`, `building`, `created_from`, `created_to`, plus fixed `from=reporting`
- `/inspection/inspections`: `status`, `organization`, `building`, plus fixed `from=reporting`

Rules:

- No tenant UUID
- No cross-module leakage
- Blanks omitted
- Malformed enum/date values fail closed
- Internal relative URLs only
- Ticket and Inspection Reporting date ranges are omitted because those destination lists expose no matching date controls
- Work Order dates map to list `created_*` parameters while Reporting aggregates on `requested_at`, so exact date parity is not claimed

## Destination Hydration Behavior

Destination list pages minimally hydrate supported URL filters on initial state:

- Ticket: status, priority, organization, building
- Work Order: status, priority, organization, building, createdFrom/createdTo
- Inspection: status, organization, building

Invalid URL values fail safely to defaults. Fixed `from=reporting` shows a “Back to Reporting” link. Browser Back remains available.

## Permission-Aware Actions

- FM Tickets: `fm_tickets.view`
- Work Orders: `maintenance.view` or `maintenance.work_order.view`
- Inspections: `inspection.view` or `inspection.manage`

Unauthorized drill-down actions are hidden. Destination route and backend permissions remain authoritative. Reporting access does not grant Ticket, Maintenance, or Inspection detail access.

## Tenant Isolation

Tenant scoping remains backend-authoritative and is applied before aggregation. Module filters cannot alter tenant scope. Cross-tenant rows remain excluded. Global-user Reporting behavior is unchanged.

## Accessibility

Filters use fieldsets, legends, and labeled controls. Active-filter summary remains readable. Drill-downs are descriptive keyboard-accessible links. Tables do not rely on click-only rows. Color is not the only active-filter indicator.

## Responsive Behavior

Common and module-specific filter groups stack cleanly. Drill-down actions remain reachable on narrow screens. Existing Reporting cards/tables are preserved.

## Tests

Backend coverage includes:

- Valid/invalid Ticket status and priority
- Valid/invalid Work Order status and priority
- Valid/invalid Inspection status
- Generic status/priority rejection
- Per-module isolation and independent combined filters
- Null echoes and zero-result validity
- Filter-options endpoint unchanged by module filters

Frontend coverage includes:

- Module filter serialization and reset
- Query-key stability/distinctness
- Filter summary labels
- Drill-down URL mapping, encoding, and fail-closed behavior
- Destination hydration and return marker
- Permission-aware visibility

## Validation

Recovered from PostgreSQL `test_facilityops_db` locking, then reran to exit code 0:

| Check | Result |
| --- | --- |
| `apps.reporting` | 72 OK, exit 0 |
| `apps.accounts` + `apps.access_control` | 109 OK, exit 0 |
| `apps.fm_tickets` + `apps.maintenance` + `apps.inspection` | 211 OK, exit 0 |
| `apps.dashboard` + `apps.notifications` | 80 OK, exit 0 |
| Full suite `--parallel 4` | 498 OK, exit 0 |
| `manage.py check` | clean, exit 0 |
| `makemigrations --check --dry-run` | No changes detected, exit 0 |
| Frontend `npm test` | 176 pass, exit 0 |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; routes include `/reporting`, `/fm-tickets`, `/maintenance/work-orders`, `/inspection/inspections` |

## Migration and Dependency Status

- No migration
- No Reporting model
- No dependency addition

## Manual Acceptance Checklist

1. Apply Ticket Status only: Ticket totals change; Work Order and Inspection totals do not.
2. Apply Work Order Priority only: Work Order totals change; Ticket and Inspection totals do not.
3. Apply Inspection Status only: Inspection totals change; Ticket and Work Order totals do not.
4. Apply multiple module filters together.
5. Open each permitted drill-down and confirm hydrated filters.
6. Confirm unauthorized module drill-down is hidden or denied safely.
7. Reset all filters.
8. Confirm Browser Back and “Back to Reporting” are safe.

Manual acceptance and final Reporting QA remain pending.

## Deferred Scope and Known Limitations

Exports, charts, scheduled reports, Notification analytics, AI/realtime, Foundation Dashboard changes, FO-063, inspection priority, and exact cross-list date parity remain deferred.

## Files Changed

Reporting services, serializer and tests; Reporting frontend types, helpers, UI and tests; destination list hydration/back links; query keys, test script, and development trackers.

## Commit SHA

`443a8edbb7924c12a0c49a4fd86091efdaad6ec7`

## PR #38 State

Remains open, draft, and unmerged.
