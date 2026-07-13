from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Notification


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
    return notification
