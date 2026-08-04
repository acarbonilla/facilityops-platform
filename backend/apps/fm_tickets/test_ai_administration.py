"""FO-093 AI Administration & Governance tests."""

from __future__ import annotations

from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.ai_administration_service import (
    build_effective_config,
    get_runtime_setting,
    is_feature_enabled,
    update_ai_config,
)
from apps.fm_tickets.models import AIAdminAuditEntry, AIAdminConfig
from apps.master_data.models import Tenant

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
    FACILITYOPS_GEMINI_MODEL="gemini-2.0-flash",
)
class AIAdministrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="Tenant A", code="fo093-a")
        cls.admin = User.objects.create_user(
            email="fo093-admin@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        cls.manager = User.objects.create_user(
            email="fo093-manager@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        cls.employee = User.objects.create_user(
            email="fo093-employee@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        UserRole.objects.create(
            user=cls.admin, role=Role.objects.get(code="system_admin")
        )
        UserRole.objects.create(
            user=cls.manager, role=Role.objects.get(code="facility_manager")
        )
        UserRole.objects.create(
            user=cls.employee, role=Role.objects.get(code="employee")
        )

    def setUp(self):
        AIAdminConfig.objects.all().delete()
        AIAdminAuditEntry.objects.all().delete()
        self.client = APIClient()

    def test_config_read_authorized(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-ai-config"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("provider", response.data)
        self.assertIn("feature_flags", response.data)
        self.assertIn("thresholds", response.data)
        self.assertFalse(response.data["provider"]["api_key_editable"])
        serialized = str(response.data).lower()
        self.assertNotIn("gemini_api_key", serialized)
        self.assertNotIn("'prompt':", serialized)
        self.assertNotIn('"prompt":', serialized)

    def test_config_update_and_audit(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            reverse("admin-ai-config"),
            {
                "provider": {
                    "provider": "placeholder",
                    "timeout_seconds": 90,
                    "max_images": 4,
                },
                "feature_flags": {"executive_dashboard": False},
                "thresholds": {"override_warning_rate": 0.35},
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["provider"]["timeout_seconds"], 90)
        self.assertFalse(response.data["feature_flags"]["executive_dashboard"])
        self.assertEqual(response.data["thresholds"]["override_warning_rate"], 0.35)
        self.assertFalse(is_feature_enabled("executive_dashboard"))
        self.assertTrue(AIAdminAuditEntry.objects.exists())
        self.assertEqual(
            float(get_runtime_setting("FACILITYOPS_AI_HIGH_OVERRIDE_RATE", 0.4)),
            0.35,
        )

    def test_invalid_ranges_and_provider(self):
        self.client.force_authenticate(user=self.admin)
        bad_provider = self.client.patch(
            reverse("admin-ai-config"),
            {"provider": {"provider": "openai"}},
            format="json",
        )
        self.assertEqual(bad_provider.status_code, status.HTTP_400_BAD_REQUEST)

        bad_rate = self.client.patch(
            reverse("admin-ai-config"),
            {"thresholds": {"override_warning_rate": 1.5}},
            format="json",
        )
        self.assertEqual(bad_rate.status_code, status.HTTP_400_BAD_REQUEST)

        secret = self.client.patch(
            reverse("admin-ai-config"),
            {"api_key": "secret"},
            format="json",
        )
        self.assertEqual(secret.status_code, status.HTTP_400_BAD_REQUEST)

    def test_prompts_policies_health_audit_endpoints(self):
        self.client.force_authenticate(user=self.admin)
        prompts = self.client.get(reverse("admin-ai-prompts"))
        self.assertEqual(prompts.status_code, status.HTTP_200_OK)
        self.assertFalse(prompts.data["editable"])
        self.assertFalse(prompts.data["prompt_text_exposed"])
        for item in prompts.data["prompts"]:
            self.assertNotIn("text", item)
            self.assertNotIn("body", item)

        policies = self.client.get(reverse("admin-ai-policies"))
        self.assertEqual(policies.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(policies.data["policies"]), 5)

        health = self.client.get(reverse("admin-ai-health"))
        self.assertEqual(health.status_code, status.HTTP_200_OK)
        self.assertIn("health_status_label", health.data)

        audit = self.client.get(reverse("admin-ai-audit"))
        self.assertEqual(audit.status_code, status.HTTP_200_OK)
        self.assertIn("entries", audit.data)

    def test_facility_manager_and_employee_denied(self):
        self.client.force_authenticate(user=self.manager)
        self.assertEqual(
            self.client.get(reverse("admin-ai-config")).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(user=self.employee)
        self.assertEqual(
            self.client.get(reverse("admin-ai-config")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_unauthorized(self):
        response = self.client.get(reverse("admin-ai-config"))
        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_effective_config_inherits_settings(self):
        payload = build_effective_config()
        self.assertEqual(payload["provider"]["provider"], "placeholder")
        self.assertTrue(payload["feature_flags"]["image_analysis"])
        self.assertEqual(payload["scope"], "global")

    def test_update_via_service_records_actor(self):
        update_ai_config(
            self.admin,
            {"feature_flags": {"similar_cases": False}},
        )
        entry = AIAdminAuditEntry.objects.get(changed_field="flag_similar_cases")
        self.assertEqual(entry.actor_id, self.admin.id)
        self.assertEqual(entry.actor_email, self.admin.email)
        self.assertEqual(entry.scope, "global")
        self.assertEqual(entry.new_value, "false")
