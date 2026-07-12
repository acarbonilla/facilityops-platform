# FO-048 - Shared User Directory and Assignment Pickers

## Assignment-safe permission contract

The shared active-user directory is authorized separately from User Management:

| Method | Endpoint | Permission |
| ------ | -------- | ---------- |
| GET | `/api/users/` | `users.view` |
| GET | `/api/users/{id}/` | `users.view` |
| GET | `/api/users/directory/` | `users.directory` |

`users.directory` grants only the tenant-scoped, active-user directory action. It does not grant list, detail, create, update, delete, role assignment, staff-state, or password access. The response remains limited to `id`, `email`, `first_name`, `last_name`, `display_name`, `tenant`, `organization`, and `is_active`, with existing search, filtering, ordering, and pagination behavior preserved.

## Seeded role review

- `system_admin` receives `users.directory` because it is the seeded user-administration role and must explicitly carry both administrative and directory capabilities.
- `facility_manager` receives `users.directory` because it currently carries `maintenance.assign`, `inspection.assign`, and `inspection.manage_corrective_action`, covering maintenance assignee, inspection assignee, and corrective-action owner selection.
- `inspector`, `technician`, and `viewer` do not receive `users.directory` because their seeded permissions do not include these assignment-owner workflows.

The endpoint performs no hardcoded fallback checks for module assignment permissions. A custom role with `maintenance.assign` or `inspection.assign` must also be explicitly granted `users.directory` to use the directory.

## Shared picker architecture

`UserDirectoryPicker` is a controlled UUID-valued component backed by the existing `getUserDirectory` API function, `useUserDirectory` query hook, and `usersQueryKeys.directory` namespace. It uses `display_name` as the primary label and email as supporting identification. No second API client, unrestricted detail lookup, dependency, or role metadata was added.

The picker debounces backend search by 300 milliseconds, requests 20 users per page ordered by email, resets to page one when search or scope changes, and includes search, tenant, organization, page, page size, and ordering in its stable query key. Queries are disabled when the actor lacks `users.directory` or the surrounding control is disabled. Loading, no-results, API-error, disabled, pagination, and explicit clear states are exposed accessibly.

## Selected-value and scope behavior

Inspection responses expose a selected user UUID plus email rather than a nested directory object. The picker converts those two safe fields into a minimal fallback label with unknown tenant and organization, merges it with fetched results, and removes duplicate IDs. This keeps an existing selection visible when it is absent from the current search or page without introducing an unrestricted lookup.

A selected user is cleared only when known directory metadata confirms that its tenant, or its organization when organization scoping applies, conflicts with the newly selected scope. Unknown fallback scope and simple absence from a result page never clear a value. The backend remains authoritative for tenant isolation and active-user filtering.

## Maintenance contract alignment

Maintenance retains its existing role-aware `/assignment-candidates/` endpoint, technician/supervisor eligibility filtering, UUID payload keys, permissions, mutations, and query invalidation. It does not use the broader shared directory.

The create/edit work-order form previously showed planning-only Assigned technician and Supervisor controls, plus task technician and labor technician controls. These values were populated from email labels, omitted from every create/update/task/labor payload, and therefore misleading. FO-048B removes those controls and their dead form defaults, schemas, and mapping logic. The form now explains that persisted technician and supervisor changes occur through the dedicated assignment workflow. Maintenance create and update payload contracts are unchanged.

## Inspection integrations

The shared picker replaces user UUID handling for these persisted fields while retaining their exact payload keys and nullable rules:

- Inspection create/edit: `inspector` and `supervisor`.
- Inspection assignment workflow: `inspector` and `supervisor`; at least one remains required.
- Corrective-action create/edit: optional `assigned_to`, with clearing serialized as `null`.

Each picker receives the parent inspection tenant and organization. Directory access requires `users.directory`, while form submission, workflow assignment, and corrective-action mutation continue to require their existing Inspection permissions. `users.directory` never authorizes a mutation.

## Tests and limitations

Pure helper tests cover option mapping, supporting email metadata, fallback preservation and deduplication, UUID/null normalization, scope compatibility, permission-disabled queries, scoped query keys, Maintenance payload stability, Inspection create/update assignment fields, workflow assignment validation, and corrective-action clearing. The project intentionally retains helper-level frontend testing because no component testing framework is installed.

Safe selected-user fallbacks show the response email when full directory data is unavailable. Their tenant and organization remain unknown rather than inferred, so the frontend retains them until the backend or known directory metadata can confirm incompatibility.

Validation completed with 43 frontend helper tests, ESLint, TypeScript, and the production Next.js build passing. Django system checks and migration detection passed with no changes, and the full parallel backend suite passed all 204 tests. The requested serial four-app suite produced 143 passing progress markers without a failure but exceeded its 20-minute command window; the conclusive full parallel suite covered those same apps.
