import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.master_data.models import Tenant

from .models import Notification
from .services import create_notification

User = get_user_model()


class NotificationModelTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant A", code="tenant-a")
        self.user = User.objects.create_user(
            email="model-user@example.com",
            password="Password123!",
            tenant=self.tenant,
        )

    def test_notification_uuid_and_default_fields(self):
        notification = Notification.objects.create(
            tenant=self.tenant,
            recipient=self.user,
            event_code="maintenance.assigned",
            title="Assigned",
            message="A work order was assigned.",
            severity=Notification.Severity.INFO,
        )

        self.assertIsInstance(notification.id, uuid.UUID)
        self.assertEqual(notification.metadata, {})
        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

    def test_recipient_tenant_consistency_validation(self):
        other_tenant = Tenant.objects.create(name="Tenant B", code="tenant-b")
        notification = Notification(
            tenant=other_tenant,
            recipient=self.user,
            event_code="maintenance.assigned",
            title="Assigned",
            message="A work order was assigned.",
            severity=Notification.Severity.INFO,
        )

        with self.assertRaises(DjangoValidationError):
            notification.full_clean()


class NotificationServiceTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant A", code="tenant-a")
        self.other_tenant = Tenant.objects.create(name="Tenant B", code="tenant-b")
        self.tenant_user = User.objects.create_user(
            email="tenant-user@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.global_user = User.objects.create_user(
            email="global-user@example.com",
            password="Password123!",
        )

    def test_creation_service_requires_explicit_recipient(self):
        with self.assertRaisesMessage(Exception, "Recipient is required"):
            create_notification(
                recipient=None,
                event_code="maintenance.assigned",
                title="Assigned",
                message="A work order was assigned.",
                severity="info",
            )

    def test_creation_service_derives_tenant_from_recipient(self):
        notification = create_notification(
            recipient=self.tenant_user,
            event_code="maintenance.assigned",
            title="Assigned",
            message="A work order was assigned.",
            severity="warning",
            source_module="maintenance",
            metadata={"work_order": "WO-1001"},
        )

        self.assertEqual(notification.tenant_id, self.tenant.id)
        self.assertEqual(notification.severity, Notification.Severity.WARNING)
        self.assertEqual(notification.source_module, "maintenance")

    def test_creation_service_rejects_mismatched_tenant(self):
        with self.assertRaisesMessage(Exception, "tenant"):
            create_notification(
                recipient=self.tenant_user,
                tenant=self.other_tenant,
                event_code="maintenance.assigned",
                title="Assigned",
                message="A work order was assigned.",
                severity="info",
            )

    def test_creation_service_rejects_invalid_severity(self):
        with self.assertRaisesMessage(Exception, "Severity must be one of"):
            create_notification(
                recipient=self.tenant_user,
                event_code="maintenance.assigned",
                title="Assigned",
                message="A work order was assigned.",
                severity="critical",
            )

    def test_creation_service_rejects_tenant_binding_for_global_user(self):
        with self.assertRaisesMessage(Exception, "Global recipients"):
            create_notification(
                recipient=self.global_user,
                tenant=self.tenant,
                event_code="maintenance.assigned",
                title="Assigned",
                message="A work order was assigned.",
                severity="info",
            )


@override_settings(PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",))
class NotificationEndpointTests(APITestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A", code="tenant-a")
        self.tenant_b = Tenant.objects.create(name="Tenant B", code="tenant-b")

        self.recipient_a = User.objects.create_user(
            email="recipient-a@example.com",
            password="Password123!",
            tenant=self.tenant_a,
        )
        self.recipient_b = User.objects.create_user(
            email="recipient-b@example.com",
            password="Password123!",
            tenant=self.tenant_b,
        )
        self.global_user = User.objects.create_user(
            email="global@example.com",
            password="Password123!",
        )
        self.other_global_user = User.objects.create_user(
            email="other-global@example.com",
            password="Password123!",
        )
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

        self.notification_a1 = create_notification(
            recipient=self.recipient_a,
            event_code="maintenance.created",
            title="Created",
            message="Notification A1",
            severity="info",
            source_module="maintenance",
        )
        self.notification_a2 = create_notification(
            recipient=self.recipient_a,
            event_code="inspection.completed",
            title="Completed",
            message="Notification A2",
            severity="warning",
            source_module="inspection",
            metadata={"inspection": "I-100"},
        )
        self.notification_b1 = create_notification(
            recipient=self.recipient_b,
            event_code="maintenance.completed",
            title="Completed",
            message="Notification B1",
            severity="success",
            source_module="maintenance",
        )
        self.global_notification = create_notification(
            recipient=self.global_user,
            event_code="dashboard.digest",
            title="Digest",
            message="Global digest",
            severity="info",
            source_module="dashboard",
        )
        self.other_global_notification = create_notification(
            recipient=self.other_global_user,
            event_code="dashboard.digest",
            title="Digest",
            message="Other global digest",
            severity="info",
            source_module="dashboard",
        )

        self.list_url = reverse("notification-list")
        self.unread_count_url = reverse("notification-unread-count")

    def _detail_url(self, notification):
        return reverse("notification-detail", args=(notification.id,))

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_access_is_rejected(self):
        responses = (
            self.client.get(self.list_url),
            self.client.get(self._detail_url(self.notification_a1)),
            self.client.get(self.unread_count_url),
        )

        for response in responses:
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recipient_can_list_and_retrieve_own_notifications(self):
        self._auth(self.recipient_a)

        list_response = self.client.get(self.list_url)
        detail_response = self.client.get(self._detail_url(self.notification_a1))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 2)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["id"], str(self.notification_a1.id))

    def test_recipient_cannot_retrieve_another_users_notification(self):
        self._auth(self.recipient_a)

        response = self.client.get(self._detail_url(self.notification_b1))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_notification_isolation(self):
        Notification.objects.create(
            tenant=self.tenant_b,
            recipient=self.recipient_a,
            event_code="security.alert",
            title="Inconsistent",
            message="Mismatched tenant record",
            severity=Notification.Severity.ERROR,
        )
        self._auth(self.recipient_a)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_global_and_superuser_accounts_cannot_bypass_recipient_isolation(self):
        self._auth(self.global_user)
        global_list = self.client.get(self.list_url)
        global_other_detail = self.client.get(
            self._detail_url(self.other_global_notification)
        )

        self.assertEqual(global_list.status_code, status.HTTP_200_OK)
        self.assertEqual(global_list.data["count"], 1)
        self.assertEqual(
            global_list.data["results"][0]["id"],
            str(self.global_notification.id),
        )
        self.assertEqual(global_other_detail.status_code, status.HTTP_404_NOT_FOUND)

        self._auth(self.superuser)
        superuser_list = self.client.get(self.list_url)
        superuser_other_detail = self.client.get(
            self._detail_url(self.notification_a1)
        )

        self.assertEqual(superuser_list.status_code, status.HTTP_200_OK)
        self.assertEqual(superuser_list.data["count"], 0)
        self.assertEqual(superuser_other_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_unread_filtering(self):
        self.notification_a1.is_read = True
        self.notification_a1.save(update_fields=("is_read", "updated_at"))
        self._auth(self.recipient_a)

        unread_response = self.client.get(self.list_url, {"is_read": "false"})
        read_response = self.client.get(self.list_url, {"is_read": "true"})

        self.assertEqual(unread_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unread_response.data["count"], 1)
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data["count"], 1)

    def test_severity_and_source_module_filtering(self):
        self._auth(self.recipient_a)

        response = self.client.get(
            self.list_url,
            {
                "severity": "warning",
                "source_module": "inspection",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.notification_a2.id))

    def test_newest_first_ordering_is_deterministic(self):
        self._auth(self.recipient_a)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data["results"]]
        self.assertEqual(returned_ids[0], str(self.notification_a2.id))
        self.assertEqual(returned_ids[1], str(self.notification_a1.id))

    def test_unread_count_endpoint_returns_recipient_scoped_count(self):
        self.notification_a1.is_read = True
        self.notification_a1.save(update_fields=("is_read", "updated_at"))
        self._auth(self.recipient_a)

        response = self.client.get(self.unread_count_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"unread_count": 1})

    def test_invalid_uuid_and_missing_record_behavior(self):
        self._auth(self.recipient_a)

        invalid_uuid = self.client.get("/api/v1/notifications/not-a-uuid/")
        missing_uuid = self.client.get(
            f"/api/v1/notifications/{uuid.uuid4()}/"
        )

        self.assertEqual(invalid_uuid.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(missing_uuid.status_code, status.HTTP_404_NOT_FOUND)

    def test_pagination_contract(self):
        for index in range(25):
            create_notification(
                recipient=self.recipient_a,
                event_code=f"maintenance.bulk-{index}",
                title=f"Bulk {index}",
                message="Bulk message",
                severity="info",
                source_module="maintenance",
            )
        self._auth(self.recipient_a)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 20)
