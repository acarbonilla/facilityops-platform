"""Tenant and ownership scoping for attachments."""

from apps.access_control.services import user_has_permission
from apps.fm_tickets.tenant_scope import uses_employee_requester_scope

from .models import Attachment


def has_global_attachment_scope(user) -> bool:
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return user.user_roles.filter(
        role__code="system_admin",
        role__is_active=True,
        role__is_deleted=False,
    ).exists() and getattr(user, "tenant_id", None) is None


def user_can_upload_attachments(user) -> bool:
    return user_has_permission(user, "attachments.upload")


def user_can_view_attachments(user) -> bool:
    return user_has_permission(user, "attachments.view")


def user_can_download_attachments(user) -> bool:
    return user_has_permission(user, "attachments.download")


def user_can_delete_attachments(user) -> bool:
    return user_has_permission(user, "attachments.delete")


def scoped_attachment_queryset(user):
    """Return attachments visible to the requester within tenant policy."""
    queryset = Attachment.objects.filter(is_deleted=False).select_related(
        "tenant",
        "uploaded_by",
    )
    if user is None or not getattr(user, "is_authenticated", False):
        return queryset.none()

    if has_global_attachment_scope(user):
        return queryset

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()

    queryset = queryset.filter(tenant_id=tenant_id)

    # Employee-only users may only see attachments they uploaded.
    if uses_employee_requester_scope(user):
        return queryset.filter(uploaded_by_id=user.id)
    return queryset
