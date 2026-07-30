"""Shared attachment metadata for FacilityOps operational evidence."""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.master_data.models import Tenant

from .ownership import AttachmentOwnerType, AttachmentVisibility


class Attachment(BaseModel):
    """Tenant-owned binary attachment metadata. Storage keys are server-generated."""

    class Category(models.TextChoices):
        IMAGE_EVIDENCE = "image_evidence", "Image evidence"
        DOCUMENT = "document", "Document"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RETIRED = "retired", "Retired"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_attachments",
    )
    # FO-081: optional module ownership. Empty owner_type means unlinked library.
    # Security: tenant and uploader are always server-derived; never trust client IDs.
    owner_type = models.CharField(
        max_length=64,
        blank=True,
        default=AttachmentOwnerType.NONE,
        db_index=True,
        help_text="Owning business object type (e.g. fm_ticket). Blank = unlinked.",
    )
    owner_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Owning business object UUID. Null when unlinked.",
    )
    # FO-081: requester safety classification. Default internal_only is conservative.
    visibility = models.CharField(
        max_length=32,
        choices=AttachmentVisibility.CHOICES,
        default=AttachmentVisibility.INTERNAL_ONLY,
        db_index=True,
        help_text="Audience visibility. Defaults to internal_only for safety.",
    )
    original_filename = models.CharField(max_length=255)
    display_filename = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=512, unique=True)
    declared_content_type = models.CharField(max_length=100, blank=True)
    validated_content_type = models.CharField(max_length=100)
    extension = models.CharField(max_length=20)
    size_bytes = models.PositiveBigIntegerField()
    checksum_sha256 = models.CharField(max_length=64, db_index=True)
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.OTHER,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=["tenant", "status", "-created_at"],
                name="attach_tenant_status_created",
            ),
            models.Index(
                fields=["tenant", "uploaded_by", "-created_at"],
                name="attach_tenant_uploader_created",
            ),
            models.Index(
                fields=["tenant", "is_deleted", "-created_at"],
                name="attach_tenant_deleted_created",
            ),
            models.Index(
                fields=["tenant", "owner_type", "owner_id", "status", "-created_at"],
                name="attach_owner_status_crt",
            ),
            models.Index(
                fields=["tenant", "owner_type", "owner_id", "visibility", "-created_at"],
                name="attach_owner_vis_crt",
            ),
        ]

    def __str__(self):
        return f"{self.display_filename} ({self.id})"


class AttachmentHistory(BaseModel):
    """Audit trail for attachment lifecycle events."""

    class Action(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        DOWNLOADED = "downloaded", "Downloaded"
        DELETED = "deleted", "Deleted"
        ACCESS_DENIED = "access_denied", "Access denied"

    attachment = models.ForeignKey(
        Attachment,
        on_delete=models.CASCADE,
        related_name="history_entries",
        null=True,
        blank=True,
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="attachment_history_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attachment_history_actions",
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    attachment_id_snapshot = models.UUIDField(db_index=True)
    note = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=["tenant", "action", "-created_at"],
                name="attach_hist_tenant_action",
            ),
        ]

    def __str__(self):
        return f"{self.action} {self.attachment_id_snapshot}"
