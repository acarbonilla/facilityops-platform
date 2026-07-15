# FacilityOps Work Tree

## Status Legend

- Complete
- In Progress
- Pending
- Needs Review
- Blocked

## Current Snapshot

| Module | Status | Primary Scope |
| ------- | ------ | ------------- |
| Foundation | Complete | Repo structure, backend core, app shell, providers |
| Authentication | Complete | JWT auth, login, current user, remember email |
| Authorization / RBAC | Complete | Role and permission APIs, frontend guards, admin RBAC screens |
| Master Data | Complete | Tenant, organization, department, building, floor, area, asset type, asset CRUD |
| Dashboard | Complete | Foundation metrics backend and frontend dashboard shell. Review note: foundation counts are globally scoped and must not be reused by Reporting; any Foundation Dashboard correction requires a separate confirmed task |
| Notifications | Complete | FO-055 through FO-060 complete on `feature/notifications`; draft PR #34 awaits Sol independent cumulative final review |
| User Management | Complete | FO-045 through FO-049 backend, frontend, role assignment, directory/pickers, QA, and stabilization |
| Organization Management | Complete | Admin structure views built on master-data services |
| Asset Management | Complete | Asset read, detail, create, edit, and admin alias screens |
| FM Ticketing | Complete | Explicit Work Order generation, linked Work Order navigation, and Work Order-to-Ticket status synchronization implemented; completion resolves but does not close the Ticket; FO-063 automatic closure remains deferred |
| Maintenance Work Order | Complete | One-to-one `source_ticket` linkage, same-tenant technician assignment via `assign_work_order()`, standalone Work Orders remain supported, and linked Work Order → Ticket status synchronization implemented |
| FM Ticket ↔ Maintenance Integration | Complete | FO-061 through FO-062C implemented and approved; PR #36 merged to `main` using the normal merge-commit strategy (`e509b4f`); FO-062D post-merge reconciliation complete; FO-063 remains deferred |
| Reporting and Operational Analytics | In Progress | FO-064 backend aggregation foundation complete on `feature/reporting`; `reporting.view` seeded; `GET /api/reporting/overview/` tenant-scoped; frontend (FO-065), export, and charts deferred |
| 5S Inspection | Complete | FO-038 through FO-044: backend foundation, RBAC alignment, protected read screens, create/edit forms, lifecycle workflow, findings/corrective-action management, stored AI-analysis review, QA and stabilization |
| Shared Services | Complete | Shared backend helpers and frontend utilities |
| API Client | Complete | Shared frontend API client, endpoints, query keys, contracts |
| UI Components | Complete | Shared auth, layout, form, table, and feature components |
| Testing | Complete | FO-062B (2026-07-15): Backend `apps.fm_tickets` 63, `apps.maintenance` 84, `apps.notifications` 78, `apps.accounts`+`access_control` 109, full `--parallel 4` 426 OK; Frontend: 135 helper tests, ESLint, TypeScript, and production build pass; no component/integration harness exists yet |
| Configuration | Complete | Django settings, Celery, env examples, Next/Tailwind toolchain |
| Developer Handbook | Complete | Permanent engineering process, governance, QA, and repository documentation foundation |

## Repository Work Tree

```text
facilityops-platform/
|- backend/
|  |- api/
|  |- apps/
|  |  |- accounts/
|  |  |- access_control/
|  |  |- core/
|  |  |- dashboard/
|  |  |- fm_tickets/
|  |  |- inspection/
|  |  |- maintenance/
|  |  `- master_data/
|  |- common/
|  |- config/
|  `- requirements/
|- frontend/
|  |- app/
|  |- components/
|  |- features/
|  |- hooks/
|  |- lib/
|  |- services/
|  `- types/
|- docs/
|- infrastructure/
`- shared/
```

## Progress Coverage

- Complete task coverage through FO-037 is present in code and in `docs/02-Development/`.
- FO-038 adds the first 5S Inspection backend implementation and keeps the module overall `In Progress` until the frontend workflow surfaces land.
- FO-038B aligns inspection, finding, and corrective-action `PUT`/`DELETE` behavior with seeded RBAC and hides soft-deleted records from standard reads.
- FO-039 adds protected frontend inspection list and detail routes with backend-driven search, filtering, sorting, pagination, and read-only nested data sections.
- FO-040 adds protected frontend inspection create and edit routes, nested checklist form persistence, permission-gated list/detail actions, and detail-page success flash messaging.
- FO-041 adds permission-aware inspection lifecycle actions, workflow dialogs, and backend status-history timeline rendering on inspection detail.
- FO-042A adds the inspection sidebar entry, hardens frontend query serialization so nullable filters are omitted before master-data form-options requests hit the backend, suppresses placeholder checklist item submission during create, and keeps cross-tenant inspector auto-defaulting from violating backend tenant validation.
- FO-043 separates AI-analysis read/write permissions, adds deterministic inspection context preparation, and delivers advisory frontend AI-analysis review/edit UI without connecting an external AI provider.
- FO-044 completes 5S Inspection module QA and stabilization: four defects corrected (checklist pass/fail preservation, AI-analysis GET mutation, inspection soft-delete centralization, maintenance reassignment test tenant isolation), 168 backend tests pass, 10 frontend checklist mapping tests pass via formally configured `npm run test`, ESLint, TypeScript, and production build clean.
- FO-045 through FO-049 complete User Management CRUD, tenant/security hardening, role assignment, assignment-safe directory/pickers, and cumulative QA.
- FO-050 through FO-054 complete Roles and Permissions backend foundation, frontend workflows, permission assignment, duplication and system-role protection, and cumulative module QA; FO-054 validation gates pass at 66 Access Control tests, 109 Accounts+Access Control tests, canonical full backend parallel discovery baseline of 250 tests, and 65 frontend helper tests.
- Notifications is `Complete`: FO-055 through FO-060 are complete on `feature/notifications`. Draft PR #34 awaits Sol’s independent cumulative final review.
- FO-DOC-001 establishes the permanent developer handbook under `docs/04-Developer-Handbook/`, adds `docs/development/project-status.md`, and defines repository-level process ownership, QA expectations, merge workflow, and documentation standards.
- `infrastructure/` and `shared/` remain reserved workspace areas rather than active product modules.

## Foundation

Status: Complete

### Purpose

Establishes the monorepo structure, Django base application, shared API wiring, frontend app shell, providers, and health-check entry points that all other modules depend on.

### Backend

- Apps: `apps.core`, shared `api`, `config`, and `common`
- Models: `UUIDModel`, `TimeStampedModel`, `SoftDeleteModel`, `AuditModel`, `BaseModel`
- Serializers: None in `apps.core`; shared response shape handled through helper functions
- ViewSets / Views: `health_check`
- APIs: `/api/health/`
- Services: `apps.core.tasks.celery_health_check`, `common.responses`, `common.pagination`, `common.exceptions`
- Permissions: No dedicated shared permission layer yet; `backend/common/permissions.py` is still a placeholder
- Admin: `apps.core.admin` exists, but no core model registrations are defined
- Tests: `backend/apps/core/tests.py`

### Frontend

- Routes: `/`, shared root layout
- Module Folder: `frontend/app`, `frontend/components/layout`, `frontend/components/providers`
- Pages: `app/page.tsx`, `app/layout.tsx`
- Components: `AppShell`, `Header`, `Sidebar`, `MainContent`, `AppProviders`, `AuthProvider`, `QueryProvider`
- Hooks: `use-auth`
- API Files: `services/api/client.ts`, `services/api/health.ts`
- Types: `types/auth.ts`, `services/api/types.ts`
- RBAC Usage: Foundation layout reads authenticated state and sidebar navigation; route-level permission guards are layered on top
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-001, FO-002, FO-003, FO-007, and FO-018 foundation stabilization work.
- The home page is a lightweight backend connectivity check rather than a business dashboard.

## Authentication

Status: Complete

### Purpose

Provides login, token refresh, logout, current-user retrieval, client token storage, and remembered-email UX for authenticated sessions.

### Backend

- Apps: `apps.accounts`
- Models: `User`
- Serializers: `UserSerializer`, `LoginSerializer`, `LogoutSerializer`
- ViewSets / Views: `LoginView`, `RefreshView`, `LogoutView`, `CurrentUserView`
- APIs: `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/`, `/api/auth/me/`
- Services: Serializer-driven authentication flow; no separate service module
- Permissions: `AllowAny` for login, refresh, logout; exported `IsAuthenticated` alias for current user
- Admin: `UserAdmin`
- Tests: `backend/apps/accounts/tests.py`

### Frontend

- Routes: `/login`, authenticated session access across app routes
- Module Folder: `frontend/components/auth`, `frontend/components/providers`, `frontend/lib/auth`
- Pages: `app/(auth)/login/page.tsx`
- Components: `UserMenu`, `UserAvatar`, `CurrentUserCard`, `ProtectedRoute`
- Hooks: `use-auth`
- API Files: `services/api/auth.ts`
- Types: `types/auth.ts`
- RBAC Usage: Authentication state gates protected routes before permission-specific guards run
- Tests: No dedicated frontend tests

### Notes

- Remembered email support lives in `frontend/lib/auth/remembered-email.ts`.
- Tokens are stored client-side in local storage, which is acceptable for current local-development scope but should be revisited for production hardening.

## Authorization / RBAC

Status: Complete

### Purpose

Controls role and permission lookup, frontend permission-aware navigation, and admin RBAC visibility for roles and permission catalogs.

### Backend

- Apps: `apps.access_control`
- Models: `Role`, `Permission`, `RolePermission`, `UserRole`
- Serializers: `RoleSerializer`, `PermissionSerializer`, `UserPermissionSerializer`
- ViewSets / Views: `RoleListView`, `PermissionListView`, `CurrentUserPermissionsView`
- APIs: `/api/access-control/roles/`, `/api/access-control/permissions/`, `/api/access-control/me/permissions/`
- Services: `get_user_roles`, `get_user_permission_codes`, `user_has_permission`
- Permissions: `HasPermissionCode`
- Admin: `RoleAdmin`, `PermissionAdmin`, `RolePermissionAdmin`, `UserRoleAdmin`
- Tests: `backend/apps/access_control/tests.py`

### Frontend

- Routes: `/roles`, `/admin`, `/admin/roles`, `/admin/roles/[id]`, `/admin/permissions`
- Module Folder: `frontend/features/admin/rbac`, `frontend/components/auth`, `frontend/lib`
- Pages: admin RBAC pages plus permission-guard wrappers
- Components: `RoleListScreen`, `RoleDetailScreen`, `PermissionListScreen`, `PermissionGroupSection`, `PermissionGuard`, `ProtectedPermissionRoute`, `ProtectedRoute`
- Hooks: `use-permissions`
- API Files: `services/api/rbac.ts`
- Types: `types/rbac.ts`
- RBAC Usage: Sidebar entries and route guards filter by permission code, with optional `any` permission mode for Admin
- Tests: No dedicated frontend tests

### Notes

- The frontend defines role and permission detail endpoints, but the backend currently only exposes list endpoints; `services/api/rbac.ts` falls back to list payload lookup when detail routes return 404.
- This module covers FO-009, FO-013, and FO-020.

## Master Data

Status: Complete

### Purpose

Maintains foundational reference data for tenants, organizations, departments, buildings, floors, areas, asset types, and assets.

### Backend

- Apps: `apps.master_data`
- Models: `Tenant`, `Organization`, `Department`, `Building`, `Floor`, `Area`, `AssetType`, `Asset`
- Serializers: matching model serializers for all eight resources
- ViewSets / Views: `TenantViewSet`, `OrganizationViewSet`, `DepartmentViewSet`, `BuildingViewSet`, `FloorViewSet`, `AreaViewSet`, `AssetTypeViewSet`, `AssetViewSet`
- APIs: `/api/master-data/tenants/`, `/organizations/`, `/departments/`, `/buildings/`, `/floors/`, `/areas/`, `/asset-types/`, `/assets/`
- Services: `apply_query_param_filters`
- Permissions: `IsAuthenticated` plus `HasPermissionCode` through `MasterDataPermissionMixin`; read uses `settings.view`, write uses `settings.manage`
- Admin: all master-data models are registered in `backend/apps/master_data/admin.py`
- Tests: `backend/apps/master_data/tests.py`

### Frontend

- Routes: `/master-data`, resource list pages, resource create pages, and resource edit pages for all eight resources
- Module Folder: `frontend/components/master-data`, `frontend/features/master-data`, `frontend/lib/master-data`
- Pages: landing page plus per-resource read/create/edit pages
- Components: `MasterDataLandingContent`, `MasterDataListScreen`, `TenantForm`, `OrganizationForm`, `DepartmentForm`, `BuildingForm`, `FloorForm`, `AreaForm`, `AssetTypeForm`, `AssetForm`, shared form page builders
- Hooks: No dedicated master-data hooks; pages use TanStack Query directly
- API Files: `services/api/master-data.ts`
- Types: `types/master-data.ts`
- RBAC Usage: resource routes depend on `settings.view`; create and edit actions depend on `settings.manage`
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-010, FO-015, and FO-016.
- Delete, bulk actions, import/export, and domain workflows remain deferred.

## Dashboard

Status: Complete

### Purpose

Provides a simple authenticated dashboard for foundation metrics and quick navigation rather than operational analytics.

### Backend

- Apps: `apps.dashboard`
- Models: None; counts are aggregated from `apps.master_data`
- Serializers: `FoundationSummarySerializer`
- ViewSets / Views: `FoundationSummaryView`
- APIs: `/api/dashboard/foundation-summary/`
- Services: local helper `get_active_count`
- Permissions: `IsAuthenticated`
- Admin: None
- Tests: `backend/apps/dashboard/tests.py`

### Frontend

- Routes: `/dashboard`
- Module Folder: `frontend/features/dashboard`
- Pages: `app/(app)/dashboard/page.tsx`
- Components: `FoundationSummary`, `MetricCard`, `QuickLinks`, `SystemStatusCard`
- Hooks: No dedicated dashboard hook; dashboard page uses shared API layer
- API Files: `services/api/dashboard.ts`
- Types: `types/dashboard.ts`
- RBAC Usage: authenticated route; no separate permission code beyond login state
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-017.
- Metrics currently focus on setup completeness, not ticket or maintenance operations.

## User Management

Status: Complete

### Purpose

Provides tenant-scoped user administration, role assignment, and assignment-safe directory access with cumulative QA through FO-049.

### Backend

- Apps: `apps.accounts`, `apps.access_control`
- Models: `User`
- Serializers: dedicated read, write, directory, and role-assignment serializers
- ViewSets / Views: authenticated `UserViewSet` plus existing authentication views
- APIs: user list/create/detail/update/deactivate, active directory, and per-user role read/replacement
- Services: tenant-scoped create, update, deactivation, and atomic role replacement
- Permissions: action-specific `users.*`, `roles.*`, and least-privilege `users.directory`
- Admin: `UserAdmin`
- Tests: 63 focused accounts/access-control tests; 204 full backend tests

### Frontend

- Routes: `/admin/users`, `/admin/users/new`, `/admin/users/[id]`, `/admin/users/[id]/edit`
- Module Folder: `frontend/features/admin/users`
- Pages: protected list, create, detail, and edit pages
- Components: user list/detail/form/deactivation/role dialogs plus shared directory picker
- Hooks: `use-users` and existing auth/permission hooks
- API Files: `services/api/users.ts`
- Types: `types/users.ts`
- RBAC Usage: route is guarded by `users.view`
- Tests: helper-level user, role, directory, Inspection payload, and Maintenance compatibility coverage within the 43-test frontend suite

### Notes

- FO-045 through FO-049 are complete. Backend authorization remains authoritative; frontend guards are advisory.
- Invitations, password-reset email, SSO, bulk import, and role-definition editing remain out of scope.

## Organization Management

Status: Complete

### Purpose

Provides an admin-oriented structure view across tenants, organizations, departments, buildings, floors, and areas using the master-data backend rather than a separate organization app.

### Backend

- Apps: reuses `apps.master_data`
- Models: `Tenant`, `Organization`, `Department`, `Building`, `Floor`, `Area`
- Serializers: corresponding master-data serializers
- ViewSets / Views: master-data viewsets
- APIs: master-data endpoints for the six structure resources
- Services: `apply_query_param_filters`
- Permissions: `settings.view` for read and `settings.manage` for create/edit
- Admin: handled by master-data admin registrations
- Tests: `backend/apps/master_data/tests.py`

### Frontend

- Routes: `/admin/organization`, `/admin/organization/tenants`, `/organizations`, `/departments`, `/buildings`, `/floors`, `/areas`
- Module Folder: `frontend/features/admin/organization`
- Pages: organization landing page plus per-resource admin alias pages
- Components: `OrganizationManagementScreen`, `OrganizationStructureCard`, `OrganizationHierarchy`
- Hooks: No dedicated hooks; screen composes TanStack Query calls to master-data APIs
- API Files: `services/api/master-data.ts`
- Types: `types/master-data.ts`
- RBAC Usage: route is guarded by `settings.view`; create links rely on `settings.manage`
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-022.
- The admin organization area is an orchestration layer over master data, not a separate domain backend.

## Asset Management

Status: Complete

### Purpose

Supports asset listing, detail, create, edit, and admin alias screens using the master-data asset model and frontend asset-focused presentation components.

### Backend

- Apps: reuses `apps.master_data`
- Models: `Asset`, `AssetType`, plus related location and organization models
- Serializers: `AssetSerializer`, `AssetTypeSerializer`
- ViewSets / Views: `AssetViewSet`, `AssetTypeViewSet`
- APIs: `/api/master-data/assets/`, `/api/master-data/asset-types/`
- Services: `apply_query_param_filters`
- Permissions: `settings.view` for read and `settings.manage` for write
- Admin: `AssetAdmin`, `AssetTypeAdmin`
- Tests: `backend/apps/master_data/tests.py`

### Frontend

- Routes: `/master-data/assets`, `/master-data/assets/new`, `/master-data/assets/[id]`, `/master-data/assets/[id]/edit`, `/admin/assets`
- Module Folder: `frontend/features/assets`, `frontend/features/master-data`, `frontend/components/master-data`
- Pages: asset list, detail, create, edit, and admin alias page
- Components: `AssetList`, `AssetDetail`, `AssetFilters`, `AssetFormSection`, `AssetLocationBreadcrumb`, shared asset form pages
- Hooks: No dedicated asset hook; asset screens use shared master-data API calls
- API Files: `services/api/master-data.ts`
- Types: `types/master-data.ts`
- RBAC Usage: read uses `settings.view`; create and edit use `settings.manage`
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-023.
- Asset management still excludes inspections, bulk actions, delete, and reporting.

## FM Ticketing

Status: Complete

### Purpose

Manages facility-management tickets, including read, create, edit, comments, history, assignment, status workflow, and escalation support.

### Backend

- Apps: `apps.fm_tickets`
- Models: `FmTicket`, `FmTicketEscalation`, `FmTicketComment`, `FmTicketHistory`, `FmTicketStatusHistory`
- Serializers: list, detail, create, update, comment, history, escalation, assignment, and status-change serializers
- ViewSets / Views: `FmTicketViewSet`
- APIs: `/api/fm-tickets/tickets/`, `/tickets/{id}/`, `/comments/`, `/history/`, `/escalations/`, `/escalate/`, `/assign/`, `/change-status/`
- Services: ticket creation/update helpers, history recording, status transitions, assignment, escalation resolution and creation, SLA calculation
- Permissions: `HasTicketPermission` with `fm_tickets.view`, `create`, `update`, `assign`, `close`, and `manage`
- Admin: `FmTicketAdmin`, `FmTicketCommentAdmin`, `FmTicketHistoryAdmin`, `FmTicketStatusHistoryAdmin`, `FmTicketEscalationAdmin`
- Tests: `backend/apps/fm_tickets/tests.py`

### Frontend

- Routes: `/fm-tickets`, `/fm-tickets/new`, `/fm-tickets/[id]`, `/fm-tickets/[id]/edit`
- Module Folder: `frontend/features/fm-tickets`
- Pages: list, detail, create, and edit pages
- Components: `TicketListScreen`, `TicketDetailScreen`, `TicketFormPage`, `TicketForm`, `TicketComments`, `TicketCommentForm`, `TicketHistory`, `TicketAssignmentPanel`, `TicketStatusActions`, `TicketSlaPanel`, `TicketEscalationForm`, `TicketEscalationHistory`, badge and shared display components
- Hooks: No dedicated FM ticket hook layer; feature components use queries and mutations directly
- API Files: `services/api/fm-tickets.ts`
- Types: `types/fm-tickets.ts`
- RBAC Usage: view, create, update, assign, manage, and close permissions drive route access and action visibility
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-024 through FO-030.
- FO-058A assignment and status-change in-app notifications are implemented; comment, escalation, attachment, and AI notification workflows remain deferred.

## Maintenance Work Order

Status: Complete

### Purpose

Manages planned and corrective maintenance activities for assets, locations, technicians, materials, labor, SLA tracking, AI summaries, and work order history.

### Backend

- Apps: `apps.maintenance`
- Models: `MaintenanceWorkOrder`, `MaintenanceAssignment`, `MaintenanceTask`, `MaintenanceMaterial`, `MaintenanceLabor`, `MaintenanceAttachment`, `MaintenanceAISummary`, `MaintenanceSupervisorApproval`, `MaintenanceCompletion`, `MaintenanceHistory`, `MaintenanceStatusHistory`, `MaintenanceEscalation`, `MaintenanceSLA`
- Serializers: list, detail, create, update, assignment, status-change, completion, history, SLA, attachment, task, material, labor, AI summary, approval, escalation serializers
- ViewSets / Views: `MaintenanceWorkOrderViewSet`
- APIs: work-order list/create/retrieve/patch, dashboard/history, dedicated status actions, assignment/reassignment/unassignment/history/candidates, SLA retrieve/recalculate, and escalation history/acknowledge/resolve
- Services: work-order create/update helpers, status and assignment workflow services, priority-based SLA calculation, escalation detection/lifecycle, completion validation, and history recording
- Permissions: `HasMaintenancePermission` with maintenance CRUD/status permissions plus assignment and SLA/escalation `maintenance.work_order.*` permissions
- Admin: all maintenance domain models are registered in `backend/apps/maintenance/admin.py`
- Tests: `backend/apps/maintenance/tests/test_maintenance.py`

### Frontend

- Routes: `/maintenance`, `/maintenance/work-orders`, `/maintenance/work-orders/[id]`, `/maintenance/work-orders/new`, `/maintenance/work-orders/[id]/edit`
- Module Folder: `frontend/features/maintenance`, `frontend/lib/maintenance`
- Pages: dashboard, list, detail, create, and edit pages
- Components: maintenance dashboard/list/detail/form components, status and assignment workflows, SLA/overdue/escalation badges, `MaintenanceSLACard`, `MaintenanceEscalationCard`, escalation timeline/actions, filters, pagination, and shared sections
- Hooks: maintenance dashboard/list/detail/history/form hooks, status and assignment workflow hooks, plus SLA recalculation and escalation lifecycle hooks
- API Files: `services/api/maintenance.ts`
- Types: `types/maintenance.ts`
- RBAC Usage: frontend and backend accept exact `maintenance.work_order.*` permissions with legacy `maintenance.*` compatibility and `maintenance.manage` override
- Tests: No dedicated frontend tests

### Notes

- FO-031 backend foundation is implemented.
- FO-032 frontend read surfaces are implemented in code, including dashboard, list, detail, filters, pagination, tasks, materials, labor, attachment metadata, SLA, AI summary, and history.
- FO-033 create/edit work-order pages, client validation, permission-gated actions, and backend create/update integration are now implemented.
- FO-034 dedicated maintenance status workflow actions are now implemented across backend and frontend, including `submit`, `assign`, `start`, `hold`, `resume`, `complete`, `cancel`, and `reopen`, plus backend status history action/reason tracking and frontend workflow dialogs.
- Types: `types/dashboard.ts`
- RBAC Usage: authenticated route; no separate permission code beyond login state
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-017.
- Metrics currently focus on setup completeness, not ticket or maintenance operations.

## User Management

Status: Complete

### Purpose

Provides tenant-scoped user administration, role assignment, and assignment-safe directory access with cumulative QA through FO-049.

### Backend

- Apps: `apps.accounts`, `apps.access_control`
- Models: `User`
- Serializers: dedicated read, write, directory, and role-assignment serializers
- ViewSets / Views: authenticated `UserViewSet` plus existing authentication views
- APIs: user list/create/detail/update/deactivate, active directory, and per-user role read/replacement
- Services: tenant-scoped create, update, deactivation, and atomic role replacement
- Permissions: action-specific `users.*`, `roles.*`, and least-privilege `users.directory`
- Admin: `UserAdmin`
- Tests: 63 focused accounts/access-control tests; 204 full backend tests

### Frontend

- Routes: `/admin/users`, `/admin/users/new`, `/admin/users/[id]`, `/admin/users/[id]/edit`
- Module Folder: `frontend/features/admin/users`
- Pages: protected list, create, detail, and edit pages
- Components: user list/detail/form/deactivation/role dialogs plus shared directory picker
- Hooks: `use-users` and existing auth/permission hooks
- API Files: `services/api/users.ts`
- Types: `types/users.ts`
- RBAC Usage: route is guarded by `users.view`
- Tests: helper-level user, role, directory, Inspection payload, and Maintenance compatibility coverage within the 43-test frontend suite

### Notes

- FO-045 through FO-049 are complete. Backend authorization remains authoritative; frontend guards are advisory.
- Invitations, password-reset email, SSO, bulk import, and role-definition editing remain out of scope.

## Organization Management

Status: Complete

### Purpose

Provides an admin-oriented structure view across tenants, organizations, departments, buildings, floors, and areas using the master-data backend rather than a separate organization app.

### Backend

- Apps: reuses `apps.master_data`
- Models: `Tenant`, `Organization`, `Department`, `Building`, `Floor`, `Area`
- Serializers: corresponding master-data serializers
- ViewSets / Views: master-data viewsets
- APIs: master-data endpoints for the six structure resources
- Services: `apply_query_param_filters`
- Permissions: `settings.view` for read and `settings.manage` for create/edit
- Admin: handled by master-data admin registrations
- Tests: `backend/apps/master_data/tests.py`

### Frontend

- Routes: `/admin/organization`, `/admin/organization/tenants`, `/organizations`, `/departments`, `/buildings`, `/floors`, `/areas`
- Module Folder: `frontend/features/admin/organization`
- Pages: organization landing page plus per-resource admin alias pages
- Components: `OrganizationManagementScreen`, `OrganizationStructureCard`, `OrganizationHierarchy`
- Hooks: No dedicated hooks; screen composes TanStack Query calls to master-data APIs
- API Files: `services/api/master-data.ts`
- Types: `types/master-data.ts`
- RBAC Usage: route is guarded by `settings.view`; create links rely on `settings.manage`
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-022.
- The admin organization area is an orchestration layer over master data, not a separate domain backend.

## Asset Management

Status: Complete

### Purpose

Supports asset listing, detail, create, edit, and admin alias screens using the master-data asset model and frontend asset-focused presentation components.

### Backend

- Apps: reuses `apps.master_data`
- Models: `Asset`, `AssetType`, plus related location and organization models
- Serializers: `AssetSerializer`, `AssetTypeSerializer`
- ViewSets / Views: `AssetViewSet`, `AssetTypeViewSet`
- APIs: `/api/master-data/assets/`, `/api/master-data/asset-types/`
- Services: `apply_query_param_filters`
- Permissions: `settings.view` for read and `settings.manage` for write
- Admin: `AssetAdmin`, `AssetTypeAdmin`
- Tests: `backend/apps/master_data/tests.py`

### Frontend

- Routes: `/master-data/assets`, `/master-data/assets/new`, `/master-data/assets/[id]`, `/master-data/assets/[id]/edit`, `/admin/assets`
- Module Folder: `frontend/features/assets`, `frontend/features/master-data`, `frontend/components/master-data`
- Pages: asset list, detail, create, edit, and admin alias page
- Components: `AssetList`, `AssetDetail`, `AssetFilters`, `AssetFormSection`, `AssetLocationBreadcrumb`, shared asset form pages
- Hooks: No dedicated asset hook; asset screens use shared master-data API calls
- API Files: `services/api/master-data.ts`
- Types: `types/master-data.ts`
- RBAC Usage: read uses `settings.view`; create and edit use `settings.manage`
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-023.
- Asset management still excludes inspections, bulk actions, delete, and reporting.

## FM Ticketing

Status: Complete

### Purpose

Manages facility-management tickets, including read, create, edit, comments, history, assignment, status workflow, and escalation support.

### Backend

- Apps: `apps.fm_tickets`
- Models: `FmTicket`, `FmTicketEscalation`, `FmTicketComment`, `FmTicketHistory`, `FmTicketStatusHistory`
- Serializers: list, detail, create, update, comment, history, escalation, assignment, and status-change serializers
- ViewSets / Views: `FmTicketViewSet`
- APIs: `/api/fm-tickets/tickets/`, `/tickets/{id}/`, `/comments/`, `/history/`, `/escalations/`, `/escalate/`, `/assign/`, `/change-status/`
- Services: ticket creation/update helpers, history recording, status transitions, assignment, escalation resolution and creation, SLA calculation
- Permissions: `HasTicketPermission` with `fm_tickets.view`, `create`, `update`, `assign`, `close`, and `manage`
- Admin: `FmTicketAdmin`, `FmTicketCommentAdmin`, `FmTicketHistoryAdmin`, `FmTicketStatusHistoryAdmin`, `FmTicketEscalationAdmin`
- Tests: `backend/apps/fm_tickets/tests.py`

### Frontend

- Routes: `/fm-tickets`, `/fm-tickets/new`, `/fm-tickets/[id]`, `/fm-tickets/[id]/edit`
- Module Folder: `frontend/features/fm-tickets`
- Pages: list, detail, create, and edit pages
- Components: `TicketListScreen`, `TicketDetailScreen`, `TicketFormPage`, `TicketForm`, `TicketComments`, `TicketCommentForm`, `TicketHistory`, `TicketAssignmentPanel`, `TicketStatusActions`, `TicketSlaPanel`, `TicketEscalationForm`, `TicketEscalationHistory`, badge and shared display components
- Hooks: No dedicated FM ticket hook layer; feature components use queries and mutations directly
- API Files: `services/api/fm-tickets.ts`
- Types: `types/fm-tickets.ts`
- RBAC Usage: view, create, update, assign, manage, and close permissions drive route access and action visibility
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-024 through FO-030.
- FO-058A assignment and status-change in-app notifications are implemented; comment, escalation, attachment, and AI notification workflows remain deferred.

## Maintenance Work Order

Status: Complete

### Purpose

Manages planned and corrective maintenance activities for assets, locations, technicians, materials, labor, SLA tracking, AI summaries, and work order history.

### Backend

- Apps: `apps.maintenance`
- Models: `MaintenanceWorkOrder`, `MaintenanceAssignment`, `MaintenanceTask`, `MaintenanceMaterial`, `MaintenanceLabor`, `MaintenanceAttachment`, `MaintenanceAISummary`, `MaintenanceSupervisorApproval`, `MaintenanceCompletion`, `MaintenanceHistory`, `MaintenanceStatusHistory`, `MaintenanceEscalation`, `MaintenanceSLA`
- Serializers: list, detail, create, update, assignment, status-change, completion, history, SLA, attachment, task, material, labor, AI summary, approval, escalation serializers
- ViewSets / Views: `MaintenanceWorkOrderViewSet`
- APIs: work-order list/create/retrieve/patch, dashboard/history, dedicated status actions, assignment/reassignment/unassignment/history/candidates, SLA retrieve/recalculate, and escalation history/acknowledge/resolve
- Services: work-order create/update helpers, status and assignment workflow services, priority-based SLA calculation, escalation detection/lifecycle, completion validation, and history recording
- Permissions: `HasMaintenancePermission` with maintenance CRUD/status permissions plus assignment and SLA/escalation `maintenance.work_order.*` permissions
- Admin: all maintenance domain models are registered in `backend/apps/maintenance/admin.py`
- Tests: `backend/apps/maintenance/tests/test_maintenance.py`

### Frontend

- Routes: `/maintenance`, `/maintenance/work-orders`, `/maintenance/work-orders/[id]`, `/maintenance/work-orders/new`, `/maintenance/work-orders/[id]/edit`
- Module Folder: `frontend/features/maintenance`, `frontend/lib/maintenance`
- Pages: dashboard, list, detail, create, and edit pages
- Components: maintenance dashboard/list/detail/form components, status and assignment workflows, SLA/overdue/escalation badges, `MaintenanceSLACard`, `MaintenanceEscalationCard`, escalation timeline/actions, filters, pagination, and shared sections
- Hooks: maintenance dashboard/list/detail/history/form hooks, status and assignment workflow hooks, plus SLA recalculation and escalation lifecycle hooks
- API Files: `services/api/maintenance.ts`
- Types: `types/maintenance.ts`
- RBAC Usage: frontend and backend accept exact `maintenance.work_order.*` permissions with legacy `maintenance.*` compatibility and `maintenance.manage` override
- Tests: No dedicated frontend tests

### Notes

- FO-031 backend foundation is implemented.
- FO-032 frontend read surfaces are implemented in code, including dashboard, list, detail, filters, pagination, tasks, materials, labor, attachment metadata, SLA, AI summary, and history.
- FO-033 create/edit work-order pages, client validation, permission-gated actions, and backend create/update integration are now implemented.
- FO-034 dedicated maintenance status workflow actions are now implemented across backend and frontend, including `submit`, `assign`, `start`, `hold`, `resume`, `complete`, `cancel`, and `reopen`, plus backend status history action/reason tracking and frontend workflow dialogs.
- FO-035 adds the dedicated technician/supervisor assignment service, assignment history endpoints and model fields, assignment RBAC, candidate selectors, assignment dialogs, and assignment history timeline.
- FO-036 adds priority-based SLA targets, overdue/breach detection, escalation deduplication and lifecycle APIs, Celery breach checking, list indicators/filters, and permission-aware SLA/escalation detail cards.
- FO-037 validates integrated lifecycles, exact RBAC aliases, tenant isolation, query-count bounds, formatting, TypeScript, lint, and production build output; security and performance defects found during QA were corrected.
- The core create/update contract still excludes new attachment upload and planning line-item persistence. The frontend exposes these as explicit capability limitations, documented as future backlog rather than incomplete hidden behavior.

## 5S Inspection

Status: Complete

### Purpose

Manages 5S inspection scheduling, execution, scoring, findings, corrective actions, audit history, AI-analysis placeholders, and escalation-ready SLA records for tenant-scoped facility operations.

### Backend

- Apps: `apps.inspection`
- Models: `Inspection`, `InspectionItem`, `InspectionFinding`, `InspectionAttachment`, `InspectionComment`, `InspectionAssignment`, `InspectionHistory`, `InspectionStatusHistory`, `InspectionAIAnalysis`, `InspectionCorrectiveAction`, `InspectionSLA`, `InspectionEscalation`
- Serializers: inspection list/detail/create/update serializers, item, finding, attachment, comment, history, corrective-action, assignment, workflow, SLA, escalation, and AI-analysis serializers
- ViewSets / Views: `InspectionViewSet`, `InspectionFindingViewSet`, `InspectionCorrectiveActionViewSet`
- APIs: inspection list/create/retrieve/patch/put/delete, nested items/findings/attachments/comments/history/corrective actions, AI-analysis get/create with method-correct permissions, assignment and workflow actions, plus finding and corrective-action CRUD endpoints with put/delete support
- Services: inspection creation/update helpers, score recalculation, status-history recording, workflow validation, AI-analysis upsert hook, deterministic AI context preparation, SLA recalculation, escalation checks, and tenant scoping
- Permissions: `HasInspectionPermission` with `inspection.view`, `create`, `update`, `delete`, `complete`, `verify`, `assign`, `view_ai`, `manage_corrective_action`, and `inspection.manage`
- Admin: all inspection domain models are registered in `backend/apps/inspection/admin.py`
- Tests: `backend/apps/inspection/tests/test_inspection.py`

### Frontend

- Routes: `/inspection/inspections`, `/inspection/inspections/[id]`, `/inspection/inspections/new`, `/inspection/inspections/[id]/edit`
- Module Folder: `frontend/app/(app)/inspection`, `frontend/features/inspection`
- Pages: protected inspection list, detail, create, and edit routes
- Components: inspection list/detail screens, create/edit form pages, inspection form, filters, status and priority badges, loading skeleton, pagination, workflow actions card, status timeline, findings/corrective-action management dialogs, and advisory AI-analysis review/edit UI
- Hooks: `use-inspection-list`, `use-inspection-detail`, `useCreateInspection`, `useUpdateInspection`, `useInspectionFormOptions`, `useInspectionFormDefaults`, dedicated workflow mutation hooks for assign/start/complete/verify/cancel/reopen, findings/corrective-action CRUD mutation hooks, and AI-analysis save mutation support
- API Files: `frontend/services/api/inspection.ts`, inspection endpoint and query-key entries, inspection workflow helpers, AI-analysis mapping/validation helpers, findings/corrective-action mapping helpers, and inspection form validation/mapping helpers
- Types: `frontend/types/inspection.ts`
- RBAC Usage: list/detail routes require `inspection.view` or `inspection.manage`; create requires `inspection.create` or `inspection.manage`; edit requires `inspection.update` or `inspection.manage`; workflow actions require `inspection.assign`, `inspection.update`, `inspection.complete`, `inspection.verify`, or `inspection.manage` based on action; finding create/edit requires `inspection.update` or `inspection.manage`; finding delete requires `inspection.delete` or `inspection.manage`; corrective-action create/edit requires `inspection.manage_corrective_action` or `inspection.manage`; corrective-action delete requires `inspection.delete` or `inspection.manage`
- Tests: Inspection helper coverage is part of the 43-test frontend suite run via `npm run test` (Node.js built-in runner with `tsx`)

### Notes

- FO-038 introduces the first inspection backend foundation and keeps the module `In Progress`.
- FO-038A locks nested `items`, `comments`, and `attachments` writes behind `inspection.update` or `inspection.manage` while preserving read-only access for `inspection.view`.
- FO-038B enables inspection, finding, and corrective-action `PUT` and soft-delete `DELETE` flows with RBAC-aligned permissions and default queryset filtering for deleted records.
- FO-039 adds protected frontend read-only inspection list/detail screens.
- FO-040 adds create/edit inspection forms with nested checklist item persistence.
- FO-041 adds frontend inspection lifecycle workflow actions, cache invalidation, permission-aware dialogs, and backend-driven status timeline rendering.
- FO-042 adds frontend CRUD management for findings and corrective actions directly from inspection detail, including dialog forms, delete confirmations, and cache invalidation.
- FO-042A restores inspection discoverability in app navigation and fixes the create-page load crash by preventing `null` and `undefined` query params from reaching backend master-data filters.
- FO-043 adds stored AI-analysis review/edit UI, structured inspection context previews, empty-submission rejection, and method-correct AI-analysis permissions.
- FO-044 is the QA and stabilization pass for the full inspection module. Four defects were corrected: checklist pass/fail values not preserved on edit, workflow AI-analysis responses mutated on GET, inspection soft-delete not centralized, and maintenance reassignment test failing after tenant-isolation hardening. All 168 backend tests pass and all 10 frontend checklist mapping tests pass. The `npm run test` script and `tsx` devDependency are now formally part of `frontend/package.json`.
- The AI endpoint stores analysis metadata and summaries but does not call an external AI provider.
- Attachment handling stores metadata only and reuses the project’s existing file-reference style rather than implementing binary upload transport in this task.
- FO-048 adds the assignment-safe directory picker to Inspection inspector, supervisor, workflow assignment, and corrective-action owner fields while retaining exact payload keys and permissions.
- FO-058C adds assignment and status-change in-app notifications through authoritative inspection services; finding, corrective-action, comment, attachment, escalation, and AI notification workflows remain deferred.

## Shared Services

Status: Complete

### Purpose

Centralizes cross-module helpers used by multiple product areas on both backend and frontend.

### Backend

- Apps: shared `common` package and `backend/services`
- Models: None
- Serializers: None
- ViewSets / Views: None
- APIs: None directly; consumed by other modules
- Services: `common.pagination.StandardResultsSetPagination`, `common.responses`, `common.exceptions`, module-local filter helpers, backend seed commands
- Permissions: no active shared backend permission abstraction beyond per-module permission classes
- Admin: None
- Tests: covered indirectly through app-level tests

### Frontend

- Routes: None directly
- Module Folder: `frontend/lib`, `frontend/utils`, `frontend/components/common`
- Pages: None directly
- Components: reusable field, table, empty, error, loading, page-header, and detail components
- Hooks: shared `use-auth` and `use-permissions`
- API Files: shared query-key and type helpers
- Types: shared index exports and feature contracts
- RBAC Usage: shared guard and permission utility functions are reused across app features
- Tests: No dedicated frontend tests

### Notes

- This module is the glue layer between domain features rather than a user-facing workflow.
- `backend/common/permissions.py` is currently an unused placeholder and should not be treated as a finished shared permission framework.

## API Client

Status: Complete

### Purpose

Provides a consistent frontend HTTP client, endpoint catalog, query-key factory, error normalization, and typed response contracts.

### Backend

- Apps: None
- Models: None
- Serializers: None
- ViewSets / Views: None
- APIs: consumes all backend API namespaces through `/api/*`
- Services: backend API namespaces exposed through `backend/api/urls.py`
- Permissions: inherited from domain endpoints
- Admin: None
- Tests: covered indirectly through backend endpoint tests; no dedicated client-specific backend tests

### Frontend

- Routes: consumed by all authenticated and read-only feature routes
- Module Folder: `frontend/services/api`
- Pages: None directly
- Components: None directly
- Hooks: query hooks depend on this layer
- API Files: `client.ts`, `endpoints.ts`, `query-keys.ts`, `types.ts`, and feature API files for auth, dashboard, master-data, rbac, users, fm-tickets, maintenance, health, and inspection
- Types: `services/api/types.ts` plus feature type files in `frontend/types`
- RBAC Usage: auth headers, token refresh flow, and permission lookups all use this layer
- Tests: No dedicated frontend tests

### Notes

- This module covers FO-011 and underpins every later frontend feature task.
- The user-management API file is intentionally capability-only because the backend endpoints do not exist yet.

## UI Components

Status: Complete

### Purpose

Holds reusable visual building blocks for auth, layout, forms, tables, detail views, and feature-level presentation.

### Backend

- Apps: None
- Models: None
- Serializers: None
- ViewSets / Views: None
- APIs: None
- Services: None
- Permissions: None
- Admin: None
- Tests: None

### Frontend

- Routes: used by nearly every route under `app/(app)` and `app/(auth)`
- Module Folder: `frontend/components`, plus feature-specific component folders
- Pages: all app pages compose these components
- Components: common fields and states, layout shell, auth guards, profile summary, master-data shared screens, dashboard cards, FM ticket components, maintenance components, inspection components, admin screens
- Hooks: `use-auth`, `use-permissions`, maintenance hooks, inspection mutation hooks
- API Files: consumed indirectly by presentation components
- Types: shared across all feature type files
- RBAC Usage: auth guards and sidebar navigation are componentized here
- Tests: No dedicated component tests

### Notes

- This module is mature enough for current scope, but still lacks a frontend component-test harness.

## Testing

Status: Needs Review

### Purpose

Tracks the current verification footprint across backend and frontend so progress can be assessed without assuming missing tests exist.

### Backend

- Apps: `apps.accounts`, `apps.access_control`, `apps.core`, `apps.dashboard`, `apps.fm_tickets`, `apps.inspection`, `apps.maintenance`, `apps.master_data`
- Models: exercised through app-level test suites
- Serializers: exercised through API and model tests
- ViewSets / Views: exercised through API tests in each backend app
- APIs: auth, RBAC, dashboard, health, master-data, FM ticketing, maintenance, inspection
- Services: covered mainly through API and model tests, plus seed-command tests
- Permissions: covered through endpoint authorization tests
- Admin: not deeply tested
- Tests: `backend/apps/*/tests.py`, `backend/apps/maintenance/tests/test_maintenance.py`, `backend/apps/inspection/tests/test_inspection.py`, `backend/pytest.ini` — 168 total tests

### Frontend

- Routes: all feature routes rely on lint, TypeScript, build validation, and code-level manual review rather than route-specific browser tests
- Module Folder: helper tests exist under `frontend/lib/inspection/`, `frontend/lib/maintenance/`, and `frontend/lib/users/`
- Pages: no automated page tests
- Components: no automated component tests
- Hooks: no automated hook tests
- API Files: no automated frontend API-client tests
- Types: validated through TypeScript compilation
- RBAC Usage: verified through implementation review and integrated behavior, not frontend test code
- Tests: Inspection helper coverage is part of the 43-test frontend suite run via `npm run test` (Node.js built-in runner with `tsx`)

### Notes

- Backend testing is in good shape for the current stage (204 tests passing).
- Frontend helper-level tests run via `npm run test` (43 tests). No component, integration, or browser harness exists yet.

## Configuration

Status: Complete

### Purpose

Defines environment settings, app registration, database and async configuration, frontend build tooling, and local-development defaults.


### Backend

- Apps: `config`, `api`, installed Django apps in `config/settings/base.py`
- Models: None
- Serializers: None
- ViewSets / Views: root URL routing in `config/urls.py`, API namespace routing in `api/urls.py`
- APIs: top-level `/api/` namespace plus Django admin at `/admin/`
- Services: Celery bootstrap in `config/celery.py`, environment parsing helpers in settings
- Permissions: framework-level defaults in REST framework settings
- Admin: Django admin site enabled
- Tests: validated indirectly through `manage.py check` and backend app tests

### Frontend

- Routes: all routes depend on shared Next configuration and env setup
- Module Folder: `frontend/package.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `scripts/`
- Pages: None directly
- Components: None directly
- Hooks: None directly
- API Files: `services/api/client.ts` depends on `NEXT_PUBLIC_API_URL`
- Types: None directly
- RBAC Usage: configuration supports the authenticated API base and runtime scripts
- Tests: no dedicated configuration tests

### Notes

- This module covers FO-004, FO-005, and FO-006.
- Backend defaults to SQLite when `DATABASE_URL` is empty, while Celery is configured for Redis-backed broker and result storage.
