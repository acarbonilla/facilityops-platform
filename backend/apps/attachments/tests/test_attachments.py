"""FO-079 focused attachment foundation tests."""

import hashlib
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment, AttachmentHistory
from apps.attachments.services import (
    create_attachment,
    delete_attachment,
    download_attachment,
    get_attachment,
)
from apps.attachments.storage import LocalAttachmentStorage, get_attachment_storage
from apps.attachments.validation import validate_upload
from apps.master_data.models import Organization, Tenant

User = get_user_model()

# Minimal valid binary signatures.
JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
EXE_BYTES = b"MZ\x90\x00This is not an allowed executable payload."


def _upload(name, content, content_type):
    return SimpleUploadedFile(name, content, content_type=content_type)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class AttachmentFoundationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Att Tenant A", code="att-a")
        cls.tenant_b = Tenant.objects.create(name="Att Tenant B", code="att-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Att Org A", code="att-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Att Org B", code="att-org-b"
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
            "att-employee-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.employee_a2 = make_user(
            "att-employee-a2@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.fm_a = make_user(
            "att-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.employee_b = make_user(
            "att-employee-b@example.com", cls.tenant_b, cls.org_b, "employee"
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

    def test_upload_success_and_sha256(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
            declared_content_type="image/jpeg",
        )
        self.assertEqual(attachment.tenant_id, self.tenant_a.id)
        self.assertEqual(attachment.uploaded_by_id, self.employee_a.id)
        self.assertEqual(attachment.display_filename, "photo.jpg")
        self.assertNotIn("photo.jpg", attachment.storage_key)
        self.assertEqual(attachment.validated_content_type, "image/jpeg")
        self.assertEqual(
            attachment.checksum_sha256,
            hashlib.sha256(JPEG_BYTES).hexdigest(),
        )
        self.assertTrue(
            AttachmentHistory.objects.filter(
                attachment=attachment,
                action=AttachmentHistory.Action.UPLOADED,
            ).exists()
        )
        storage = get_attachment_storage()
        self.assertTrue(storage.exists(attachment.storage_key))

    def test_upload_invalid_mime(self):
        with self.assertRaises(Exception):
            create_attachment(
                actor=self.employee_a,
                uploaded_file=_upload("bad.txt", b"hello world", "text/plain"),
                declared_content_type="text/plain",
            )

    def test_upload_invalid_extension(self):
        with self.assertRaises(Exception):
            create_attachment(
                actor=self.employee_a,
                uploaded_file=_upload("malware.exe", EXE_BYTES, "application/octet-stream"),
                declared_content_type="application/octet-stream",
            )

    def test_upload_empty_file(self):
        with self.assertRaises(Exception):
            create_attachment(
                actor=self.employee_a,
                uploaded_file=_upload("empty.jpg", b"", "image/jpeg"),
                declared_content_type="image/jpeg",
            )

    def test_upload_oversized_file(self):
        big = JPEG_BYTES + (b"0" * 2048)
        # Keep JPEG header but exceed max size.
        with self.assertRaises(Exception):
            create_attachment(
                actor=self.employee_a,
                uploaded_file=_upload("big.jpg", big, "image/jpeg"),
                declared_content_type="image/jpeg",
            )

    def test_extension_mime_mismatch(self):
        with self.assertRaises(Exception):
            create_attachment(
                actor=self.employee_a,
                uploaded_file=_upload("fake.png", JPEG_BYTES, "image/png"),
                declared_content_type="image/png",
            )

    def test_dangerous_filename_normalized(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("../evil/../photo.jpg", JPEG_BYTES, "image/jpeg"),
            declared_content_type="image/jpeg",
        )
        self.assertEqual(attachment.display_filename, "photo.jpg")
        self.assertNotIn("..", attachment.storage_key)

    def test_uuid_storage_key_unique(self):
        a1 = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("a.jpg", JPEG_BYTES, "image/jpeg"),
        )
        a2 = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("b.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.assertNotEqual(a1.storage_key, a2.storage_key)

    def test_download_success_headers(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.client.force_authenticate(self.employee_a)
        url = reverse("attachments-download", kwargs={"pk": attachment.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.content, JPEG_BYTES)
        self.assertTrue(
            AttachmentHistory.objects.filter(
                attachment=attachment,
                action=AttachmentHistory.Action.DOWNLOADED,
            ).exists()
        )

    def test_unauthorized_download_generic_404(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.client.force_authenticate(self.employee_a2)
        url = reverse("attachments-download", kwargs={"pk": attachment.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_download_generic_404(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.client.force_authenticate(self.employee_b)
        url = reverse("attachments-download", kwargs={"pk": attachment.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_metadata_generic_404(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        self.client.force_authenticate(self.employee_b)
        url = reverse("attachments-detail", kwargs={"pk": attachment.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_soft_deleted_inaccessible(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        delete_attachment(actor=self.employee_a, attachment_id=attachment.id)
        self.client.force_authenticate(self.employee_a)
        detail = self.client.get(
            reverse("attachments-detail", kwargs={"pk": attachment.id})
        )
        download = self.client.get(
            reverse("attachments-download", kwargs={"pk": attachment.id})
        )
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(download.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_idempotent(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        first = delete_attachment(actor=self.employee_a, attachment_id=attachment.id)
        second = delete_attachment(actor=self.employee_a, attachment_id=attachment.id)
        self.assertTrue(first.is_deleted)
        self.assertTrue(second.is_deleted)
        self.assertEqual(
            AttachmentHistory.objects.filter(
                attachment=attachment,
                action=AttachmentHistory.Action.DELETED,
            ).count(),
            1,
        )

    def test_api_upload_list_and_no_storage_key_leak(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.post(
            reverse("attachments-list"),
            {
                "file": _upload("doc.pdf", PDF_BYTES, "application/pdf"),
                "category": "document",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("storage_key", response.data)
        self.assertNotIn("checksum_sha256", response.data)
        self.assertEqual(response.data["display_filename"], "doc.pdf")
        self.assertIn("/api/attachments/", response.data["download_url"])

        listed = self.client.get(reverse("attachments-list"))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(listed.data["count"], 1)

    def test_operational_user_can_view_tenant_attachment(self):
        attachment = create_attachment(
            actor=self.employee_a,
            uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
        )
        fetched = get_attachment(actor=self.fm_a, attachment_id=attachment.id)
        self.assertEqual(fetched.id, attachment.id)

    def test_storage_abstraction_local(self):
        storage = get_attachment_storage()
        self.assertIsInstance(storage, LocalAttachmentStorage)
        key = "attachments/test/obj.bin"
        storage.save(key, b"abc")
        self.assertTrue(storage.exists(key))
        self.assertEqual(storage.open(key), b"abc")
        storage.delete(key)
        self.assertFalse(storage.exists(key))

    def test_db_failure_after_storage_cleans_orphan(self):
        with patch(
            "apps.attachments.services.Attachment.objects.create",
            side_effect=RuntimeError("db failed"),
        ):
            with self.assertRaises(RuntimeError):
                create_attachment(
                    actor=self.employee_a,
                    uploaded_file=_upload("photo.jpg", JPEG_BYTES, "image/jpeg"),
                )
        # No orphaned attachment rows.
        self.assertEqual(Attachment.objects.count(), 0)
        # Storage directory should not retain orphaned objects from failed tx.
        leftovers = [p for p in self.storage_root.rglob("*") if p.is_file()]
        self.assertEqual(leftovers, [])

    def test_validate_upload_rejects_active_content(self):
        with self.assertRaises(Exception):
            validate_upload(
                uploaded_file=_upload("page.html", b"<html></html>", "text/html"),
                declared_content_type="text/html",
            )
