"""FO-084 FM ticket image AI analysis foundation tests."""

import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment
from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
from apps.fm_tickets.ai_provider import PlaceholderAIProvider
from apps.fm_tickets.ai_queue_service import (
    AITicketAnalysisValidationError,
    queue_ticket_image_analysis,
)
from apps.fm_tickets.models import AITicketAnalysis, AITicketAnalysisAttachment, FmTicket
from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Floor,
    Organization,
    Tenant,
)

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


def _upload(name="evidence.jpg", content=JPEG_BYTES, content_type="image/jpeg"):
    return SimpleUploadedFile(name, content, content_type=content_type)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class FmTicketAIAnalysisFoundationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO084 Tenant A", code="fo084-a")
        cls.tenant_b = Tenant.objects.create(name="FO084 Tenant B", code="fo084-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO084 Org A", code="fo084-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO084 Org B", code="fo084-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo084-bldg-a",
        )
        cls.floor_a = Floor.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            name="Floor A",
            code="fo084-floor-a",
            level_number=1,
        )
        cls.area_a = Area.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            floor=cls.floor_a,
            name="Area A",
            code="fo084-area-a",
        )
        cls.asset_type_a = AssetType.objects.create(
            tenant=cls.tenant_a, name="Type A", code="fo084-type-a"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            floor=cls.floor_a,
            area=cls.area_a,
            asset_type=cls.asset_type_a,
            name="Asset A",
            code="fo084-asset-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo084-bldg-b",
        )

        def make_user(email, tenant, org, role_code):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant,
                organization=org,
            )
            role = Role.objects.get(code=role_code)
            UserRole.objects.create(user=user, role=role)
            return user

        cls.fm_user = make_user(
            "fm084@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.employee = make_user(
            "emp084@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.other_tenant_fm = make_user(
            "fm084b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        storage_override = override_settings(
            ATTACHMENT_STORAGE_ROOT=str(Path(self._tmpdir.name) / "attachments"),
        )
        storage_override.enable()
        self.addCleanup(storage_override.disable)

        self.ticket = FmTicket.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            floor=self.floor_a,
            area=self.area_a,
            asset=self.asset_a,
            requester=self.employee,
            title="Leaking pipe",
            description="Water near sink",
            category=FmTicket.Category.PLUMBING,
            ticket_number="FO084-001",
        )

    def _owned_image(self, *, actor=None, ticket=None):
        return create_attachment(
            actor=actor or self.fm_user,
            uploaded_file=_upload(),
            declared_content_type="image/jpeg",
            category=Attachment.Category.IMAGE_EVIDENCE,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=(ticket or self.ticket).id,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )

    def test_queue_creates_analysis_and_attachment_mapping(self):
        attachment = self._owned_image()

        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "task-123"
            analysis = queue_ticket_image_analysis(
                actor=self.fm_user,
                ticket_id=self.ticket.id,
                attachment_ids=[str(attachment.id)],
            )

        self.assertEqual(analysis.status, AITicketAnalysis.Status.QUEUED)
        self.assertEqual(analysis.tenant_id, self.tenant_a.id)
        self.assertEqual(analysis.ticket_id, self.ticket.id)
        self.assertEqual(analysis.requested_by_id, self.fm_user.id)
        self.assertEqual(analysis.celery_task_id, "task-123")
        self.assertEqual(
            AITicketAnalysisAttachment.objects.filter(analysis=analysis).count(),
            1,
        )
        delay_mock.assert_called_once_with(str(analysis.id))

    def test_placeholder_processing_transitions_to_completed(self):
        attachment = self._owned_image()
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "task-abc"
            analysis = queue_ticket_image_analysis(
                actor=self.fm_user,
                ticket_id=self.ticket.id,
                attachment_ids=[attachment.id],
            )

        with override_settings(
            FACILITYOPS_AI_PROVIDER="placeholder",
            FACILITYOPS_GEMINI_ENABLED=False,
        ):
            result = process_ticket_ai_analysis(str(analysis.id))
        analysis.refresh_from_db()

        self.assertTrue(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.COMPLETED)
        self.assertIsNotNone(analysis.started_at)
        self.assertIsNotNone(analysis.completed_at)
        self.assertIsNotNone(analysis.duration_ms)
        self.assertEqual(analysis.model_name, PlaceholderAIProvider.MODEL_NAME)
        self.assertEqual(analysis.result_json.get("schema_version"), "1.0")
        self.assertTrue(analysis.result_json.get("requires_human_review"))
        self.assertEqual(
            analysis.result_json.get("meta", {}).get("priority_prediction"),
            None,
        )
        self.assertEqual(
            analysis.result_json.get("meta", {}).get("category_prediction"),
            None,
        )
    def test_processing_failure_marks_failed(self):
        attachment = self._owned_image()
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "task-fail"
            analysis = queue_ticket_image_analysis(
                actor=self.fm_user,
                ticket_id=self.ticket.id,
                attachment_ids=[attachment.id],
            )

        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            side_effect=RuntimeError("provider down"),
        ):
            result = process_ticket_ai_analysis(str(analysis.id))

        analysis.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.PERMANENTLY_FAILED)
        self.assertEqual(analysis.error_code, "ANALYSIS_INTERNAL_ERROR")
        self.assertIn("internal error", analysis.error_message.lower())
        self.assertNotIn("provider down", analysis.error_message.lower())

    def test_rejects_foreign_ticket_attachment(self):
        other_ticket = FmTicket.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            requester=self.employee,
            title="Other",
            description="Other",
            ticket_number="FO084-002",
        )
        foreign_attachment = self._owned_image(ticket=other_ticket)

        with self.assertRaises(AITicketAnalysisValidationError):
            queue_ticket_image_analysis(
                actor=self.fm_user,
                ticket_id=self.ticket.id,
                attachment_ids=[foreign_attachment.id],
            )

    def test_api_queue_and_status_endpoints(self):
        attachment = self._owned_image()
        self.client.force_authenticate(self.fm_user)
        url = reverse("fm-ticket-ai-analyses", kwargs={"pk": self.ticket.id})

        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "api-task"
            response = self.client.post(
                url,
                {"attachment_ids": [str(attachment.id)]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], AITicketAnalysis.Status.QUEUED)
        analysis_id = response.data["id"]

        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data["results"]), 1)

        detail_url = reverse(
            "fm-ticket-ai-analysis-detail",
            kwargs={"pk": self.ticket.id, "analysis_id": analysis_id},
        )
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["id"], analysis_id)
        self.assertEqual(detail_response.data["attachment_ids"], [str(attachment.id)])

    def test_cross_tenant_queue_returns_404(self):
        attachment = self._owned_image()
        self.client.force_authenticate(self.other_tenant_fm)
        url = reverse("fm-ticket-ai-analyses", kwargs={"pk": self.ticket.id})
        response = self.client.post(
            url,
            {"attachment_ids": [str(attachment.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_can_queue_for_own_ticket(self):
        attachment = create_attachment(
            actor=self.employee,
            uploaded_file=_upload(),
            declared_content_type="image/jpeg",
            category=Attachment.Category.IMAGE_EVIDENCE,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=self.ticket.id,
        )
        self.client.force_authenticate(self.employee)
        url = reverse("fm-ticket-ai-analyses", kwargs={"pk": self.ticket.id})

        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "emp-task"
            response = self.client.post(
                url,
                {"attachment_ids": [str(attachment.id)]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], AITicketAnalysis.Status.QUEUED)

    def test_unauthenticated_ai_endpoints_rejected(self):
        url = reverse("fm-ticket-ai-analyses", kwargs={"pk": self.ticket.id})
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
