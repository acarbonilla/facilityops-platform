# FO-016 - Master Data Create/Edit Forms

## Purpose

FO-016 adds the frontend create and edit flows for the master data module. It builds directly on the FO-015 read screens, existing authenticated API client, TanStack Query cache, and RBAC route guards.

## Scope

- Create and update API functions for all master data entities
- Master data form payload types
- Zod validation schemas
- Reusable form controls
- Reusable entity form components
- Create and edit routes for tenants, organizations, departments, buildings, floors, areas, asset types, and assets
- Query invalidation after successful mutations
- Safe inline API error handling
- README and task documentation updates

Delete, bulk actions, import, export, dashboard metrics, and business-module workflows remain outside this task.

## Routes Created

Create routes:

- `/master-data/tenants/new`
- `/master-data/organizations/new`
- `/master-data/departments/new`
- `/master-data/buildings/new`
- `/master-data/floors/new`
- `/master-data/areas/new`
- `/master-data/asset-types/new`
- `/master-data/assets/new`

Edit routes:

- `/master-data/tenants/[id]/edit`
- `/master-data/organizations/[id]/edit`
- `/master-data/departments/[id]/edit`
- `/master-data/buildings/[id]/edit`
- `/master-data/floors/[id]/edit`
- `/master-data/areas/[id]/edit`
- `/master-data/asset-types/[id]/edit`
- `/master-data/assets/[id]/edit`

All routes use the existing authenticated shell and currently require `settings.manage`.

## Forms Created

- `frontend/features/master-data/components/tenant-form.tsx`
- `frontend/features/master-data/components/organization-form.tsx`
- `frontend/features/master-data/components/department-form.tsx`
- `frontend/features/master-data/components/building-form.tsx`
- `frontend/features/master-data/components/floor-form.tsx`
- `frontend/features/master-data/components/area-form.tsx`
- `frontend/features/master-data/components/asset-type-form.tsx`
- `frontend/features/master-data/components/asset-form.tsx`

Shared helpers and route-level mutation/load orchestration live in:

- `frontend/features/master-data/components/shared.tsx`
- `frontend/features/master-data/components/master-data-form-pages.tsx`

## Validation Schemas

`frontend/lib/validations/master-data.ts` adds:

- `tenantSchema`
- `organizationSchema`
- `departmentSchema`
- `buildingSchema`
- `floorSchema`
- `areaSchema`
- `assetTypeSchema`
- `assetSchema`

Validation remains practical and mirrors the backend field contract closely:

- name and code are required
- related foreign keys are required where the backend requires them
- description remains optional in practice through empty-string submission
- floor `level_number` is numeric
- asset `serial_number` is optional
- asset `floor` and `area` remain optional to match the backend model

## API Functions Added

`frontend/services/api/master-data.ts` now includes:

- `createTenant`, `updateTenant`
- `createOrganization`, `updateOrganization`
- `createDepartment`, `updateDepartment`
- `createBuilding`, `updateBuilding`
- `createFloor`, `updateFloor`
- `createArea`, `updateArea`
- `createAssetType`, `updateAssetType`
- `createAsset`, `updateAsset`

Updates use `PATCH`. Query invalidation uses the existing stable master data query-key structure.

## Permission Assumptions

The write routes and list actions assume `settings.manage`, matching the backend master data viewset permission mixin. Read screens continue to assume `settings.view`.

If deployed permission mappings differ, the frontend should be updated to match the backend contract rather than bypassing backend enforcement.

## Related Select Behavior

Related options are populated from existing read APIs.

Light client-side filtering is applied where practical:

- organizations by selected tenant
- buildings by selected tenant or organization, depending on form
- floors by selected building
- areas by selected floor
- asset types by selected tenant

The implementation intentionally avoids a heavier cascading-select system at this stage.

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py runserver
```

On Linux or macOS:

```text
source .venv/bin/activate
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run dev
```

Validate:

- login succeeds
- master data list screens show permission-aware new/edit actions for authorized users
- create routes load
- edit routes load and prefill existing records
- client-side validation errors render safely
- successful create/edit redirects back to the relevant list
- no delete, import, export, or bulk controls are visible

## Known Limitations

- Runtime `next dev` route probing remains unreliable in this host environment even when the temporary server binds successfully, so browser-level validation was only partial.
- Success feedback currently relies on redirect and refreshed list data; no toast system was introduced.
- Related selects use simple client-side filtering and do not yet implement deeper cascading resets or async dependent loading.
- There are still no delete actions, imports, exports, bulk operations, or detail pages.

## Next Task Recommendation

FO-017 - Dashboard Shell and Foundation Metrics should build on the authenticated shell and current navigation structure without expanding master data into business workflows.
