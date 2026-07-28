from rest_framework import serializers

from apps.fm_tickets.tenant_scope import uses_employee_requester_scope

from .models import Attachment
from .ownership import AttachmentOwnerType, AttachmentVisibility


class AttachmentSerializer(serializers.ModelSerializer):
    uploader_email = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = (
            "id",
            "original_filename",
            "display_filename",
            "validated_content_type",
            "extension",
            "size_bytes",
            "category",
            "status",
            "visibility",
            "owner_type",
            "owner_id",
            "uploader_email",
            "can_delete",
            "created_at",
            "updated_at",
            "download_url",
        )
        read_only_fields = fields

    def _actor(self):
        request = self.context.get("request")
        return getattr(request, "user", None) if request is not None else None

    def _is_requester_audience(self):
        user = self._actor()
        return uses_employee_requester_scope(user) if user is not None else False

    def get_uploader_email(self, obj):
        # Requesters must not see internal uploader identities.
        if self._is_requester_audience():
            return ""
        uploaded_by = getattr(obj, "uploaded_by", None)
        return getattr(uploaded_by, "email", "") or ""

    def get_download_url(self, obj):
        return f"/api/attachments/{obj.id}/download/"

    def get_can_delete(self, obj):
        """Advisory capability for UI; backend still enforces on DELETE."""
        from apps.attachments.owner_access import (
            actor_is_requester_audience,
            can_internal_contribute_to_ticket,
            ticket_is_immutable,
        )
        from apps.attachments.tenant_scope import user_can_delete_attachments
        from apps.fm_tickets.models import FmTicket
        from apps.fm_tickets.tenant_scope import scope_fm_ticket_queryset

        actor = self._actor()
        if actor is None or not user_can_delete_attachments(actor):
            return False

        owner_type = getattr(obj, "owner_type", "") or ""
        owner_id = getattr(obj, "owner_id", None)
        if owner_type != AttachmentOwnerType.FM_TICKET or owner_id is None:
            # Unlinked library: employees may delete own uploads; ops may delete in tenant.
            if uses_employee_requester_scope(actor):
                return obj.uploaded_by_id == getattr(actor, "id", None)
            return True

        ticket = scope_fm_ticket_queryset(
            FmTicket.objects.filter(is_deleted=False),
            actor,
        ).filter(pk=owner_id).first()
        if ticket is None or ticket_is_immutable(ticket):
            return False

        if actor_is_requester_audience(actor):
            return (
                obj.uploaded_by_id == getattr(actor, "id", None)
                and obj.visibility == AttachmentVisibility.REQUESTER_VISIBLE
            )
        return can_internal_contribute_to_ticket(actor)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._is_requester_audience():
            # Keep requester payloads minimal and non-operational.
            data.pop("uploader_email", None)
            # Owner identifiers are already known from the My Request route context.
            data.pop("owner_type", None)
            data.pop("owner_id", None)
        return data


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(allow_empty_file=False)
    category = serializers.ChoiceField(
        choices=Attachment.Category.choices,
        required=False,
        allow_null=True,
    )
    owner_type = serializers.CharField(required=False, allow_blank=True, max_length=64)
    owner_id = serializers.UUIDField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(
        choices=AttachmentVisibility.CHOICES,
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        owner_type = (attrs.get("owner_type") or "").strip()
        owner_id = attrs.get("owner_id")
        if bool(owner_type) != bool(owner_id):
            raise serializers.ValidationError("Invalid attachment owner context.")
        if owner_type and owner_type not in AttachmentOwnerType.SUPPORTED:
            raise serializers.ValidationError("Invalid attachment owner context.")
        attrs["owner_type"] = owner_type
        return attrs
