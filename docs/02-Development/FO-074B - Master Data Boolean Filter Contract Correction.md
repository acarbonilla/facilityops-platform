# FO-074B - Master Data Boolean Filter Contract Correction

## Status

Correction complete at implementation commit `195686c`; focused validation
passed. FO-074D records passed user manual acceptance on 2026-07-19 and the
593-test final cumulative backend gate. Sol's cumulative final review remains
pending. PR #40 remains open, draft, and unmerged.

## Manual acceptance failure

FO-074A manual acceptance failed and paused on 2026-07-19. The browser-observed
`/master-data/tenants` Active view returned HTTP 400 and displayed
`Is active: Invalid filter value.` The failure prevents lifecycle list loading
across the shared eight-resource interface and is classified Medium severity.

## Root cause and correction

`buildLifecycleListParams()` emits JavaScript booleans and the shared API client
serializes them as lowercase `true` or `false`. The reusable backend filter
previously passed those raw strings to Django ORM BooleanField filtering, which
rejected them.

`apply_query_param_filters()` now detects Django BooleanField targets and
normalizes textual `true`/`false` case-insensitively plus `1`/`0`. Invalid or
arbitrary values still return HTTP 400 with:

`{"is_active": ["Invalid filter value."]}`

UUID and foreign-key filters are unchanged. Ordinary lists still exclude
deleted records, `include_deleted` remains unsupported, and tenant scope is
applied before filtering.

## Regression coverage

Backend coverage proves the Boolean contract for Tenant and Organization list
endpoints, including lowercase and title-case text, `1`/`0`, invalid values,
empty and omitted filters, deleted-record exclusion, and tenant isolation.
Master Data now has 80 passing tests.

The frontend production contract and tests are unchanged. Existing lifecycle
helper assertions confirm Active uses `is_active: true`, Inactive uses
`is_active: false`, and Deleted omits `is_active`. Code review confirms the
private API URL resolver serializes those booleans to lowercase strings; no
internal API was exposed only for testing.

## Focused validation

- `python manage.py test apps.master_data --noinput`: 80 passed.
- `python manage.py check`: no issues.
- `python manage.py makemigrations --check --dry-run`: no changes.
- `npm test`: 225 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- Production build was not repeated because frontend production code did not
  change; the passed FO-074 build baseline remains applicable.

No migration, dependency, lockfile, generated Next.js file, build artifact, or
unrelated feature change was introduced.

## Final reconciliation

FO-074D records user confirmation that Active, Inactive, and Deleted filters
and tenant isolation work, unauthorized mutation is rejected, and no runtime
overlay appears. Manual acceptance passed on 2026-07-19. The final backend
suite passed 593 tests with all required checks at exit 0.

FO-074C reconciles Facility Manager read access and removes the frontend Staff
permission bypass. Master Data Management is complete on the branch. Sol's
cumulative final review remains pending. FO-075 has not started, and Employee
Requester Experience remains next. PR #40 remains open, draft, and unmerged.
