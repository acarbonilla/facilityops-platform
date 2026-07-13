import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.master_data.models import Tenant

from .models import Notification
from .services import (
    bulk_update_notification_state,
    create_notification,
    mark_all_notifications_read,
    mark_notification_unread,
)

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


@override_settings(PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",))
class NotificationMutationTests(APITestCase):
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
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

        self.notification_a_unread = create_notification(
            recipient=self.recipient_a,
            event_code="maintenance.created",
            title="Unread A",
            message="Unread notification",
            severity="info",
        )
        self.notification_a_read = create_notification(
            recipient=self.recipient_a,
            event_code="maintenance.updated",
            title="Read A",
            message="Read notification",
            severity="warning",
        )
        self.notification_a_read.is_read = True
        self.notification_a_read.read_at = timezone.now()
        self.notification_a_read.save(
            update_fields=("is_read", "read_at", "updated_at")
        )

        self.notification_b = create_notification(
            recipient=self.recipient_b,
            event_code="maintenance.completed",
            title="Recipient B",
            message="Other recipient notification",
            severity="success",
        )
        self.global_notification = create_notification(
            recipient=self.global_user,
            event_code="dashboard.digest",
            title="Global",
            message="Global notification",
            severity="info",
        )

        self.mark_read_url = lambda notification: reverse(
            "notification-mark-read",
            args=(notification.id,),
        )
        self.mark_unread_url = lambda notification: reverse(
            "notification-mark-unread",
            args=(notification.id,),
        )
        self.mark_all_read_url = reverse("notification-mark-all-read")
        self.bulk_state_url = reverse("notification-bulk-state")

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _recipient_a_queryset(self):
        return Notification.objects.filter(
            recipient_id=self.recipient_a.id,
            tenant_id=self.tenant_a.id,
        )

    def test_anonymous_mutation_requests_are_rejected(self):
        responses = (
            self.client.post(self.mark_read_url(self.notification_a_unread)),
            self.client.post(self.mark_unread_url(self.notification_a_read)),
            self.client.post(self.mark_all_read_url),
            self.client.post(
                self.bulk_state_url,
                {"notification_ids": [str(self.notification_a_unread.id)], "is_read": True},
                format="json",
            ),
        )

        for response in responses:
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recipient_can_mark_their_notification_read(self):
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_read_url(self.notification_a_unread))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        self.assertIsNotNone(response.data["read_at"])

    def test_mark_read_sets_timezone_aware_read_at(self):
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_read_url(self.notification_a_unread))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notification_a_unread.refresh_from_db()
        self.assertTrue(timezone.is_aware(self.notification_a_unread.read_at))

    def test_repeated_mark_read_is_idempotent_and_preserves_read_at(self):
        self._auth(self.recipient_a)

        first = self.client.post(self.mark_read_url(self.notification_a_unread))
        second = self.client.post(self.mark_read_url(self.notification_a_unread))

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["read_at"], second.data["read_at"])

    def test_recipient_can_mark_their_notification_unread(self):
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_unread_url(self.notification_a_read))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_read"])
        self.assertIsNone(response.data["read_at"])

    def test_repeated_mark_unread_is_idempotent(self):
        self._auth(self.recipient_a)
        self.client.post(self.mark_unread_url(self.notification_a_read))

        response = self.client.post(self.mark_unread_url(self.notification_a_read))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_read"])
        self.assertIsNone(response.data["read_at"])

    def test_recipient_cannot_mutate_another_users_notification(self):
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_read_url(self.notification_b))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_mutation_returns_generic_404(self):
        cross_tenant = Notification.objects.create(
            tenant=self.tenant_b,
            recipient=self.recipient_a,
            event_code="security.alert",
            title="Inconsistent",
            message="Mismatched tenant record",
            severity=Notification.Severity.ERROR,
        )
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_read_url(cross_tenant))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_superuser_and_global_account_cannot_bypass_recipient_isolation(self):
        self._auth(self.global_user)
        global_response = self.client.post(
            self.mark_read_url(self.notification_a_unread)
        )
        self.assertEqual(global_response.status_code, status.HTTP_404_NOT_FOUND)

        self._auth(self.superuser)
        superuser_response = self.client.post(
            self.mark_read_url(self.notification_a_unread)
        )
        self.assertEqual(superuser_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_all_read_updates_only_authenticated_recipient_notifications(self):
        self._auth(self.recipient_a)

        response = self.client.post(self.mark_all_read_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"updated_count": 1})
        self.notification_a_unread.refresh_from_db()
        self.notification_b.refresh_from_db()
        self.assertTrue(self.notification_a_unread.is_read)
        self.assertFalse(self.notification_b.is_read)

    def test_mark_all_read_does_not_affect_another_user_or_tenant(self):
        self._auth(self.recipient_a)
        self.client.post(self.mark_all_read_url)

        self.notification_b.refresh_from_db()
        self.assertFalse(self.notification_b.is_read)

    def test_repeated_mark_all_read_returns_zero_updated_count(self):
        self._auth(self.recipient_a)
        self.client.post(self.mark_all_read_url)

        response = self.client.post(self.mark_all_read_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"updated_count": 0})

    def test_bulk_read_succeeds_for_owned_notification_ids(self):
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [
                    str(self.notification_a_unread.id),
                    str(self.notification_a_read.id),
                ],
                "is_read": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {"updated_count": 1, "is_read": True},
        )

    def test_bulk_unread_succeeds_for_owned_notification_ids(self):
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [str(self.notification_a_read.id)],
                "is_read": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {"updated_count": 1, "is_read": False},
        )
        self.notification_a_read.refresh_from_db()
        self.assertFalse(self.notification_a_read.is_read)
        self.assertIsNone(self.notification_a_read.read_at)

    def test_bulk_read_preserves_existing_read_at(self):
        original_read_at = self.notification_a_read.read_at
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [str(self.notification_a_read.id)],
                "is_read": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 0)
        self.notification_a_read.refresh_from_db()
        self.assertEqual(self.notification_a_read.read_at, original_read_at)

    def test_bulk_request_rejects_empty_id_list(self):
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {"notification_ids": [], "is_read": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_request_rejects_more_than_100_ids(self):
        self._auth(self.recipient_a)
        ids = [str(uuid.uuid4()) for _ in range(101)]

        response = self.client.post(
            self.bulk_state_url,
            {"notification_ids": ids, "is_read": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_request_validates_uuid_values(self):
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {"notification_ids": ["not-a-uuid"], "is_read": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mixed_owned_and_unauthorized_ids_produce_no_partial_update(self):
        self._auth(self.recipient_a)

        response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [
                    str(self.notification_a_unread.id),
                    str(self.notification_b.id),
                ],
                "is_read": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.notification_a_unread.refresh_from_db()
        self.notification_b.refresh_from_db()
        self.assertFalse(self.notification_a_unread.is_read)
        self.assertFalse(self.notification_b.is_read)

    def test_unknown_and_unauthorized_ids_use_same_non_enumerating_response(self):
        self._auth(self.recipient_a)

        unknown_response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [str(uuid.uuid4())],
                "is_read": True,
            },
            format="json",
        )
        unauthorized_response = self.client.post(
            self.bulk_state_url,
            {
                "notification_ids": [str(self.notification_b.id)],
                "is_read": True,
            },
            format="json",
        )

        self.assertEqual(unknown_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(unauthorized_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_service_mark_unread_clears_read_at(self):
        mark_notification_unread(self.notification_a_read)
        self.notification_a_read.refresh_from_db()
        self.assertFalse(self.notification_a_read.is_read)
        self.assertIsNone(self.notification_a_read.read_at)

    def test_service_mark_all_read_only_counts_recipient_scope(self):
        updated_count = mark_all_notifications_read(self._recipient_a_queryset())
        self.assertEqual(updated_count, 1)

    def test_service_bulk_update_normalizes_duplicate_ids(self):
        updated_count = bulk_update_notification_state(
            self._recipient_a_queryset(),
            [
                self.notification_a_unread.id,
                self.notification_a_unread.id,
            ],
            True,
        )
        self.assertEqual(updated_count, 1)
