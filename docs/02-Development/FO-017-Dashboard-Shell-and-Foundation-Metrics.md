# FO-017 - Dashboard Shell and Foundation Metrics

## Task ID

FO-017

## Task Title

Dashboard Shell and Foundation Metrics

## Purpose

FO-017 replaces the authenticated dashboard placeholder with a usable foundation dashboard. It introduces a simple backend summary endpoint, typed frontend dashboard data access, and a dashboard route that surfaces only foundation-level master data counts and backend connectivity status.

## Scope

- Authenticated backend dashboard summary endpoint
- Dashboard summary response serializer and API tests
- Frontend dashboard TypeScript types
- Frontend dashboard API service and query keys
- Foundation metric cards
- Backend status card
- Quick links to master data screens
- Authenticated `/dashboard` route with TanStack Query loading, error, empty, and unauthorized handling
- README and task documentation updates

Advanced analytics, charts, business-module metrics, exports, notifications, and workflow logic remain out of scope.

## Backend Endpoint Used

- `GET /api/dashboard/foundation-summary/`

The endpoint requires authentication and returns counts for:

- tenants
- organizations
- departments
- buildings
- floors
- areas
- asset types
- assets

It also returns `service: "facilityops-backend"`.

## Metrics Included

- Tenants
- Organizations
- Departments
- Buildings
- Floors
- Areas
- Asset Types
- Assets

No FM ticketing, maintenance, 5S inspection, AI, or other business metrics were added.

## Frontend Components Created

- `frontend/features/dashboard/components/metric-card.tsx`
- `frontend/features/dashboard/components/foundation-summary.tsx`
- `frontend/features/dashboard/components/system-status-card.tsx`
- `frontend/features/dashboard/components/quick-links.tsx`

## Dashboard Route

- Route: `/dashboard`
- Guard: authenticated users through the existing `ProtectedRoute`
- Data loading: TanStack Query

Behavior:

- shows the title `FacilityOps Dashboard`
- shows the subtitle `Foundation overview`
- loads foundation summary metrics from the authenticated backend endpoint
- checks backend connectivity through the existing health endpoint
- shows loading, error, empty, and unauthorized states safely
- exposes quick links to `/master-data`, `/master-data/tenants`, `/master-data/organizations`, `/master-data/buildings`, and `/master-data/assets`

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py migrate
pytest
python manage.py runserver
```

On Linux or macOS:

```text
cd backend
source .venv/bin/activate
python manage.py check
python manage.py migrate
pytest
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run dev
```

## Known Limitations

- The dashboard is intentionally limited to foundation counts and backend connectivity only.
- Health and summary data are fetched separately, so connectivity can show unavailable even when cached summary data is present.
- No charts, analytics drill-downs, exports, notifications, or business workflow summaries were introduced.

## Next Task Recommendation

FO-018 - Stage 1 Foundation Stabilization and MVP QA
