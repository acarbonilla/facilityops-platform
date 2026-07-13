from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel


class Notification(UUIDModel, TimeStampedModel):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        SUCCESS = "success", "Success"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    tenant = models.ForeignKey(
        "master_data.Tenant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="notifications",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    event_code = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=Severity.choices)
    target_url = models.CharField(max_length=500, blank=True)
    source_module = models.CharField(max_length=100, blank=True)
    source_object_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["recipient", "-created_at", "-id"],
                name="notif_rec_created_idx",
            ),
            models.Index(
                fields=["recipient", "is_read", "-created_at", "-id"],
                name="notif_rec_read_created_idx",
            ),
        ]

    def clean(self):
        super().clean()

        recipient_tenant_id = getattr(self.recipient, "tenant_id", None)
        if recipient_tenant_id is not None and self.tenant_id != recipient_tenant_id:
            raise ValidationError(
                {
                    "tenant": (
                        "Notification tenant must match the recipient tenant."
                    )
                }
            )

        if recipient_tenant_id is None and self.tenant_id is not None:
            raise ValidationError(
                {
                    "tenant": (
                        "Global recipients cannot receive tenant-bound notifications."
                    )
                }
            )

        if self.read_at and not self.is_read:
            raise ValidationError(
                {"is_read": "Notifications with read_at must be marked as read."}
            )

    def __str__(self):
        return f"{self.recipient.email}::{self.event_code}"
