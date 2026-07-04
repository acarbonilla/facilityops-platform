# FO-007 - Initial Database Migration and Base Models

## Task ID

FO-007

## Task Title

Initial Database Migration and Base Models

## Purpose

Create reusable abstract model foundations for UUID primary keys, timestamps, soft delete behavior, and audit metadata without introducing business tables.

## Scope

- Implement abstract base model classes in `apps.core.models`.
- Validate migration behavior for abstract-only model changes.
- Add lightweight tests for the base model contract.
- Document the database foundation and migration expectations.

## Base Model Definitions

- `UUIDModel`
- `TimeStampedModel`
- `SoftDeleteModel`
- `AuditModel`
- `BaseModel`

## Why Abstract Models Are Used

Abstract models centralize shared field definitions and inheritance patterns without creating standalone database tables. This keeps future business models consistent while avoiding premature schema creation in FO-007.

## UUID Primary Key Standard

`UUIDModel` defines `id` as the default primary key strategy for future FacilityOps models:

```python
id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
```

## Timestamp Standard

`TimeStampedModel` provides:

- `created_at`
- `updated_at`

This establishes a consistent record lifecycle timestamp pattern.

## Soft Delete Standard

`SoftDeleteModel` provides:

- `is_deleted`
- `deleted_at`

This enables safe logical deletion without introducing custom managers or deletion workflows in this task.

## Audit Metadata Standard

`AuditModel` provides:

- `created_by`
- `updated_by`
- `deleted_by`

These fields use UUID values for now because the authentication and user model foundation has not been introduced yet.

## Migration Behavior

All models added in FO-007 are abstract. Django does not create database tables for abstract models, so `makemigrations` may report that no changes are detected. This is expected behavior and does not require a forced migration.

Built-in Django migrations must still run successfully against the configured database backend.

## Testing Notes

Tests validate that each base model is abstract and that a temporary test-only model inheriting from `BaseModel` exposes the expected UUID, timestamp, soft delete, and audit fields.

No production business model was introduced for testing.

## Validation Checklist

- [ ] `TimeStampedModel` exists and is abstract
- [ ] `UUIDModel` exists and is abstract
- [ ] `SoftDeleteModel` exists and is abstract
- [ ] `AuditModel` exists and is abstract
- [ ] `BaseModel` exists and is abstract
- [ ] UUID primary key strategy is defined
- [ ] Timestamp fields are defined
- [ ] Soft delete fields are defined
- [ ] Audit metadata fields are defined
- [ ] Abstract models are not registered in admin
- [ ] `python manage.py check` passes
- [ ] `python manage.py makemigrations` runs cleanly
- [ ] `python manage.py migrate` passes
- [ ] `pytest` passes
- [ ] Backend health check still works
- [ ] Documentation file exists
- [ ] No business models were created
- [ ] No master data tables were created
- [ ] No tenant table was created
- [ ] No organization table was created
- [ ] No user model was created
- [ ] No authentication was implemented
- [ ] No authorization or RBAC was implemented
- [ ] Frontend was not modified except documentation references if needed

## Known Limitations

- Abstract models do not create standalone database tables.
- Soft delete behavior is field-only in this task; no custom manager or queryset filtering is introduced.
- Audit fields are UUID placeholders until the authentication foundation defines the user model strategy.

## Next Task Recommendation

Proceed to `FO-008 - Authentication Foundation` after confirming the abstract model contract and environment validation remain stable.
