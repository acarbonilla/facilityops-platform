"""FO-082 focused Maintenance and 5S attachment integration tests."""

import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment, AttachmentHistory
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment, delete_attachment
from apps.fm_tickets.models import FmTicket
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
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
class MaintenanceAndInspectionAttachmentTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO082 Tenant A", code="fo082-a")
        cls.tenant_b = Tenant.objects.create(name="FO082 Tenant B", code="fo082-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO082 Org A", code="fo082-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO082 Org B", code="fo082-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo082-bldg-a",
        )
        cls.floor_a = Floor.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            name="Floor A",
            code="fo082-floor-a",
            level_number=1,
        )
        cls.area_a = Area.objects.create(
            tenant=cls.tenant_a,
            building=cls.building_a,
            floor=cls.floor_a,
            name="Area A",
            code="fo082-area-a",
        )
        cls.asset_type_a = AssetType.objects.create(
            tenant=cls.tenant_a, name="Type A", code="fo082-type-a"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            floor=cls.floor_a,
            area=cls.area_a,
            asset_type=cls.asset_type_a,
            name="Asset A",
            code="fo082-asset-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo082-bldg-b",
        )
        cls.asset_type_b = AssetType.objects.create(
            tenant=cls.tenant_b, name="Type B", code="fo082-type-b"
        )
        cls.asset_b = Asset.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            asset_type=cls.asset_type_b,
            name="Asset B",
            code="fo082-asset-b",
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

        cls.fm_a = make_user(
            "fo082-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.tech_a = make_user(
            "fo082-tech-a@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.viewer_a = make_user(
            "fo082-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo082-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.admin_a = make_user(
            "fo082-admin-a@example.com", cls.tenant_a, cls.org_a, "system_admin"
        )
        cls.fm_b = make_user(
            "fo082-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.tech_b = make_user(
            "fo082-tech-b@example.com", cls.tenant_b, cls.org_b, "technician"
        )

        cls.work_order_a = MaintenanceWorkOrder.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.fm_a,
            assignee=cls.tech_a,
            title="Mutable WO A",
            description="Active work",
            status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )
        cls.work_order_terminal = MaintenanceWorkOrder.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.fm_a,
            title="Terminal WO",
            description="Completed",
            status=MaintenanceWorkOrder.Status.COMPLETED,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )
        cls.work_order_b = MaintenanceWorkOrder.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            asset=cls.asset_b,
            requester=cls.fm_b,
            title="WO Tenant B",
            description="Other tenant",
            status=MaintenanceWorkOrder.Status.OPEN,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )

        cls.inspection_a = Inspection.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            title="Active inspection A",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SORT,
            inspector=cls.tech_a,
            status=Inspection.Status.IN_PROGRESS,
            priority=Inspection.Priority.MEDIUM,
        )
        cls.inspection_terminal = Inspection.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            title="Completed inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SORT,
            inspector=cls.tech_a,
            status=Inspection.Status.COMPLETED,
            priority=Inspection.Priority.MEDIUM,
            completed_date=timezone.now(),
        )
        cls.inspection_b = Inspection.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            title="Inspection Tenant B",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SORT,
            inspector=cls.tech_b,
            status=Inspection.Status.IN_PROGRESS,
            priority=Inspection.Priority.MEDIUM,
        )

        cls.ticket_a = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            requester=cls.employee_a,
            title="Requester ticket",
            description="For FO-081 regression",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self.settings_override = override_settings(
            ATTACHMENT_STORAGE_BACKEND="local",
            ATTACHMENT_STORAGE_ROOT=str(Path(self._tmpdir.name)),
            ATTACHMENT_MAX_UPLOAD_BYTES=1024,
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

    def _list_url(self, owner_type, owner_id):
        return (
            f"{reverse('attachments-list')}?owner_type={owner_type}&owner_id={owner_id}"
        )

    def _create_wo(self, *, actor, work_order, name="photo.jpg"):
        return create_attachment(
            actor=actor,
            uploaded_file=_upload(name, JPEG_BYTES, "image/jpeg"),
            declared_content_type="image/jpeg",
            owner_type=AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
            owner_id=work_order.id,
        )

    def _create_insp(self, *, actor, inspection, name="photo.jpg"):
        return create_attachment(
            actor=actor,
            uploaded_file=_upload(name, JPEG_BYTES, "image/jpeg"),
            declared_content_type="image/jpeg",
            owner_type=AttachmentOwnerType.INSPECTION,
            owner_id=inspection.id,
        )

    # --- Maintenance ---

    def test_authorized_work_order_upload_list_download_delete(self):
        attachment = self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        self.assertEqual(
            attachment.owner_type, AttachmentOwnerType.MAINTENANCE_WORK_ORDER
        )
        self.assertEqual(attachment.visibility, AttachmentVisibility.INTERNAL_ONLY)

        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(
            self._list_url(
                AttachmentOwnerType.MAINTENANCE_WORK_ORDER, self.work_order_a.id
            )
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)

        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(download.status_code, status.HTTP_200_OK)

        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)

    def test_technician_can_upload_work_order_attachment(self):
        self.client.force_authenticate(self.tech_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("fix.pdf", PDF_BYTES, "application/pdf"),
                "owner_type": AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
                "owner_id": str(self.work_order_a.id),
                "category": "document",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["visibility"], AttachmentVisibility.INTERNAL_ONLY
        )

    def test_unauthorized_viewer_cannot_upload_work_order(self):
        self.client.force_authenticate(self.viewer_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
                "owner_id": str(self.work_order_a.id),
            },
            format="multipart",
        )
        self.assertIn(
            response.status_code,
            {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND},
        )

    def test_cross_tenant_work_order_denied(self):
        attachment = self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        self.client.force_authenticate(self.fm_b)
        self.assertEqual(
            self.client.get(
                self._list_url(
                    AttachmentOwnerType.MAINTENANCE_WORK_ORDER, self.work_order_a.id
                )
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                reverse("attachments-list"),
                {
                    "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                    "owner_type": AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
                    "owner_id": str(self.work_order_a.id),
                },
                format="multipart",
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                reverse("attachments-download", kwargs={"pk": attachment.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.delete(
                reverse("attachments-detail", kwargs={"pk": attachment.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_terminal_work_order_upload_and_delete_denied(self):
        attachment = self._create_wo(
            actor=self.fm_a, work_order=self.work_order_a, name="before.jpg"
        )
        # Move attachment ownership scenario: upload to terminal WO denied.
        self.client.force_authenticate(self.fm_a)
        upload = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("late.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
                "owner_id": str(self.work_order_terminal.id),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_403_FORBIDDEN)

        # Make a linked attachment on terminal WO via service bypass for delete test.
        terminal_attachment = create_attachment(
            actor=self.fm_a,
            uploaded_file=_upload("done.jpg", JPEG_BYTES, "image/jpeg"),
            owner_type=AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
            owner_id=self.work_order_a.id,
        )
        # Re-point to terminal by updating status of WO then delete should 404.
        # Instead create under in_progress then flip WO to completed.
        self.work_order_a.status = MaintenanceWorkOrder.Status.COMPLETED
        self.work_order_a.save(update_fields=["status", "updated_at"])
        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": terminal_attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_404_NOT_FOUND)
        # Restore for other tests.
        self.work_order_a.status = MaintenanceWorkOrder.Status.IN_PROGRESS
        self.work_order_a.save(update_fields=["status", "updated_at"])
        delete_attachment(actor=self.fm_a, attachment_id=attachment.id)

    def test_work_order_rejects_requester_visible(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
                "owner_id": str(self.work_order_a.id),
                "visibility": AttachmentVisibility.REQUESTER_VISIBLE,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_work_order_audit_includes_owner(self):
        attachment = self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        history = AttachmentHistory.objects.get(
            attachment=attachment, action=AttachmentHistory.Action.UPLOADED
        )
        self.assertEqual(
            history.metadata.get("owner_type"),
            AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
        )
        self.assertEqual(history.metadata.get("owner_id"), str(self.work_order_a.id))

    def test_deleted_work_order_attachments_excluded(self):
        attachment = self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        delete_attachment(actor=self.fm_a, attachment_id=attachment.id)
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(
            self._list_url(
                AttachmentOwnerType.MAINTENANCE_WORK_ORDER, self.work_order_a.id
            )
        )
        self.assertEqual(listed.data["count"], 0)

    # --- Inspection ---

    def test_authorized_inspection_upload_list_download_delete(self):
        # Technicians have inspection.update; facility_manager has view-only.
        attachment = self._create_insp(actor=self.tech_a, inspection=self.inspection_a)
        self.assertEqual(attachment.owner_type, AttachmentOwnerType.INSPECTION)
        self.assertEqual(attachment.visibility, AttachmentVisibility.INTERNAL_ONLY)

        self.client.force_authenticate(self.tech_a)
        listed = self.client.get(
            self._list_url(AttachmentOwnerType.INSPECTION, self.inspection_a.id)
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)

        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(download.status_code, status.HTTP_200_OK)

        # Technician lacks attachments.delete → 403
        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin_a)
        deleted = self.client.delete(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)

    def test_facility_manager_view_only_cannot_upload_inspection(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.INSPECTION,
                "owner_id": str(self.inspection_a.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_inspection_denied(self):
        attachment = self._create_insp(actor=self.tech_a, inspection=self.inspection_a)
        self.client.force_authenticate(self.tech_b)
        self.assertEqual(
            self.client.get(
                self._list_url(AttachmentOwnerType.INSPECTION, self.inspection_a.id)
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                reverse("attachments-download", kwargs={"pk": attachment.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_terminal_inspection_upload_denied(self):
        self.client.force_authenticate(self.tech_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.INSPECTION,
                "owner_id": str(self.inspection_terminal.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inspection_rejects_requester_visible(self):
        self.client.force_authenticate(self.tech_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": AttachmentOwnerType.INSPECTION,
                "owner_id": str(self.inspection_a.id),
                "visibility": AttachmentVisibility.REQUESTER_VISIBLE,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inspection_audit_includes_owner(self):
        attachment = self._create_insp(actor=self.tech_a, inspection=self.inspection_a)
        history = AttachmentHistory.objects.get(
            attachment=attachment, action=AttachmentHistory.Action.UPLOADED
        )
        self.assertEqual(
            history.metadata.get("owner_type"), AttachmentOwnerType.INSPECTION
        )
        self.assertEqual(history.metadata.get("owner_id"), str(self.inspection_a.id))

    # --- Boundaries / FO-081 regression ---

    def test_requester_cannot_see_maintenance_or_inspection_attachments(self):
        wo_att = self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        insp_att = self._create_insp(actor=self.tech_a, inspection=self.inspection_a)
        self.client.force_authenticate(self.employee_a)

        self.assertEqual(
            self.client.get(
                self._list_url(
                    AttachmentOwnerType.MAINTENANCE_WORK_ORDER, self.work_order_a.id
                )
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                self._list_url(AttachmentOwnerType.INSPECTION, self.inspection_a.id)
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                reverse("attachments-download", kwargs={"pk": wo_att.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                reverse("attachments-download", kwargs={"pk": insp_att.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_fm_ticket_visibility_not_regressed(self):
        visible = create_attachment(
            actor=self.fm_a,
            uploaded_file=_upload("shared.jpg", JPEG_BYTES, "image/jpeg"),
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=self.ticket_a.id,
            visibility=AttachmentVisibility.REQUESTER_VISIBLE,
        )
        self.client.force_authenticate(self.employee_a)
        listed = self.client.get(
            self._list_url(AttachmentOwnerType.FM_TICKET, self.ticket_a.id)
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in listed.data["results"]}
        self.assertIn(str(visible.id), ids)

    def test_mismatched_owner_list_does_not_leak_other_modules(self):
        self._create_wo(actor=self.fm_a, work_order=self.work_order_a)
        self._create_insp(actor=self.tech_a, inspection=self.inspection_a)
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(
            self._list_url(
                AttachmentOwnerType.MAINTENANCE_WORK_ORDER, self.work_order_a.id
            )
        )
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(
            listed.data["results"][0]["owner_type"],
            AttachmentOwnerType.MAINTENANCE_WORK_ORDER,
        )

    def test_invalid_owner_type_rejected(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                "owner_type": "not_supported",
                "owner_id": str(self.work_order_a.id),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
