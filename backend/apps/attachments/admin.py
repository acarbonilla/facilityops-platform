from django.contrib import admin

from .models import Attachment, AttachmentHistory


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "display_filename",
        "validated_content_type",
        "size_bytes",
        "category",
        "status",
        "tenant",
        "uploaded_by",
        "created_at",
        "is_deleted",
    )
    list_filter = ("status", "category", "validated_content_type", "is_deleted")
    search_fields = ("id", "display_filename", "checksum_sha256")
    readonly_fields = (
        "id",
        "storage_key",
        "checksum_sha256",
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by",
        "updated_by",
        "deleted_by",
    )


@admin.register(AttachmentHistory)
class AttachmentHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "action",
        "attachment_id_snapshot",
        "tenant",
        "actor",
        "created_at",
    )
    list_filter = ("action",)
    search_fields = ("attachment_id_snapshot", "note")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "deleted_by",
    )
