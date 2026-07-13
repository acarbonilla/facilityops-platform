import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import NotificationPreference

SUPPORTED_CHANNELS = {
    NotificationPreference.Channel.IN_APP,
    NotificationPreference.Channel.EMAIL,
    NotificationPreference.Channel.SMS,
    NotificationPreference.Channel.PUSH,
}
SUPPORTED_SOURCE_MODULES = {
    "fm_tickets",
    "maintenance",
    "inspection",
}
PLATFORM_CHANNEL_DEFAULTS = {
    NotificationPreference.Channel.IN_APP: True,
    NotificationPreference.Channel.EMAIL: False,
    NotificationPreference.Channel.SMS: False,
    NotificationPreference.Channel.PUSH: False,
}
MAX_SOURCE_MODULE_LENGTH = 100
SOURCE_MODULE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def get_platform_channel_defaults():
    return {
        channel: PLATFORM_CHANNEL_DEFAULTS[channel]
        for channel in SUPPORTED_CHANNELS
    }


def normalize_channel(channel):
    value = str(channel or "").strip().lower()
    if value not in SUPPORTED_CHANNELS:
        raise ValidationError(
            {
                "channel": [
                    "Channel must be one of: in_app, email, sms, push."
                ]
            }
        )
    return value


def normalize_source_module(source_module):
    value = str(source_module or "").strip().lower()
    if len(value) > MAX_SOURCE_MODULE_LENGTH:
        raise ValidationError(
            {
                "source_module": [
                    f"Source module must be {MAX_SOURCE_MODULE_LENGTH} characters or fewer."
                ]
            }
        )
    if value and value not in SUPPORTED_SOURCE_MODULES:
        raise ValidationError(
            {
                "source_module": [
                    "Source module must be empty or one of: "
                    "fm_tickets, maintenance, inspection."
                ]
            }
        )
    if value and not SOURCE_MODULE_PATTERN.match(value):
        raise ValidationError(
            {
                "source_module": [
                    "Source module must use lowercase letters, numbers, and underscores."
                ]
            }
        )
    return value


def _resolve_preference_tenant(recipient):
    recipient_tenant_id = getattr(recipient, "tenant_id", None)
    if recipient_tenant_id is None:
        return None
    return recipient.tenant


def _validate_preference_entry(*, recipient, source_module, channel, is_enabled):
    normalized_channel = normalize_channel(channel)
    normalized_source_module = normalize_source_module(source_module)
    if is_enabled is not None and not isinstance(is_enabled, bool):
        raise ValidationError(
            {"is_enabled": ["is_enabled must be true, false, or null."]}
        )
    if is_enabled is None and not normalized_source_module:
        raise ValidationError(
            {
                "is_enabled": [
                    "is_enabled cannot be null for channel default preferences."
                ]
            }
        )
    return {
        "tenant": _resolve_preference_tenant(recipient),
        "source_module": normalized_source_module,
        "channel": normalized_channel,
        "is_enabled": is_enabled,
    }


def _reject_duplicate_preference_entries(preferences):
    seen = set()
    for preference in preferences:
        key = (
            preference["source_module"],
            preference["channel"],
        )
        if key in seen:
            raise ValidationError(
                {
                    "preferences": [
                        "Duplicate source_module and channel combinations are not allowed."
                    ]
                }
            )
        seen.add(key)


def serialize_preference(preference):
    return {
        "id": preference.id,
        "source_module": preference.source_module,
        "channel": preference.channel,
        "is_enabled": preference.is_enabled,
        "created_at": preference.created_at,
        "updated_at": preference.updated_at,
    }


def build_preferences_response(recipient):
    preferences = NotificationPreference.objects.filter(
        recipient=recipient,
    ).order_by("source_module", "channel", "created_at")
    return {
        "defaults": get_platform_channel_defaults(),
        "preferences": [serialize_preference(preference) for preference in preferences],
    }


def get_effective_notification_preference(
    recipient,
    channel,
    source_module="",
):
    normalized_channel = normalize_channel(channel)
    normalized_source_module = normalize_source_module(source_module)

    if normalized_source_module:
        module_preference = NotificationPreference.objects.filter(
            recipient=recipient,
            source_module=normalized_source_module,
            channel=normalized_channel,
        ).first()
        if module_preference is not None:
            return module_preference.is_enabled

    default_preference = NotificationPreference.objects.filter(
        recipient=recipient,
        source_module="",
        channel=normalized_channel,
    ).first()
    if default_preference is not None:
        return default_preference.is_enabled

    return PLATFORM_CHANNEL_DEFAULTS[normalized_channel]


@transaction.atomic
def set_notification_preferences(recipient, preferences):
    if preferences is None:
        raise ValidationError({"preferences": ["Preferences are required."]})

    normalized_entries = [
        _validate_preference_entry(
            recipient=recipient,
            source_module=entry.get("source_module", ""),
            channel=entry["channel"],
            is_enabled=entry["is_enabled"],
        )
        for entry in preferences
    ]
    _reject_duplicate_preference_entries(normalized_entries)

    for entry in normalized_entries:
        if entry["is_enabled"] is None:
            NotificationPreference.objects.filter(
                recipient=recipient,
                source_module=entry["source_module"],
                channel=entry["channel"],
            ).delete()
            continue

        preference, _created = NotificationPreference.objects.get_or_create(
            recipient=recipient,
            source_module=entry["source_module"],
            channel=entry["channel"],
            defaults={
                "tenant": entry["tenant"],
                "is_enabled": entry["is_enabled"],
            },
        )
        preference.tenant = entry["tenant"]
        preference.is_enabled = entry["is_enabled"]
        try:
            preference.full_clean()
        except DjangoValidationError as exc:
            detail = getattr(exc, "message_dict", None) or {
                "non_field_errors": exc.messages
            }
            raise ValidationError(detail) from exc
        preference.save()

    return build_preferences_response(recipient)
