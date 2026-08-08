from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Project,
    ProjectHistory,
    ProjectIssue,
    ProjectIssueComment,
    ProjectMember,
    ProjectNote,
    ProjectOperationalLink,
    ProjectProgressSnapshot,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
    ProjectTaskDependency,
)
from .services import (
    add_issue_comment,
    add_project_member,
    add_task_comment,
    assign_task,
    build_task_summary,
    create_checklist_item,
    create_issue,
    create_note,
    create_project,
    create_task,
    update_checklist_item,
    update_issue,
    update_note,
    update_project,
    update_task,
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
    my_workspace = serializers.SerializerMethodField()

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
            "my_workspace",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_my_workspace(self, obj):
        request = self.context.get("request")
        actor = getattr(request, "user", None) if request else None
        if actor is None or not getattr(actor, "is_authenticated", False):
            return None
        from .services import build_task_summary
        from .workspace_access import user_uses_project_workspace_scope

        if not user_uses_project_workspace_scope(actor):
            return None
        summary = build_task_summary(obj, actor=actor)
        return {
            "my_assigned": summary.get("my_assigned", 0),
            "my_completed": summary.get("my_completed", 0),
            "my_overdue": summary.get("my_overdue", 0),
            "next_assigned_task": summary.get("next_assigned_task"),
        }


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
    task_summary = serializers.SerializerMethodField()

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
            "task_summary",
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

    def get_task_summary(self, obj):
        request = self.context.get("request")
        actor = getattr(request, "user", None) if request else None
        return build_task_summary(obj, actor=actor)


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

        # FO-107: validate completed gate against freshly calculated accomplishment.
        if (
            attrs.get("status") == Project.Status.COMPLETED
            and self.instance.status != Project.Status.COMPLETED
        ):
            from .progress_service import calculate_accomplishment

            merged["completion_percentage"] = calculate_accomplishment(self.instance)
        else:
            merged["completion_percentage"] = self.instance.completion_percentage

        self._run_model_clean(merged)
        return attrs

    def update(self, instance, validated_data):
        return update_project(
            project=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


# ---------------------------------------------------------------------------
# FO-104 Task serializers
# ---------------------------------------------------------------------------


class ProjectTaskChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTaskChecklistItem
        fields = (
            "id",
            "task",
            "text",
            "is_completed",
            "sequence",
            "completed_by",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "task",
            "completed_by",
            "completed_at",
            "created_at",
            "updated_at",
        )


class ProjectTaskChecklistItemCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)
    sequence = serializers.IntegerField(required=False, min_value=0)
    is_completed = serializers.BooleanField(required=False, default=False)

    def create(self, validated_data):
        return create_checklist_item(
            task=self.context["task"],
            actor=self.context["request"].user,
            **validated_data,
        )


class ProjectTaskChecklistItemUpdateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500, required=False)
    sequence = serializers.IntegerField(required=False, min_value=0)
    is_completed = serializers.BooleanField(required=False)

    def update(self, instance, validated_data):
        return update_checklist_item(
            item=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class ProjectTaskCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = ProjectTaskComment
        fields = (
            "id",
            "task",
            "author",
            "author_email",
            "body",
            "is_internal",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "task",
            "author",
            "author_email",
            "is_internal",
            "created_at",
            "updated_at",
        )


class ProjectTaskCommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    is_internal = serializers.BooleanField(required=False, default=True)

    def create(self, validated_data):
        return add_task_comment(
            task=self.context["task"],
            body=validated_data["body"],
            is_internal=validated_data.get("is_internal", True),
            actor=self.context["request"].user,
        )


class ProjectTaskDerivedFieldsMixin:
    """FO-105 readiness + delay fields; prefer batch maps from context."""

    derived_fields = (
        "is_dependency_ready",
        "blocking_predecessor_count",
        "predecessor_count",
        "successor_count",
        "is_delayed",
        "is_completed_late",
        "delay_days",
    )

    def _empty_readiness(self):
        return {
            "is_dependency_ready": True,
            "blocking_predecessor_count": 0,
            "blocking_predecessors": [],
            "predecessor_count": 0,
            "successor_count": 0,
        }

    def _resolve_readiness(self, obj):
        readiness_map = self.context.get("dependency_readiness")
        if readiness_map is not None:
            return readiness_map.get(str(obj.id)) or self._empty_readiness()
        from .dependency_service import get_dependency_readiness

        return get_dependency_readiness(obj)

    def _resolve_delay(self, obj):
        delay_map = self.context.get("delay_flags")
        if delay_map is not None:
            return delay_map.get(str(obj.id)) or {
                "is_delayed": False,
                "is_completed_late": False,
                "delay_days": 0,
            }
        from .dependency_service import compute_delay_flags

        return compute_delay_flags(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        readiness = self._resolve_readiness(instance)
        delay = self._resolve_delay(instance)
        data["is_dependency_ready"] = readiness["is_dependency_ready"]
        data["blocking_predecessor_count"] = readiness[
            "blocking_predecessor_count"
        ]
        data["predecessor_count"] = readiness["predecessor_count"]
        data["successor_count"] = readiness["successor_count"]
        data["is_delayed"] = delay["is_delayed"]
        data["is_completed_late"] = delay["is_completed_late"]
        data["delay_days"] = delay["delay_days"]
        return data


class ProjectTaskListSerializer(
    ProjectTaskDerivedFieldsMixin, serializers.ModelSerializer
):
    person_in_charge_email = serializers.EmailField(
        source="person_in_charge.email", read_only=True, default=None
    )

    class Meta:
        model = ProjectTask
        fields = (
            "id",
            "tenant",
            "project",
            "task_code",
            "name",
            "description",
            "person_in_charge",
            "person_in_charge_email",
            "status",
            "priority",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "progress_percentage",
            "sequence",
            "is_milestone",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ProjectTaskDetailSerializer(
    ProjectTaskDerivedFieldsMixin, serializers.ModelSerializer
):
    person_in_charge_email = serializers.EmailField(
        source="person_in_charge.email", read_only=True, default=None
    )
    checklist_items = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTask
        fields = (
            "id",
            "tenant",
            "project",
            "task_code",
            "name",
            "description",
            "person_in_charge",
            "person_in_charge_email",
            "status",
            "priority",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "progress_percentage",
            "sequence",
            "is_milestone",
            "checklist_items",
            "comments",
            "comments_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_checklist_items(self, obj):
        items = obj.checklist_items.filter(is_deleted=False).order_by(
            "sequence", "created_at"
        )
        return ProjectTaskChecklistItemSerializer(items, many=True).data

    def get_comments(self, obj):
        comments = obj.comments.filter(is_deleted=False).select_related("author")
        return ProjectTaskCommentSerializer(comments, many=True).data

    def get_comments_count(self, obj):
        return obj.comments.filter(is_deleted=False).count()


class ProjectTaskDependencySerializer(serializers.ModelSerializer):
    predecessor_task_code = serializers.CharField(
        source="predecessor_task.task_code", read_only=True
    )
    successor_task_code = serializers.CharField(
        source="successor_task.task_code", read_only=True
    )

    class Meta:
        model = ProjectTaskDependency
        fields = (
            "id",
            "tenant",
            "project",
            "predecessor_task",
            "predecessor_task_code",
            "successor_task",
            "successor_task_code",
            "dependency_type",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ProjectTaskDependencyCreateSerializer(serializers.Serializer):
    predecessor_task = serializers.UUIDField()
    successor_task = serializers.UUIDField()
    dependency_type = serializers.ChoiceField(
        choices=ProjectTaskDependency.DependencyType.choices,
        default=ProjectTaskDependency.DependencyType.FINISH_TO_START,
        required=False,
    )

    def validate(self, attrs):
        project = self.context["project"]
        try:
            predecessor = ProjectTask.objects.get(
                pk=attrs["predecessor_task"],
                project=project,
                is_deleted=False,
            )
        except ProjectTask.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"predecessor_task": "Predecessor task not found on this project."}
            ) from exc
        try:
            successor = ProjectTask.objects.get(
                pk=attrs["successor_task"],
                project=project,
                is_deleted=False,
            )
        except ProjectTask.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"successor_task": "Successor task not found on this project."}
            ) from exc
        attrs["predecessor_task"] = predecessor
        attrs["successor_task"] = successor
        return attrs

    def create(self, validated_data):
        from .dependency_service import create_dependency

        return create_dependency(
            project=self.context["project"],
            predecessor_task=validated_data["predecessor_task"],
            successor_task=validated_data["successor_task"],
            dependency_type=validated_data.get(
                "dependency_type",
                ProjectTaskDependency.DependencyType.FINISH_TO_START,
            ),
            actor=self.context["request"].user,
        )


class ProjectTaskValidationMixin:
    def _run_task_clean(self, attrs, *, instance=None, project=None):
        if instance is None:
            task = ProjectTask(project=project, tenant=project.tenant)
        else:
            task = ProjectTask.objects.select_related("project").get(pk=instance.pk)

        for field, value in attrs.items():
            setattr(task, field, value)

        try:
            task.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        attrs["progress_percentage"] = task.progress_percentage
        attrs["status"] = task.status
        # FO-114: mirror milestone date fill / both-or-neither normalization.
        if "planned_start" in attrs or task.planned_start is not None:
            attrs["planned_start"] = task.planned_start
        if "planned_end" in attrs or task.planned_end is not None:
            attrs["planned_end"] = task.planned_end
        if task.actual_end is not None:
            attrs["actual_end"] = task.actual_end
        return attrs


class ProjectTaskCreateSerializer(
    ProjectTaskValidationMixin, serializers.ModelSerializer
):
    class Meta:
        model = ProjectTask
        fields = (
            "id",
            "name",
            "description",
            "person_in_charge",
            "status",
            "priority",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "progress_percentage",
            "sequence",
            "is_milestone",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        project = self.context["project"]
        return self._run_task_clean(attrs, project=project)

    def create(self, validated_data):
        return create_task(
            project=self.context["project"],
            actor=self.context["request"].user,
            data=validated_data,
        )


class ProjectTaskUpdateSerializer(
    ProjectTaskValidationMixin, serializers.ModelSerializer
):
    class Meta:
        model = ProjectTask
        fields = (
            "name",
            "description",
            "person_in_charge",
            "status",
            "priority",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "progress_percentage",
            "sequence",
            "is_milestone",
        )

    def validate(self, attrs):
        merged = {}
        for field in self.Meta.fields:
            if field in attrs:
                merged[field] = attrs[field]
            else:
                merged[field] = getattr(self.instance, field)
        cleaned = self._run_task_clean(merged, instance=self.instance)
        result = dict(attrs)
        if "progress_percentage" in attrs or "status" in attrs:
            result["progress_percentage"] = cleaned["progress_percentage"]
            result["status"] = cleaned["status"]
        if "planned_start" in cleaned:
            result["planned_start"] = cleaned["planned_start"]
        if "planned_end" in cleaned:
            result["planned_end"] = cleaned["planned_end"]
        return result

    def update(self, instance, validated_data):
        return update_task(
            task=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class ProjectTaskAssignSerializer(serializers.Serializer):
    person_in_charge = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=False,
    )
    person_in_charge_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="person_in_charge",
        required=False,
        allow_null=False,
    )

    def validate(self, attrs):
        if "person_in_charge" not in attrs:
            raise serializers.ValidationError(
                {
                    "person_in_charge": (
                        "Provide person_in_charge or person_in_charge_id."
                    )
                }
            )
        return attrs

    def save(self, **kwargs):
        return assign_task(
            task=self.context["task"],
            person_in_charge=self.validated_data["person_in_charge"],
            actor=self.context["request"].user,
        )


class ProjectTaskReorderSerializer(serializers.Serializer):
    task_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )


# ---------------------------------------------------------------------------
# FO-106 Notes, Issues, Timeline
# ---------------------------------------------------------------------------


class ProjectNoteSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectNote
        fields = (
            "id",
            "tenant",
            "project",
            "title",
            "note",
            "author",
            "author_email",
            "author_name",
            "category",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_author_name(self, obj):
        author = obj.author
        if author is None:
            return None
        full_name = f"{author.first_name} {author.last_name}".strip()
        return full_name or author.email


class ProjectNoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectNote
        fields = ("id", "title", "note", "category")
        read_only_fields = ("id",)

    def create(self, validated_data):
        return create_note(
            project=self.context["project"],
            actor=self.context["request"].user,
            data=validated_data,
        )


class ProjectNoteUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectNote
        fields = ("title", "note", "category")

    def update(self, instance, validated_data):
        return update_note(
            note=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class ProjectIssueCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = ProjectIssueComment
        fields = (
            "id",
            "issue",
            "author",
            "author_email",
            "body",
            "is_internal",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "issue",
            "author",
            "author_email",
            "is_internal",
            "created_at",
            "updated_at",
        )


class ProjectIssueCommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    is_internal = serializers.BooleanField(required=False, default=True)

    def create(self, validated_data):
        return add_issue_comment(
            issue=self.context["issue"],
            body=validated_data["body"],
            is_internal=validated_data.get("is_internal", True),
            actor=self.context["request"].user,
        )


class ProjectIssueSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(
        source="owner.email", read_only=True, default=None
    )
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectIssue
        fields = (
            "id",
            "tenant",
            "project",
            "title",
            "description",
            "severity",
            "status",
            "owner",
            "owner_email",
            "due_date",
            "resolved_at",
            "comments_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_comments_count(self, obj):
        return obj.comments.filter(is_deleted=False).count()


class ProjectIssueDetailSerializer(ProjectIssueSerializer):
    comments = serializers.SerializerMethodField()

    class Meta(ProjectIssueSerializer.Meta):
        fields = ProjectIssueSerializer.Meta.fields + ("comments",)

    def get_comments(self, obj):
        comments = obj.comments.filter(is_deleted=False).select_related("author")
        return ProjectIssueCommentSerializer(comments, many=True).data


class ProjectIssueValidationMixin:
    def _run_issue_clean(self, attrs, *, instance=None, project=None):
        if instance is None:
            issue = ProjectIssue(project=project, tenant=project.tenant)
        else:
            issue = ProjectIssue.objects.select_related("project").get(pk=instance.pk)

        for field, value in attrs.items():
            setattr(issue, field, value)

        try:
            issue.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class ProjectIssueCreateSerializer(
    ProjectIssueValidationMixin, serializers.ModelSerializer
):
    class Meta:
        model = ProjectIssue
        fields = (
            "id",
            "title",
            "description",
            "severity",
            "status",
            "owner",
            "due_date",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        project = self.context["project"]
        return self._run_issue_clean(attrs, project=project)

    def create(self, validated_data):
        return create_issue(
            project=self.context["project"],
            actor=self.context["request"].user,
            data=validated_data,
        )


class ProjectIssueUpdateSerializer(
    ProjectIssueValidationMixin, serializers.ModelSerializer
):
    class Meta:
        model = ProjectIssue
        fields = (
            "title",
            "description",
            "severity",
            "status",
            "owner",
            "due_date",
        )

    def validate(self, attrs):
        merged = {}
        for field in self.Meta.fields:
            if field in attrs:
                merged[field] = attrs[field]
            else:
                merged[field] = getattr(self.instance, field)
        self._run_issue_clean(merged, instance=self.instance)
        return attrs

    def update(self, instance, validated_data):
        return update_issue(
            issue=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class ProjectTimelineEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    timestamp = serializers.DateTimeField()
    actor = serializers.DictField(allow_null=True)
    event_type = serializers.CharField()
    category = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    related_object = serializers.DictField(allow_null=True)
    icon = serializers.CharField()
    metadata = serializers.DictField()


# ---------------------------------------------------------------------------
# FO-107 Progress serializers
# ---------------------------------------------------------------------------


class ProjectProgressSnapshotSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    completion_percentage = serializers.CharField()
    included_task_count = serializers.IntegerField()
    completed_task_count = serializers.IntegerField()
    blocked_task_count = serializers.IntegerField()
    delayed_task_count = serializers.IntegerField()
    recorded_at = serializers.DateTimeField()
    source = serializers.CharField()
    triggered_by = serializers.DictField(allow_null=True)
    related_task = serializers.DictField(allow_null=True)


# ---------------------------------------------------------------------------
# FO-108 Operational link serializers
# ---------------------------------------------------------------------------


class ProjectOperationalLinkSerializer(serializers.Serializer):
    """Read serializer — wraps build_safe_summary output."""

    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    link_type = serializers.CharField()
    relationship = serializers.CharField()
    notes = serializers.CharField(allow_blank=True)
    project_task_id = serializers.UUIDField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    target_accessible = serializers.BooleanField()
    target_id = serializers.UUIDField(required=False)
    target_number = serializers.CharField(required=False, allow_null=True)
    target_title = serializers.CharField(required=False, allow_blank=True)
    target_status = serializers.CharField(required=False)
    fm_ticket_id = serializers.UUIDField(required=False, allow_null=True)
    maintenance_work_order_id = serializers.UUIDField(required=False, allow_null=True)
    inspection_id = serializers.UUIDField(required=False, allow_null=True)


class ProjectOperationalLinkCreateSerializer(serializers.Serializer):
    link_type = serializers.ChoiceField(
        choices=ProjectOperationalLink.LinkType.choices,
        required=False,
    )
    fm_ticket = serializers.UUIDField(required=False)
    maintenance_work_order = serializers.UUIDField(required=False)
    inspection = serializers.UUIDField(required=False)
    relationship = serializers.ChoiceField(
        choices=ProjectOperationalLink.Relationship.choices,
        required=False,
        default=ProjectOperationalLink.Relationship.RELATED,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    project_task = serializers.UUIDField(required=False, allow_null=True)

    def create(self, validated_data):
        from apps.fm_tickets.models import FmTicket
        from apps.inspection.models import Inspection
        from apps.maintenance.models import MaintenanceWorkOrder

        from .link_service import create_link

        project = self.context["project"]
        actor = self.context["request"].user

        fm_ticket = None
        maintenance_work_order = None
        inspection = None
        if "fm_ticket" in validated_data:
            fm_ticket = FmTicket.objects.filter(
                pk=validated_data["fm_ticket"],
                is_deleted=False,
            ).first()
            if fm_ticket is None:
                raise serializers.ValidationError(
                    {"fm_ticket": "FM ticket not found."}
                )
        if "maintenance_work_order" in validated_data:
            maintenance_work_order = MaintenanceWorkOrder.objects.filter(
                pk=validated_data["maintenance_work_order"],
                is_deleted=False,
            ).first()
            if maintenance_work_order is None:
                raise serializers.ValidationError(
                    {"maintenance_work_order": "Work order not found."}
                )
        if "inspection" in validated_data:
            inspection = Inspection.objects.filter(
                pk=validated_data["inspection"],
                is_deleted=False,
            ).first()
            if inspection is None:
                raise serializers.ValidationError(
                    {"inspection": "Inspection not found."}
                )

        project_task = None
        if validated_data.get("project_task"):
            project_task = ProjectTask.objects.filter(
                pk=validated_data["project_task"],
                project=project,
                is_deleted=False,
            ).first()
            if project_task is None:
                raise serializers.ValidationError(
                    {"project_task": "Project task not found on this project."}
                )

        return create_link(
            project=project,
            actor=actor,
            link_type=validated_data.get("link_type"),
            fm_ticket=fm_ticket,
            maintenance_work_order=maintenance_work_order,
            inspection=inspection,
            relationship=validated_data.get(
                "relationship", ProjectOperationalLink.Relationship.RELATED
            ),
            notes=validated_data.get("notes", ""),
            project_task=project_task,
        )


class ProjectOperationalLinkUpdateSerializer(serializers.Serializer):
    relationship = serializers.ChoiceField(
        choices=ProjectOperationalLink.Relationship.choices,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    project_task = serializers.UUIDField(required=False, allow_null=True)

    def update(self, instance, validated_data):
        from .link_service import update_link

        project = self.context["project"]
        data = {}
        if "relationship" in validated_data:
            data["relationship"] = validated_data["relationship"]
        if "notes" in validated_data:
            data["notes"] = validated_data["notes"]
        if "project_task" in validated_data:
            task_id = validated_data["project_task"]
            if task_id is None:
                data["project_task"] = None
            else:
                task = ProjectTask.objects.filter(
                    pk=task_id,
                    project=project,
                    is_deleted=False,
                ).first()
                if task is None:
                    raise serializers.ValidationError(
                        {"project_task": "Project task not found on this project."}
                    )
                data["project_task"] = task
        return update_link(
            link=instance,
            actor=self.context["request"].user,
            data=data,
        )


class ProjectLinkOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField(allow_null=True)
    title = serializers.CharField()
    status = serializers.CharField()
    type = serializers.CharField()

