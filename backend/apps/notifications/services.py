from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from .models import Notification, NotificationDelivery

MAX_BULK_NOTIFICATION_IDS = 100


def _validate_recipient(recipient):
    if recipient is None:
        raise ValidationError({"recipient": ["Recipient is required."]})

    if not getattr(recipient, "is_active", False):
        raise ValidationError({"recipient": ["Recipient must be an active user."]})


def _normalize_severity(severity):
    value = str(severity or "").strip().lower()
    allowed = {choice for choice, _label in Notification.Severity.choices}
    if value not in allowed:
        raise ValidationError(
            {
                "severity": [
                    "Severity must be one of: info, success, warning, error."
                ]
            }
        )
    return value


def _resolve_tenant(recipient, tenant):
    recipient_tenant = getattr(recipient, "tenant", None)
    recipient_tenant_id = getattr(recipient, "tenant_id", None)

    if recipient_tenant_id is None:
        if tenant is not None:
            raise ValidationError(
                {
                    "tenant": [
                        "Global recipients cannot receive tenant-bound notifications."
                    ]
                }
            )
        return None

    if tenant is None:
        return recipient_tenant

    if tenant.id != recipient_tenant_id:
        raise ValidationError(
            {"tenant": ["Notification tenant must match recipient tenant."]}
        )

    return tenant


def _create_in_app_delivery(*, notification, recipient, tenant):
    delivery = NotificationDelivery(
        notification=notification,
        recipient=recipient,
        tenant=tenant,
        channel=NotificationDelivery.Channel.IN_APP,
        status=NotificationDelivery.Status.DELIVERED,
        delivered_at=timezone.now(),
        attempt_count=0,
    )
    try:
        delivery.full_clean()
    except DjangoValidationError as exc:
        detail = getattr(exc, "message_dict", None) or {
            "non_field_errors": exc.messages
        }
        raise ValidationError(detail) from exc
    delivery.save()
    return delivery


@transaction.atomic
def create_notification(
    *,
    recipient,
    event_code,
    title,
    message,
    severity,
    tenant=None,
    target_url="",
    source_module="",
    source_object_id=None,
    metadata=None,
):
    _validate_recipient(recipient)

    if not str(event_code or "").strip():
        raise ValidationError({"event_code": ["Event code is required."]})
    if not str(title or "").strip():
        raise ValidationError({"title": ["Title is required."]})
    if not str(message or "").strip():
        raise ValidationError({"message": ["Message is required."]})

    resolved_tenant = _resolve_tenant(recipient, tenant)
    normalized_severity = _normalize_severity(severity)

    notification = Notification(
        tenant=resolved_tenant,
        recipient=recipient,
        event_code=str(event_code).strip(),
        title=str(title).strip(),
        message=str(message).strip(),
        severity=normalized_severity,
        target_url=str(target_url or "").strip(),
        source_module=str(source_module or "").strip(),
        source_object_id=source_object_id,
        metadata=metadata if metadata is not None else {},
    )

    try:
        notification.full_clean()
    except DjangoValidationError as exc:
        detail = getattr(exc, "message_dict", None) or {
            "non_field_errors": exc.messages
        }
        raise ValidationError(detail) from exc

    notification.save()
    _create_in_app_delivery(
        notification=notification,
        recipient=recipient,
        tenant=resolved_tenant,
    )
    return notification


def _normalize_notification_ids(notification_ids):
    if not notification_ids:
        raise ValidationError(
            {"notification_ids": ["At least one notification ID is required."]}
        )

    normalized = list(dict.fromkeys(notification_ids))
    if len(normalized) > MAX_BULK_NOTIFICATION_IDS:
        raise ValidationError(
            {
                "notification_ids": [
                    f"No more than {MAX_BULK_NOTIFICATION_IDS} notification IDs are allowed."
                ]
            }
        )

    return normalized


def _assert_queryset_contains_notification_ids(queryset, notification_ids):
    matched_ids = set(
        queryset.filter(id__in=notification_ids).values_list("id", flat=True)
    )
    if len(matched_ids) != len(notification_ids):
        raise NotFound("Notification not found.")


@transaction.atomic
def mark_notification_read(notification):
    if notification.is_read:
        return notification

    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save(update_fields=("is_read", "read_at", "updated_at"))
    return notification


@transaction.atomic
def mark_notification_unread(notification):
    if not notification.is_read:
        return notification

    notification.is_read = False
    notification.read_at = None
    notification.save(update_fields=("is_read", "read_at", "updated_at"))
    return notification


@transaction.atomic
def mark_all_notifications_read(queryset):
    now = timezone.now()
    return queryset.filter(is_read=False).update(
        is_read=True,
        read_at=now,
        updated_at=now,
    )


@transaction.atomic
def bulk_update_notification_state(queryset, notification_ids, is_read):
    normalized_ids = _normalize_notification_ids(notification_ids)
    _assert_queryset_contains_notification_ids(queryset, normalized_ids)

    matched_queryset = queryset.filter(id__in=normalized_ids)
    now = timezone.now()

    if is_read:
        return matched_queryset.filter(is_read=False).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )

    return matched_queryset.filter(is_read=True).update(
        is_read=False,
        read_at=None,
        updated_at=now,
    )
