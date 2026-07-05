# FO-015 - Master Data Frontend Read Screens

## Purpose

FO-015 adds the read-only frontend screens for the master data foundation introduced in FO-010. The implementation uses the existing authenticated API client, TanStack Query provider, RBAC guards, and shared app shell.

## Scope

- Master data TypeScript contracts
- Read-only master data API service
- Stable TanStack Query keys
- Reusable read-only table and page display components
- Master data landing page
- Read screens for tenants, organizations, departments, buildings, floors, areas, asset types, and assets
- Navigation updates
- README and task documentation updates

Create, edit, delete, import, export, bulk actions, dashboard metrics, and business-module screens remain outside this task.

## Backend Endpoints Used

The frontend uses the existing authenticated master data endpoints:

- `GET /api/master-data/tenants/`
- `GET /api/master-data/organizations/`
- `GET /api/master-data/departments/`
- `GET /api/master-data/buildings/`
- `GET /api/master-data/floors/`
- `GET /api/master-data/areas/`
- `GET /api/master-data/asset-types/`
- `GET /api/master-data/assets/`

Detail endpoints are typed in the service for future use but no detail pages were added in this task.

## Frontend Routes Created

- `/master-data`
- `/master-data/tenants`
- `/master-data/organizations`
- `/master-data/departments`
- `/master-data/buildings`
- `/master-data/floors`
- `/master-data/areas`
- `/master-data/asset-types`
- `/master-data/assets`

All routes use the existing authentication foundation and currently require `settings.view` through the existing permission route guard.

## Types Created

`frontend/types/master-data.ts` defines:

- `Tenant`
- `Organization`
- `Department`
- `Building`
- `Floor`
- `Area`
- `AssetType`
- `Asset`
- `MasterDataListParams`
- `MasterDataResourceKey`

The frontend models the current backend response shape directly, including foreign-key fields returned as IDs.

## API Services Created

`frontend/services/api/master-data.ts` exposes typed read-only functions for all master data collections and detail endpoints.

`frontend/services/api/query-keys.ts` centralizes stable query keys in the form:

- `["master-data", resource, params]`
- `["master-data", resource, id]`

`frontend/services/api/client.ts` was extended to support query-string parameters so paginated and filtered read requests can reuse the shared authenticated client.

## Permission Assumption

The frontend uses the existing RBAC foundation and assumes `settings.view` is the correct read permission for master data screens, matching the backend viewset configuration.

If a deployment has different permission wiring, the backend remains the source of truth and the frontend should be adjusted to match that contract rather than bypassing backend authorization.

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
npm run build
npm run dev
```

Validate:

- login succeeds
- `/master-data` loads
- each master data list route loads
- seeded backend rows appear in the tables
- loading, empty, and error states render safely
- there are no create, edit, or delete controls

## Known Limitations

- The backend returns related master data as foreign-key IDs, so the frontend resolves display names through additional read-only lookup queries.
- No detail pages were added in this task even though detail service methods are available.
- The UI shows the first paginated result set and total record counts but does not yet expose pagination controls.
- Create, edit, delete, import, export, and business-module workflows remain outside this slice.

## Next Task Recommendation

FO-016 - Master Data Create/Edit Forms should build on the same typed service layer and route structure while preserving backend validation and authorization as the enforcement boundary.
