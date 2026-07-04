# FO-010 - Master Data Foundation

## Task ID

FO-010

## Task Title

Master Data Foundation

## Purpose

Implement the foundational backend master data models, APIs, admin registrations, seed command, tests, and documentation required before future business modules can be added.

## Scope

- Create the `apps.master_data` Django app.
- Add tenant, organization, department, building, floor, area, asset type, and asset models.
- Add serializers and authenticated CRUD APIs.
- Add admin registrations.
- Add the idempotent `seed_master_data` command.
- Add focused tests and documentation.

## Master Data Model Overview

- `Tenant`
- `Organization`
- `Department`
- `Building`
- `Floor`
- `Area`
- `AssetType`
- `Asset`

All models inherit from `BaseModel`.

## Entity Relationship Summary

- A `Tenant` owns organizations, departments, buildings, floors, areas, asset types, and assets.
- An `Organization` belongs to one tenant.
- A `Department` belongs to one tenant and one organization.
- A `Building` belongs to one tenant and one organization.
- A `Floor` belongs to one tenant and one building.
- An `Area` belongs to one tenant, one building, and one floor.
- An `AssetType` belongs to one tenant.
- An `Asset` belongs to one tenant, one organization, one building, an optional floor, an optional area, and one asset type.

## API Endpoint List

- `GET|POST /api/master-data/tenants/`
- `GET|POST /api/master-data/organizations/`
- `GET|POST /api/master-data/departments/`
- `GET|POST /api/master-data/buildings/`
- `GET|POST /api/master-data/floors/`
- `GET|POST /api/master-data/areas/`
- `GET|POST /api/master-data/asset-types/`
- `GET|POST /api/master-data/assets/`

Detail, update, partial update, and delete routes are also available through the DRF router.

## Seed Command

Run:

```text
python manage.py seed_master_data
```

This seeds a default development tenant, organization, department, building, floor, area, asset type, and asset. The command is idempotent.

## Validation Commands

From `backend/`:

```text
pip install -r requirements/development.txt
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py seed_master_data
pytest
python manage.py runserver
```

## Testing Notes

Tests cover model creation, uniqueness constraints, seed command idempotency, authentication requirements, and authenticated list/filter behavior.

## Known Limitations

- No FM Ticketing, Maintenance, or 5S Inspection modules are included.
- No advanced tenant-aware query isolation is implemented yet.
- No frontend master data screens are included.
- Existing PostgreSQL development databases created before FO-008 may still need to be recreated before current migrations can be applied cleanly.

## Next Task Recommendation

Proceed to `FO-011 - Frontend API Client and App Shell Foundation`.
