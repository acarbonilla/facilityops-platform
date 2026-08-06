from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Project, ProjectHistory, ProjectMember
from .services import (
    add_project_member,
    create_project,
    update_project,
)
from .tenant_scope import has_global_project_scope

User = get_user_model()


class ProjectValidationMixin:
    def _run_model_clean(self, attrs):
        instance = self.instance
        if instance is None:
            project = Project()
        else:
            project = Project.objects.get(pk=instance.pk)

        for field, value in attrs.items():
            setattr(project, field, value)

        try:
            project.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class ProjectMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = (
            "id",
            "tenant",
            "project",
            "user",
            "user_email",
            "user_name",
            "role",
            "is_active",
            "added_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "tenant",
            "project",
            "added_by",
            "created_at",
            "updated_at",
        )

    def get_user_name(self, obj):
        user = obj.user
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email


class ProjectMemberCreateSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    role = serializers.ChoiceField(
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.MEMBER,
    )

    def create(self, validated_data):
        return add_project_member(
            project=self.context["project"],
            user=validated_data["user"],
            role=validated_data["role"],
            actor=self.context["request"].user,
        )


class ProjectHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = ProjectHistory
        fields = (
            "id",
            "project",
            "actor",
            "actor_email",
            "action",
            "description",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class ProjectListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    building_name = serializers.CharField(
        source="building.name", read_only=True, default=None
    )
    project_manager_email = serializers.EmailField(
        source="project_manager.email", read_only=True, default=None
    )

    class Meta:
        model = Project
        fields = (
            "id",
            "tenant",
            "organization",
            "organization_name",
            "building",
            "building_name",
            "project_code",
            "name",
            "description",
            "project_manager",
            "project_manager_email",
            "status",
            "priority",
            "planned_start_date",
            "planned_end_date",
            "actual_start_date",
            "actual_end_date",
            "completion_percentage",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ProjectDetailSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    building_name = serializers.CharField(
        source="building.name", read_only=True, default=None
    )
    project_manager_email = serializers.EmailField(
        source="project_manager.email", read_only=True, default=None
    )
    members = serializers.SerializerMethodField()
    recent_history = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "tenant",
            "organization",
            "organization_name",
            "building",
            "building_name",
            "project_code",
            "name",
            "description",
            "project_manager",
            "project_manager_email",
            "status",
            "priority",
            "planned_start_date",
            "planned_end_date",
            "actual_start_date",
            "actual_end_date",
            "completion_percentage",
            "members",
            "recent_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_members(self, obj):
        members = obj.members.filter(is_deleted=False, is_active=True).select_related(
            "user", "added_by"
        )
        return ProjectMemberSerializer(members, many=True).data

    def get_recent_history(self, obj):
        entries = obj.history_entries.select_related("actor").order_by("-created_at")[
            :10
        ]
        return ProjectHistorySerializer(entries, many=True).data


class ProjectCreateSerializer(ProjectValidationMixin, serializers.ModelSerializer):
    project_code = serializers.CharField(required=False, allow_blank=True)
    completion_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = Project
        fields = (
            "id",
            "organization",
            "building",
            "project_code",
            "name",
            "description",
            "project_manager",
            "status",
            "priority",
            "planned_start_date",
            "planned_end_date",
            "actual_start_date",
            "actual_end_date",
            "completion_percentage",
        )
        read_only_fields = ("id", "completion_percentage")

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        # Never accept client tenant — derive from user or organization.
        attrs.pop("tenant", None)

        organization = attrs.get("organization")
        if organization is None:
            raise serializers.ValidationError(
                {"organization": "Organization is required."}
            )

        if has_global_project_scope(user):
            tenant = organization.tenant
        else:
            if not getattr(user, "tenant_id", None):
                raise serializers.ValidationError(
                    {"tenant": "Your account has no tenant."}
                )
            tenant = user.tenant
            if organization.tenant_id != tenant.id:
                raise serializers.ValidationError(
                    {
                        "organization": (
                            "Organization must belong to your tenant."
                        )
                    }
                )

        attrs["tenant"] = tenant
        return self._run_model_clean(attrs)

    def create(self, validated_data):
        return create_project(
            actor=self.context["request"].user,
            data=validated_data,
        )


class ProjectUpdateSerializer(ProjectValidationMixin, serializers.ModelSerializer):
    completion_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = Project
        fields = (
            "organization",
            "building",
            "project_code",
            "name",
            "description",
            "project_manager",
            "status",
            "priority",
            "planned_start_date",
            "planned_end_date",
            "actual_start_date",
            "actual_end_date",
            "completion_percentage",
        )
        read_only_fields = ("completion_percentage",)

    def validate(self, attrs):
        attrs.pop("tenant", None)
        merged = {}
        for field in self.Meta.fields:
            if field == "completion_percentage":
                continue
            if field in attrs:
                merged[field] = attrs[field]
            else:
                merged[field] = getattr(self.instance, field)
        merged["tenant"] = self.instance.tenant
        self._run_model_clean(merged)
        return attrs

    def update(self, instance, validated_data):
        return update_project(
            project=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )
