# FO-011 - Frontend API Client and App Shell Foundation

## Purpose

FO-011 establishes the reusable frontend infrastructure required for consistent backend communication and a shared application layout. It prepares the frontend for authentication integration without implementing authentication behavior.

## Scope

- Environment-based backend API URL
- Reusable Fetch API client and normalized errors
- Shared API response types and endpoint constants
- Backend health service
- TanStack Query and application providers
- Responsive application shell
- Shared loading, error, and empty states
- Home-page backend connectivity validation

Login UI, token storage, authentication providers, protected routes, RBAC guards, metrics, and business-module screens are outside this task.

## API Client Structure

The API integration is under `frontend/services/api/`:

- `client.ts` resolves the configured base URL, sends JSON requests, reads JSON responses, and converts network and HTTP failures to `ApiError`. Its optional `accessToken` request option is an injection point for FO-012; this task does not source or store tokens.
- `endpoints.ts` contains the `/health/` endpoint constant. Business endpoints will be added with their owning features.
- `types.ts` contains generic success, error, pagination, health response, and normalized error types.
- `health.ts` exposes `getBackendHealth()`.

## Environment Variables

`frontend/.env.example` defines:

```text
NEXT_PUBLIC_APP_NAME=FacilityOps Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

`NEXT_PUBLIC_API_URL` is exposed to the browser and must not contain secrets. Local `.env` and `.env.local` files remain uncommitted.

## TanStack Query Provider

`QueryProvider` owns one browser-side `QueryClient` with conservative retry, stale-time, and window-focus defaults. `AppProviders` is the root provider composition point. `frontend/app/layout.tsx` wraps application children with `AppProviders`. No authentication or session provider is present.

## App Shell Structure

`frontend/components/layout/` contains:

- `app-shell.tsx` - overall responsive shell
- `header.tsx` - application identity placeholder
- `sidebar.tsx` - non-linking placeholder navigation
- `main-content.tsx` - constrained content area

The shell does not apply authentication gates or permission-based navigation.

## Backend Health Validation

The home page calls `GET {NEXT_PUBLIC_API_URL}/health/` with TanStack Query. It displays a loading state during the request, a connected state for a successful health response, and a safe retryable error state when configuration, networking, CORS, or the backend is unavailable.

Expected response:

```json
{
  "status": "ok",
  "service": "facilityops-backend"
}
```

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py runserver
```

On Linux or macOS, activate with `source .venv/bin/activate`.

Frontend:

```text
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000` and confirm the app shell and backend status appear. With Django stopped, confirm the unavailable state appears without crashing the page.

## Known Limitations

- There is no login or logout UI.
- Tokens are not acquired, persisted, or refreshed.
- Routes and navigation are not protected.
- The navigation labels are placeholders and do not link to business pages.
- The health query only confirms HTTP connectivity; it is not a full dependency-readiness probe.

## Next Task Recommendation

FO-012 - Frontend Authentication Integration should add authentication behavior using the API client's token injection point while defining an explicit, secure token lifecycle.
