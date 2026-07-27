from rest_framework import serializers

from .models import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
    uploader_email = serializers.EmailField(source="uploaded_by.email", read_only=True)
    download_url = serializers.SerializerMethodField()

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
            "uploader_email",
            "created_at",
            "updated_at",
            "download_url",
        )
        read_only_fields = fields

    def get_download_url(self, obj):
        return f"/api/attachments/{obj.id}/download/"


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(allow_empty_file=False)
    category = serializers.ChoiceField(
        choices=Attachment.Category.choices,
        required=False,
        allow_null=True,
    )
