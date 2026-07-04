import uuid

from django.db import models
from django.test import TestCase

from apps.core.models import (
    AuditModel,
    BaseModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)


class HealthCheckTests(TestCase):
    def test_health_check(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "service": "facilityops-backend",
            },
        )


class AbstractBaseModelTests(TestCase):
    def test_timestamped_model_is_abstract(self):
        self.assertTrue(TimeStampedModel._meta.abstract)

    def test_uuid_model_is_abstract(self):
        self.assertTrue(UUIDModel._meta.abstract)

    def test_soft_delete_model_is_abstract(self):
        self.assertTrue(SoftDeleteModel._meta.abstract)

    def test_audit_model_is_abstract(self):
        self.assertTrue(AuditModel._meta.abstract)

    def test_base_model_is_abstract(self):
        self.assertTrue(BaseModel._meta.abstract)

    def test_base_model_exposes_expected_fields(self):
        class ExampleModel(BaseModel):
            class Meta:
                app_label = "core"

        fields = ExampleModel._meta

        id_field = fields.get_field("id")
        self.assertIsInstance(id_field, models.UUIDField)
        self.assertTrue(id_field.primary_key)
        self.assertEqual(id_field.default, uuid.uuid4)
        self.assertFalse(id_field.editable)

        created_at = fields.get_field("created_at")
        self.assertIsInstance(created_at, models.DateTimeField)
        self.assertTrue(created_at.auto_now_add)
        self.assertTrue(created_at.db_index)

        updated_at = fields.get_field("updated_at")
        self.assertIsInstance(updated_at, models.DateTimeField)
        self.assertTrue(updated_at.auto_now)

        is_deleted = fields.get_field("is_deleted")
        self.assertIsInstance(is_deleted, models.BooleanField)
        self.assertFalse(is_deleted.default)
        self.assertTrue(is_deleted.db_index)

        deleted_at = fields.get_field("deleted_at")
        self.assertIsInstance(deleted_at, models.DateTimeField)
        self.assertTrue(deleted_at.null)
        self.assertTrue(deleted_at.blank)

        created_by = fields.get_field("created_by")
        self.assertIsInstance(created_by, models.UUIDField)
        self.assertTrue(created_by.null)
        self.assertTrue(created_by.blank)
        self.assertTrue(created_by.db_index)

        updated_by = fields.get_field("updated_by")
        self.assertIsInstance(updated_by, models.UUIDField)
        self.assertTrue(updated_by.null)
        self.assertTrue(updated_by.blank)

        deleted_by = fields.get_field("deleted_by")
        self.assertIsInstance(deleted_by, models.UUIDField)
        self.assertTrue(deleted_by.null)
        self.assertTrue(deleted_by.blank)
