"""FO-081 focused FM Ticket attachment integration tests."""

import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment, AttachmentHistory
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment, delete_attachment
from apps.fm_tickets.models import FmTicket
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
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def _upload(name, content, content_type):
    return SimpleUploadedFile(name, content, content_type=content_type)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class FmTicketAttachmentIntegrationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO081 Tenant A", code="fo081-a")
        cls.tenant_b = Tenant.objects.create(name="FO081 Tenant B", code="fo081-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO081 Org A", code="fo081-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO081 Org B", code="fo081-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo081-bldg-a",
        )
        cls.floor_a = Floor.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            name="Floor A",
            code="fo081-floor-a",
            level_number=1,
        )
        cls.area_a = Area.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            floor=cls.floor_a,
            name="Area A",
            code="fo081-area-a",
        )
        cls.asset_type_a = AssetType.objects.create(
            tenant=cls.tenant_a, name="Type A", code="fo081-type-a"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            floor=cls.floor_a,
            area=cls.area_a,
            asset_type=cls.asset_type_a,
            name="Asset A",
            code="fo081-asset-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo081-bldg-b",
        )

        def make_user(email, tenant, org, role_code):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant,
                organization=org,
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.employee_a = make_user(
            "fo081-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.employee_a2 = make_user(
            "fo081-emp-a2@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.fm_a = make_user(
            "fo081-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo081-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.technician_a = make_user(
            "fo081-tech-a@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.employee_b = make_user(
            "fo081-emp-b@example.com", cls.tenant_b, cls.org_b, "employee"
        )
        cls.fm_b = make_user(
            "fo081-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )

        cls.ticket_a = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            floor=cls.floor_a,
            area=cls.area_a,
            asset=cls.asset_a,
            requester=cls.employee_a,
            title="Requester A ticket",
            description="Owned by employee A",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )
        cls.ticket_a2 = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            requester=cls.employee_a2,
            title="Requester A2 ticket",
            description="Owned by employee A2",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )
        cls.ticket_b = FmTicket.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            requester=cls.employee_b,
            title="Requester B ticket",
            description="Other tenant",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )
        cls.closed_ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            requester=cls.employee_a,
            title="Closed ticket",
            description="Immutable",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.CLOSED,
            source=FmTicket.Source.WEB,
        )

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self.storage_root = Path(self._tmpdir.name)
        self.settings_override = override_settings(
            ATTACHMENT_STORAGE_BACKEND="local",
            ATTACHMENT_STORAGE_ROOT=str(self.storage_root),
            ATTACHMENT_MAX_UPLOAD_BYTES=1024,
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

    def _list_url(self, ticket_id=None):
        url = reverse("attachments-list")
        if ticket_id is None:
            return url
        return (
            f"{url}?owner_type={AttachmentOwnerType.FM_TICKET}"
            f"&owner_id={ticket_id}"
        )

    def _create_linked(
        self,
        *,
        actor,
        ticket,
        name="photo.jpg",
        content=JPEG_BYTES,
        content_type="image/jpeg",
        visibility=None,
    ):
        return create_attachment(
            actor=actor,
            uploaded_file=_upload(name, content, content_type),
            declared_content_type=content_type,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=ticket.id,
            visibility=visibility,
        )

    def test_authorized_internal_upload_list_download_delete(self):
        attachment = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            visibility=AttachmentVisibility.INTERNAL_ONLY,
        )
        self.assertEqual(attachment.owner_type, AttachmentOwnerType.FM_TICKET)
        self.assertEqual(attachment.owner_id, self.ticket_a.id)
        self.assertEqual(attachment.visibility, AttachmentVisibility.INTERNAL_ONLY)

        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(self._list_url(self.ticket_a.id))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(listed.data["results"][0]["id"], str(attachment.id))

        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(download.status_code, status.HTTP_200_OK)
        self.assertEqual(download.content, JPEG_BYTES)

        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        listed_after = self.client.get(self._list_url(self.ticket_a.id))
        self.assertEqual(listed_after.data["count"], 0)

    def test_unauthorized_internal_viewer_cannot_upload(self):
        self.client.force_authenticate(self.viewer_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.FM_TICKET,
                "owner_id": str(self.ticket_a.id),
            },
            format="multipart",
        )
        # Viewer lacks attachments.upload → permission class denies (403) or
        # HasAttachmentPermission fails before service.
        self.assertIn(
            response.status_code,
            {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND},
        )

    def test_technician_can_upload_but_not_delete(self):
        self.client.force_authenticate(self.technician_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("note.pdf", PDF_BYTES, "application/pdf"),
                "owner_type": AttachmentOwnerType.FM_TICKET,
                "owner_id": str(self.ticket_a.id),
                "category": "document",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attachment_id = response.data["id"]
        delete = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment_id})
        )
        # Technicians lack attachments.delete (RBAC) → permission denied.
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_list_download_delete_denied(self):
        attachment = self._create_linked(actor=self.fm_a, ticket=self.ticket_a)
        self.client.force_authenticate(self.fm_b)

        listed = self.client.get(self._list_url(self.ticket_a.id))
        self.assertEqual(listed.status_code, status.HTTP_404_NOT_FOUND)

        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(download.status_code, status.HTTP_404_NOT_FOUND)

        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_404_NOT_FOUND)

    def test_requester_own_ticket_list_filters_visibility(self):
        visible = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            name="visible.jpg",
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        internal = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            name="internal.jpg",
            visibility=AttachmentVisibility.INTERNAL_ONLY,
        )
        self.client.force_authenticate(self.employee_a)
        listed = self.client.get(self._list_url(self.ticket_a.id))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in listed.data["results"]}
        self.assertIn(str(visible.id), ids)
        self.assertNotIn(str(internal.id), ids)
        self.assertNotIn("uploader_email", listed.data["results"][0])

    def test_requester_download_visible_and_denied_internal(self):
        visible = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        internal = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            name="secret.jpg",
            visibility=AttachmentVisibility.INTERNAL_ONLY,
        )
        self.client.force_authenticate(self.employee_a)
        ok = self.client.get(
            reverse("attachments-download", kwargs={"pk": visible.id})
        )
        denied = self.client.get(
            reverse("attachments-download", kwargs={"pk": internal.id})
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_requester_denied_other_requester_ticket(self):
        attachment = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a2,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        self.client.force_authenticate(self.employee_a)
        listed = self.client.get(self._list_url(self.ticket_a2.id))
        self.assertEqual(listed.status_code, status.HTTP_404_NOT_FOUND)
        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(download.status_code, status.HTTP_404_NOT_FOUND)

    def test_requester_upload_and_delete_own_visible(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("mine.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.FM_TICKET,
                "owner_id": str(self.ticket_a.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["visibility"], AttachmentVisibility.REQUESTER_VISIBLE
        )
        attachment_id = response.data["id"]

        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment_id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)

    def test_requester_cannot_delete_internal_or_others_upload(self):
        internal = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            visibility=AttachmentVisibility.INTERNAL_ONLY,
        )
        visible_by_fm = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            name="shared.jpg",
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        self.client.force_authenticate(self.employee_a)
        self.assertEqual(
            self.client.delete(
                reverse("attachments-detail", kwargs={"pk": internal.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.delete(
                reverse("attachments-detail", kwargs={"pk": visible_by_fm.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_deleted_attachments_excluded_from_list(self):
        attachment = self._create_linked(actor=self.fm_a, ticket=self.ticket_a)
        delete_attachment(actor=self.fm_a, attachment_id=attachment.id)
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(self._list_url(self.ticket_a.id))
        self.assertEqual(listed.data["count"], 0)

    def test_invalid_owner_context_rejected(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.get(
            f"{reverse('attachments-list')}?owner_type=fm_ticket"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        upload = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": "not_a_module",
                "owner_id": str(self.ticket_a.id),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_400_BAD_REQUEST)

    def test_immutable_ticket_upload_denied(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.FM_TICKET,
                "owner_id": str(self.closed_ticket.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.employee_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.FM_TICKET,
                "owner_id": str(self.closed_ticket.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_record_includes_owner_context(self):
        attachment = self._create_linked(
            actor=self.fm_a,
            ticket=self.ticket_a,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        history = AttachmentHistory.objects.get(
            attachment=attachment,
            action=AttachmentHistory.Action.UPLOADED,
        )
        self.assertEqual(
            history.metadata.get("owner_type"), AttachmentOwnerType.FM_TICKET
        )
        self.assertEqual(history.metadata.get("owner_id"), str(self.ticket_a.id))
        self.assertEqual(
            history.metadata.get("visibility"),
            AttachmentVisibility.REQUESTER_VISIBLE,
        )

    def test_list_does_not_return_unrelated_or_other_ticket(self):
        self._create_linked(actor=self.fm_a, ticket=self.ticket_a)
        other = self._create_linked(
            actor=self.fm_a, ticket=self.ticket_a2, name="other.jpg"
        )
        unlinked = create_attachment(
            actor=self.fm_a,
            uploaded_file=_upload("lib.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(self._list_url(self.ticket_a.id))
        ids = {item["id"] for item in listed.data["results"]}
        self.assertEqual(len(ids), 1)
        self.assertNotIn(str(other.id), ids)
        self.assertNotIn(str(unlinked.id), ids)

    def test_default_visibility_is_internal_for_internal_upload(self):
        attachment = self._create_linked(actor=self.fm_a, ticket=self.ticket_a)
        self.assertEqual(attachment.visibility, AttachmentVisibility.INTERNAL_ONLY)
        self.assertEqual(
            Attachment.objects.get(pk=attachment.id).visibility,
            AttachmentVisibility.INTERNAL_ONLY,
        )
