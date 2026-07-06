# FO-022 - Organization Management UI

## Task ID

FO-022

## Task Title

Organization Management UI

## Purpose

FO-022 adds an admin-oriented organization structure workspace built on the existing master-data foundation. It provides a cleaner administrative entry point for tenants, organizations, departments, buildings, floors, and areas without duplicating backend models or master-data services.

## Scope

- Organization admin landing route
- Organization structure navigation
- Tenant, organization, department, building, floor, and area admin routes
- Reuse of existing master-data read screens
- Reuse of existing master-data create/edit routes
- Simple read-only hierarchy visualization
- README and task documentation updates

Business workflows, FM Ticketing, maintenance, 5S, reporting, AI, notifications, delete, bulk actions, and import/export remain out of scope.

## Reused Master-Data Services

The organization admin UI reuses `frontend/services/api/master-data.ts`:

- `getTenants`
- `getOrganizations`
- `getDepartments`
- `getBuildings`
- `getFloors`
- `getAreas`

Existing create/edit flows are reused through links to the master-data routes introduced earlier:

- `/master-data/tenants/new`
- `/master-data/organizations/new`
- `/master-data/departments/new`
- `/master-data/buildings/new`
- `/master-data/floors/new`
- `/master-data/areas/new`

Existing edit links inside the shared read screens are also reused unchanged.

## Routes Created

- `/admin/organization`
- `/admin/organization/tenants`
- `/admin/organization/organizations`
- `/admin/organization/departments`
- `/admin/organization/buildings`
- `/admin/organization/floors`
- `/admin/organization/areas`

## Navigation Behavior

- The admin parent navigation now becomes available for `settings.view` as well as the previously supported admin permissions.
- A new `Organization` navigation item points to `/admin/organization`.
- Master Data navigation remains available and unchanged, so the organization workspace is an admin-focused structure view rather than a replacement.

## Permission Assumptions

- `settings.view` protects all organization read screens.
- `settings.manage` enables create/edit action links that reuse the existing master-data routes.
- Backend authorization remains the source of truth.

## Hierarchy View Status

A simple read-only hierarchy view is included on `/admin/organization`:

- Tenant
- Organization
- Department
- Building
- Floor
- Area

The hierarchy is intentionally lightweight and does not attempt advanced tree editing or interactive graph behavior.

## Known Limitations

- The hierarchy is optimized for clarity, not deep interactive exploration.
- Counts and hierarchy use the current master-data list responses and assume the existing local page size is sufficient for the current foundation dataset.
- Organization admin pages reuse the shared master-data read screens, so the section headers still reflect the master-data foundation language.
- Asset types and assets remain outside this organization-focused admin workspace.

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py migrate
python manage.py seed_master_data
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

- login works
- permissions load
- organization admin navigation appears for authorized users
- `/admin/organization` loads
- tenant, organization, department, building, floor, and area screens load
- existing master-data create/edit links still work
- unauthorized users are blocked safely

## Next Task Recommendation

FO-023 - Asset Management UI Polish should refine the asset-oriented administrative experience while keeping organization structure and asset management concerns clearly separated.
