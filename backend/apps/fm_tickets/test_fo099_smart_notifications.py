"""FO-099 Smart Notifications & Workflow focused tests."""

import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
from apps.fm_tickets.classification_readiness import get_classification_block_reason
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.fm_tickets.notification_service import (
    AI_ANALYSIS_FAILED_EVENT_CODE,
    AI_ANALYSIS_READY_EVENT_CODE,
    CLASSIFICATION_COMPLETED_EVENT_CODE,
    EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
    EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE,
    notify_ai_analysis_failed,
    notify_ai_analysis_ready,
    notify_employee_concern_created,
)
from apps.fm_tickets.services import update_ticket
from apps.master_data.models import Building, Organization, Tenant
from apps.notifications.models import Notification, NotificationPreference


User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    MEDIA_ROOT=tempfile.mkdtemp(prefix="fo099-media-"),
)
class Fo099SmartNotificationsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO099 Tenant", code="fo099-t")
        cls.other_tenant = Tenant.objects.create(name="FO099 Other", code="fo099-o")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO099 Org",
            code="fo099-org",
        )
        cls.other_org = Organization.objects.create(
            tenant=cls.other_tenant,
            name="FO099 Other Org",
            code="fo099-oorg",
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            name="FO099 Building",
            code="fo099-b",
        )
        employee_role = Role.objects.get(code="employee")
        fm_role = Role.objects.get(code="facility_manager")

        cls.employee = User.objects.create_user(
            email="fo099-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.employee, role=employee_role)

        cls.fm = User.objects.create_user(
            email="fo099-fm@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.fm, role=fm_role)

        cls.dual = User.objects.create_user(
            email="fo099-dual@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.dual, role=employee_role)
        UserRole.objects.create(user=cls.dual, role=fm_role)

        cls.other_fm = User.objects.create_user(
            email="fo099-other-fm@example.com",
            password="Password123!",
            tenant=cls.other_tenant,
            organization=cls.other_org,
        )
        UserRole.objects.create(user=cls.other_fm, role=fm_role)

    def _create_employee_ticket(self, user=None):
        actor = user or self.employee
        self.client.force_authenticate(user=actor)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "FO099 concern", "description": "leak"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return FmTicket.objects.get(id=response.data["id"])

    def test_immediate_fm_notification_after_employee_create(self):
        ticket = self._create_employee_ticket()
        notices = Notification.objects.filter(
            event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
            source_object_id=ticket.id,
        )
        self.assertGreaterEqual(notices.count(), 1)
        notice = notices.get(recipient=self.fm)
        self.assertEqual(notice.target_url, f"/fm-tickets/{ticket.id}")
        self.assertIn("requires review", notice.title.lower())
        # Dual-role user receives the internal event once (not requester confirmation).
        self.assertEqual(notices.filter(recipient=self.dual).count(), 1)

        requester_notice = Notification.objects.filter(
            event_code=EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE,
            recipient=self.employee,
            source_object_id=ticket.id,
        ).get()
        self.assertEqual(
            requester_notice.target_url, f"/my-requests/{ticket.id}"
        )
        self.assertNotIn("/fm-tickets/", requester_notice.target_url)
        self.assertFalse(
            Notification.objects.filter(
                event_code=EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE,
                recipient=self.dual,
            ).exists()
        )

    def test_employee_does_not_receive_internal_target(self):
        ticket = self._create_employee_ticket()
        internal = Notification.objects.filter(
            event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
            recipient=self.employee,
        )
        self.assertFalse(internal.exists())

    def test_cross_tenant_fm_excluded(self):
        ticket = self._create_employee_ticket()
        self.assertFalse(
            Notification.objects.filter(
                event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
                recipient=self.other_fm,
                source_object_id=ticket.id,
            ).exists()
        )

    def test_duplicate_create_notification_idempotent(self):
        ticket = self._create_employee_ticket()
        before = Notification.objects.filter(
            event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
            source_object_id=ticket.id,
        ).count()
        notify_employee_concern_created(ticket=ticket, actor=self.employee)
        self.assertEqual(
            Notification.objects.filter(
                event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
                source_object_id=ticket.id,
            ).count(),
            before,
        )

    def test_dual_role_does_not_duplicate_create_rows(self):
        ticket = self._create_employee_ticket()
        created = Notification.objects.filter(
            event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
            source_object_id=ticket.id,
            recipient=self.dual,
        )
        self.assertEqual(created.count(), 1)
        self.assertEqual(created.get().target_url, f"/fm-tickets/{ticket.id}")
        self.assertFalse(
            Notification.objects.filter(
                event_code=EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE,
                recipient=self.dual,
            ).exists()
        )

    def test_preference_disabled_suppresses_event(self):
        NotificationPreference.objects.create(
            recipient=self.fm,
            tenant=self.tenant,
            source_module="fm_tickets",
            channel=NotificationPreference.Channel.IN_APP,
            is_enabled=False,
        )
        ticket = self._create_employee_ticket()
        self.assertFalse(
            Notification.objects.filter(
                event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
                recipient=self.fm,
                source_object_id=ticket.id,
            ).exists()
        )

    def test_ai_ready_only_on_completed(self):
        ticket = self._create_employee_ticket()
        analysis = AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.PROCESSING,
        )
        notify_ai_analysis_ready(ticket=ticket, analysis=analysis)
        self.assertEqual(
            Notification.objects.filter(
                event_code=AI_ANALYSIS_READY_EVENT_CODE,
                source_object_id=ticket.id,
                recipient=self.fm,
            ).count(),
            1,
        )
        notify_ai_analysis_ready(ticket=ticket, analysis=analysis)
        self.assertEqual(
            Notification.objects.filter(
                event_code=AI_ANALYSIS_READY_EVENT_CODE,
                source_object_id=ticket.id,
                recipient=self.fm,
            ).count(),
            1,
        )

    @override_settings(FACILITYOPS_AI_PROVIDER="placeholder")
    def test_process_completed_creates_ai_ready(self):
        ticket = self._create_employee_ticket()
        analysis = AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.QUEUED,
        )
        Notification.objects.filter(
            event_code=AI_ANALYSIS_READY_EVENT_CODE
        ).delete()

        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        self.assertTrue(result.get("ok"))
        ready = Notification.objects.filter(
            event_code=AI_ANALYSIS_READY_EVENT_CODE,
            source_object_id=ticket.id,
            recipient=self.fm,
        )
        self.assertEqual(ready.count(), 1)
        self.assertEqual(ready.get().target_url, f"/fm-tickets/{ticket.id}")
        self.assertNotIn("gemini", ready.get().message.lower())
        self.assertNotIn("prompt", ready.get().message.lower())

        process_ticket_ai_analysis(str(analysis.id), attempt=1)
        self.assertEqual(ready.count(), 1)

    @patch("apps.fm_tickets.ai_processing_service.get_ai_provider")
    def test_terminal_failure_notifies_once(self, provider_factory):
        from apps.fm_tickets.ai.errors import AIAnalysisError, AIErrorCode

        ticket = self._create_employee_ticket()
        analysis = AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.QUEUED,
        )

        class _Provider:
            def analyze(self, **kwargs):
                raise AIAnalysisError(AIErrorCode.ANALYSIS_INTERNAL_ERROR)

        provider_factory.return_value = _Provider()
        Notification.objects.filter(
            event_code=AI_ANALYSIS_FAILED_EVENT_CODE
        ).delete()

        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        self.assertFalse(result.get("ok"))
        failed = Notification.objects.filter(
            event_code=AI_ANALYSIS_FAILED_EVENT_CODE,
            source_object_id=ticket.id,
            recipient=self.fm,
        )
        self.assertEqual(failed.count(), 1)
        notify_ai_analysis_failed(ticket=ticket, analysis=analysis)
        self.assertEqual(failed.count(), 1)

    def test_classification_completed_requester_safe(self):
        ticket = self._create_employee_ticket()
        self.assertIsNotNone(get_classification_block_reason(ticket))
        update_ticket(
            ticket=ticket,
            data={
                "category": FmTicket.Category.PLUMBING,
                "priority": FmTicket.Priority.HIGH,
                "building": self.building,
            },
            actor=self.fm,
        )
        requester_rows = Notification.objects.filter(
            event_code=CLASSIFICATION_COMPLETED_EVENT_CODE,
            recipient=self.employee,
            source_object_id=ticket.id,
        )
        self.assertEqual(requester_rows.count(), 1)
        notice = requester_rows.get()
        self.assertEqual(notice.target_url, f"/my-requests/{ticket.id}")
        self.assertNotIn("confidence", notice.message.lower())
        self.assertNotIn("reasoning", notice.message.lower())
        self.assertNotIn("assignee", notice.message.lower())

        # Second update does not duplicate
        update_ticket(
            ticket=ticket,
            data={"title": "FO099 concern updated"},
            actor=self.fm,
        )
        self.assertEqual(requester_rows.count(), 1)
