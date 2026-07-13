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


class NotificationPreference(UUIDModel, TimeStampedModel):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In App"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        PUSH = "push", "Push"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    tenant = models.ForeignKey(
        "master_data.Tenant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="notification_preferences",
    )
    source_module = models.CharField(max_length=100, blank=True, default="")
    channel = models.CharField(max_length=20, choices=Channel.choices)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["source_module", "channel", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "source_module", "channel"],
                name="notif_pref_recipient_module_channel_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["recipient", "source_module", "channel"],
                name="notif_pref_recipient_idx",
            ),
        ]

    def clean(self):
        super().clean()

        recipient_tenant_id = getattr(self.recipient, "tenant_id", None)
        if recipient_tenant_id is not None:
            if self.tenant_id != recipient_tenant_id:
                raise ValidationError(
                    {
                        "tenant": (
                            "Preference tenant must match the recipient tenant."
                        )
                    }
                )
        elif self.tenant_id is not None:
            raise ValidationError(
                {
                    "tenant": (
                        "Global recipients cannot have tenant-bound preferences."
                    )
                }
            )

    def __str__(self):
        scope = self.source_module or "default"
        return f"{self.recipient.email}::{scope}::{self.channel}"


class NotificationDelivery(UUIDModel, TimeStampedModel):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In App"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        PUSH = "push", "Push"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_deliveries",
    )
    tenant = models.ForeignKey(
        "master_data.Tenant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="notification_deliveries",
    )
    channel = models.CharField(max_length=20, choices=Channel.choices)
    status = models.CharField(max_length=20, choices=Status.choices)
    attempt_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    failure_code = models.CharField(max_length=100, blank=True)
    failure_message = models.TextField(blank=True)
    provider_reference = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "channel"],
                name="notif_delivery_notification_channel_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["recipient", "status", "-created_at"],
                name="notif_del_recipient_idx",
            ),
            models.Index(
                fields=["channel", "status", "-created_at"],
                name="notif_del_channel_idx",
            ),
            models.Index(
                fields=["notification", "channel"],
                name="notif_del_notif_chan_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if self.notification_id and self.recipient_id:
            if self.recipient_id != self.notification.recipient_id:
                raise ValidationError(
                    {
                        "recipient": (
                            "Delivery recipient must match the notification recipient."
                        )
                    }
                )

        notification_tenant_id = (
            self.notification.tenant_id if self.notification_id else None
        )
        if notification_tenant_id != self.tenant_id:
            raise ValidationError(
                {"tenant": "Delivery tenant must match the notification tenant."}
            )

        if self.status == self.Status.DELIVERED:
            if not self.delivered_at:
                raise ValidationError(
                    {
                        "delivered_at": (
                            "Delivered deliveries must include delivered_at."
                        )
                    }
                )
        elif self.delivered_at:
            raise ValidationError(
                {
                    "delivered_at": (
                        "Only delivered deliveries may include delivered_at."
                    )
                }
            )

    def __str__(self):
        return f"{self.notification_id}::{self.channel}::{self.status}"
