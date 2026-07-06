# FO-023 - Asset Management UI Polish

## Task ID

FO-023

## Task Title

Asset Management UI Polish

## Purpose

FO-023 refines the existing asset management foundation without introducing new backend business models. The work stays within the master-data and admin UI surface, improves asset usability, and connects asset records more clearly to the organization structure added in FO-022.

## Scope

- Polished asset list screen
- Asset detail route and detail layout
- Improved asset create/edit form grouping
- Simple asset search and filtering
- Clearer asset location/context display
- Links between assets and organization structure routes
- Admin-facing asset alias route
- README and development documentation updates

Maintenance workflows, preventive maintenance, inspections, ticketing, reporting, AI analysis, delete, bulk actions, import/export, QR generation, and attachments remain out of scope.

## Reused Foundation

This task reuses the existing frontend asset foundation instead of duplicating business logic:

- `frontend/services/api/master-data.ts`
- `frontend/types/master-data.ts`
- Existing master-data asset create/edit pages
- Existing organization admin routes from FO-022

The implementation continues to rely on the existing asset, tenant, organization, building, floor, area, and asset-type APIs.

## Routes

Primary asset routes:

- `/master-data/assets`
- `/master-data/assets/new`
- `/master-data/assets/[id]`
- `/master-data/assets/[id]/edit`

Admin alias:

- `/admin/assets`

The admin alias reuses the same underlying asset list component to avoid duplicate UI logic.

## Asset List Improvements

The polished asset list now emphasizes both classification and location context. The table includes:

- Asset name
- Asset code
- Asset type
- Organization
- Building
- Floor
- Area
- Serial number
- Active status
- Actions

Actions remain intentionally limited to:

- View details
- Edit, when `settings.manage` is available

Delete, bulk actions, import, and export are still intentionally excluded.

## Asset Detail View

The new detail route organizes asset data into four sections:

1. Asset Information
2. Location
3. Classification
4. System Metadata

The detail screen also adds:

- Breadcrumb-style location context
- Links back to organization structure screens
- Safe fallback messaging when created/updated timestamps are not returned by the current backend serializer

## Form Layout Changes

The asset create/edit form keeps the validation foundation from FO-016 but improves scanability by grouping fields into:

- Asset Information
- Classification
- Location

The existing lightweight cascading behavior is preserved:

- Organizations filter by tenant
- Buildings filter by organization
- Floors filter by building
- Areas filter by floor
- Asset types filter by tenant

No advanced cascading orchestration was added.

## Filtering Behavior

Simple frontend filtering was added for:

- Search by asset name or code
- Asset type
- Building
- Active status

The filtering is client-side and applies to the current loaded page only. That limitation is documented because this task does not extend backend filtering behavior or pagination strategy.

## Navigation Decision

The primary asset workspace remains under Master Data. An additional admin alias at `/admin/assets` provides a cleaner admin-oriented entry point and is exposed from the admin landing page and navigation as `Admin Assets`.

## Validation Commands

Frontend:

```text
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run dev
```

Validate:

- asset list loads from `/master-data/assets`
- admin asset alias loads from `/admin/assets`
- asset detail loads from `/master-data/assets/[id]`
- view and edit actions route correctly
- filters affect the current loaded page
- organization/location links are visible
- create and edit asset forms retain existing validation
- unauthorized users are blocked by existing permission guards

## Next Task Recommendation

FO-024 - FM Ticketing Backend Foundation should remain separate from this asset UI polish so operational workflows are introduced only after the current asset navigation and presentation layer is stable.
