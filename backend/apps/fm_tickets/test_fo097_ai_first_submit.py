"""FO-097 AI-first submission pipeline focused tests."""

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
from apps.master_data.models import Organization, Tenant

from .ai_queue_service import queue_ticket_image_analysis
from .models import AITicketAnalysis, FmTicket


User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


def _upload(name="photo.jpg"):
    return SimpleUploadedFile(name, JPEG_BYTES, content_type="image/jpeg")


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    MEDIA_ROOT=tempfile.mkdtemp(prefix="fo097-media-"),
)
class Fo097AiFirstSubmissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO097 Tenant", code="fo097-t")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO097 Org",
            code="fo097-o",
        )
        employee_role = Role.objects.get(code="employee")
        cls.employee = User.objects.create_user(
            email="fo097-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.employee, role=employee_role)

    def _authenticate(self):
        self.client.force_authenticate(user=self.employee)

    def _create_ticket(self):
        self._authenticate()
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "FO097 concern"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return FmTicket.objects.get(id=response.data["id"])

    def _create_attachment(self, ticket: FmTicket) -> Attachment:
        return create_attachment(
            actor=self.employee,
            uploaded_file=_upload(),
            declared_content_type="image/jpeg",
            category=Attachment.Category.IMAGE_EVIDENCE,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=ticket.id,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )

    @patch("apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay")
    def test_ai_queued_after_eligible_upload(self, delay_mock):
        delay_mock.return_value.id = "task-fo097"
        ticket = self._create_ticket()
        attachment = self._create_attachment(ticket)

        response = self.client.post(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
            {"attachment_ids": [str(attachment.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], AITicketAnalysis.Status.QUEUED)
        delay_mock.assert_called_once()

    def test_no_ai_without_images(self):
        ticket = self._create_ticket()
        self.assertFalse(
            AITicketAnalysis.objects.filter(ticket=ticket, is_deleted=False).exists()
        )
        response = self.client.post(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
            {"attachment_ids": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay")
    def test_duplicate_active_queue_reuses_analysis(self, delay_mock):
        delay_mock.return_value.id = "task-fo097-dup"
        ticket = self._create_ticket()
        attachment = self._create_attachment(ticket)

        first = queue_ticket_image_analysis(
            actor=self.employee,
            ticket_id=ticket.id,
            attachment_ids=[str(attachment.id)],
        )
        second = queue_ticket_image_analysis(
            actor=self.employee,
            ticket_id=ticket.id,
            attachment_ids=[str(attachment.id)],
        )
        self.assertEqual(first.id, second.id)
        self.assertEqual(
            AITicketAnalysis.objects.filter(ticket=ticket, is_deleted=False).count(),
            1,
        )
        self.assertEqual(delay_mock.call_count, 1)

    @patch("apps.fm_tickets.ai_administration_service.is_feature_enabled")
    def test_feature_flag_disabled_skips_queue_safely(self, flag_mock):
        flag_mock.return_value = False
        ticket = self._create_ticket()
        attachment = self._create_attachment(ticket)
        response = self.client.post(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
            {"attachment_ids": [str(attachment.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            AITicketAnalysis.objects.filter(ticket=ticket, is_deleted=False).exists()
        )
        detail = self.client.get(reverse("fm-ticket-detail", kwargs={"pk": ticket.id}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

    def test_employee_ticket_remains_visible_without_ai(self):
        ticket = self._create_ticket()
        listing = self.client.get(reverse("fm-ticket-list"))
        ids = {item["id"] for item in listing.data["results"]}
        self.assertIn(str(ticket.id), ids)
