import re

from django.utils.text import slugify
from rest_framework import serializers

from .models import Permission, Role
from .services import create_role, update_role


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "code",
            "description",
            "is_system_role",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class RoleWriteSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=100)
    protected_fields = ("is_system_role", "is_active", "created_at", "updated_at")

    class Meta:
        model = Role
        fields = (
            "name",
            "code",
            "description",
            "is_system_role",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "is_system_role",
            "is_active",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        errors = {}
        for field in self.protected_fields:
            if field in self.initial_data:
                errors[field] = ["This field is read-only."]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Role name cannot be blank.")
        return value

    def validate_code(self, value):
        value = value.strip()
        if not value or not re.fullmatch(r"[A-Za-z0-9_\s-]+", value):
            raise serializers.ValidationError(
                "Enter a valid role code using letters, numbers, spaces, "
                "underscores, or hyphens."
            )
        normalized = slugify(value)
        if not normalized:
            raise serializers.ValidationError("Role code cannot be blank.")
        if self.instance is not None and normalized != self.instance.code:
            raise serializers.ValidationError("Role code cannot be changed.")
        return normalized

    def create(self, validated_data):
        return create_role(
            actor=self.context["request"].user,
            validated_data=validated_data,
        )

    def update(self, instance, validated_data):
        return update_role(
            actor=self.context["request"].user,
            role=instance,
            validated_data=validated_data,
        )


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = (
            "id",
            "name",
            "code",
            "module",
            "action",
            "description",
            "is_active",
        )
        read_only_fields = fields


class RolePermissionAssignmentRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "code",
            "description",
            "is_system_role",
            "is_active",
        )
        read_only_fields = fields


class RolePermissionAssignmentSerializer(serializers.Serializer):
    role = RolePermissionAssignmentRoleSerializer(read_only=True)
    assigned_permissions = PermissionSerializer(read_only=True, many=True)


class ReplaceRolePermissionsSerializer(serializers.Serializer):
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(format="hex_verbose"),
        allow_empty=True,
    )

    def validate_permission_ids(self, value):
        normalized_ids = [str(permission_id) for permission_id in value]
        if len(normalized_ids) != len(set(normalized_ids)):
            raise serializers.ValidationError(
                "Duplicate permission IDs are not allowed."
            )
        return value


class UserPermissionSerializer(serializers.Serializer):
    roles = serializers.ListField(child=serializers.CharField())
    permissions = serializers.ListField(child=serializers.CharField())
