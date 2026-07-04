from rest_framework import serializers

from .models import Permission, Role


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
        )
        read_only_fields = fields


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


class UserPermissionSerializer(serializers.Serializer):
    roles = serializers.ListField(child=serializers.CharField())
    permissions = serializers.ListField(child=serializers.CharField())
