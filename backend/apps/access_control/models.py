from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel


class Role(BaseModel):
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_system_role = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Permission(BaseModel):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=150, unique=True)
    module = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["module", "action", "name"]

    def clean(self):
        super().clean()
        expected_code = f"{self.module}.{self.action}"
        if self.code != expected_code:
            raise ValidationError(
                {"code": "Permission code must match the module.action format."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class RolePermission(BaseModel):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("role", "permission"),
                name="unique_role_permission_assignment",
            )
        ]
        ordering = ["role__name", "permission__code"]

    def __str__(self):
        return f"{self.role.code} -> {self.permission.code}"


class UserRole(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "role"),
                name="unique_user_role_assignment",
            )
        ]
        ordering = ["role__name", "user__email"]

    def __str__(self):
        return f"{self.user.email} -> {self.role.code}"
