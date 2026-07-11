import copy

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.access_control.services import user_has_permission

from .models import (
    Inspection,
    InspectionAIAnalysis,
    InspectionAssignment,
    InspectionAttachment,
    InspectionComment,
    InspectionCorrectiveAction,
    InspectionEscalation,
    InspectionFinding,
    InspectionHistory,
    InspectionItem,
    InspectionSLA,
    InspectionStatusHistory,
)
from .services.inspection_ai_service import (
    build_inspection_ai_context,
    upsert_ai_analysis,
)
from .services.inspection_scoring_service import calculate_inspection_score
from .services.inspection_service import (
    add_inspection_attachment,
    add_inspection_comment,
    add_inspection_item,
    assign_inspection,
    cancel_inspection,
    complete_inspection,
    create_inspection,
    reopen_inspection,
    start_inspection,
    update_corrective_action_status,
    update_inspection,
    verify_inspection,
)
from .services.inspection_validation_service import validate_transition

User = get_user_model()


class InspectionValidationMixin:
    def _raise_validation_error(self, exception):
        if hasattr(exception, "message_dict"):
            raise serializers.ValidationError(exception.message_dict)
        raise serializers.ValidationError(exception.messages)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        inspection = copy.copy(self.instance) if self.instance else Inspection()

        for field, value in attrs.items():
            if field == "items":
                continue
            setattr(inspection, field, value)

        if not inspection.status:
            inspection.status = Inspection.Status.DRAFT

        if (
            not self.instance
            and request
            and not inspection.inspector_id
            and getattr(request.user, "tenant_id", None) == inspection.tenant_id
        ):
            inspection.inspector = request.user

        try:
            inspection.clean()
        except DjangoValidationError as exception:
            self._raise_validation_error(exception)
        return attrs


class WorkflowSerializerMixin:
    def _run_workflow_action(self, callback):
        try:
            return callback()
        except DjangoValidationError as exception:
            if hasattr(exception, "message_dict"):
                raise serializers.ValidationError(exception.message_dict)
            raise serializers.ValidationError(exception.messages)


class InspectionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionItem
        fields = (
            "id",
            "inspection",
            "sequence",
            "checklist_item",
            "category",
            "expected_result",
            "max_score",
            "score",
            "is_pass",
            "observation",
            "notes",
        )
        read_only_fields = ("inspection",)


class InspectionFindingSerializer(serializers.ModelSerializer):
    inspection_number = serializers.CharField(
        source="inspection.inspection_number",
        read_only=True,
    )

    class Meta:
        model = InspectionFinding
        fields = (
            "id",
            "inspection",
            "inspection_number",
            "item",
            "finding_type",
            "severity",
            "description",
            "root_cause",
            "recommendation",
            "ai_recommendation",
            "photo_path",
            "status",
            "created_at",
            "updated_at",
        )


class InspectionAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = InspectionAttachment
        fields = (
            "id",
            "inspection",
            "finding",
            "uploaded_by",
            "uploaded_by_email",
            "file_name",
            "file_path",
            "content_type",
            "size_bytes",
            "note",
            "created_at",
        )
        read_only_fields = ("inspection", "uploaded_by", "created_at")

    def create(self, validated_data):
        return add_inspection_attachment(
            inspection=self.context["inspection"],
            actor=self.context["request"].user,
            data=validated_data,
        )


class InspectionCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = InspectionComment
        fields = (
            "id",
            "inspection",
            "author",
            "author_email",
            "body",
            "is_internal",
            "created_at",
        )
        read_only_fields = ("inspection", "author", "created_at")

    def create(self, validated_data):
        return add_inspection_comment(
            inspection=self.context["inspection"],
            author=self.context["request"].user,
            body=validated_data["body"],
            is_internal=validated_data.get("is_internal", False),
        )


class InspectionAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)
    assigned_by_email = serializers.EmailField(source="assigned_by.email", read_only=True)

    class Meta:
        model = InspectionAssignment
        fields = (
            "id",
            "tenant",
            "inspection",
            "assigned_to",
            "assigned_to_email",
            "assigned_by",
            "assigned_by_email",
            "role",
            "assignment_status",
            "note",
            "assigned_at",
            "is_active",
            "unassigned_at",
        )
        read_only_fields = fields


class InspectionHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = InspectionHistory
        fields = (
            "id",
            "inspection",
            "actor",
            "actor_email",
            "action",
            "description",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class InspectionStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source="changed_by.email", read_only=True)

    class Meta:
        model = InspectionStatusHistory
        fields = (
            "id",
            "inspection",
            "from_status",
            "to_status",
            "changed_by",
            "changed_by_email",
            "changed_at",
            "action",
            "reason",
            "note",
        )
        read_only_fields = fields


class InspectionCorrectiveActionSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)
    inspection_number = serializers.CharField(
        source="inspection.inspection_number",
        read_only=True,
    )

    class Meta:
        model = InspectionCorrectiveAction
        fields = (
            "id",
            "tenant",
            "inspection",
            "inspection_number",
            "finding",
            "assigned_to",
            "assigned_to_email",
            "due_date",
            "status",
            "completion_date",
            "verification_status",
            "notes",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        actor = self.context["request"].user
        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=validated_data.get("tenant") or validated_data["inspection"].tenant,
            created_by=str(actor.id),
            updated_by=str(actor.id),
            **validated_data,
        )
        return update_corrective_action_status(corrective_action, actor=actor)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        return update_corrective_action_status(instance, actor=self.context["request"].user)


class InspectionAISerializer(serializers.ModelSerializer):
    context_preview = serializers.SerializerMethodField()

    class Meta:
        model = InspectionAIAnalysis
        fields = (
            "id",
            "inspection",
            "summary",
            "analysis",
            "recommendation_summary",
            "payload",
            "model_name",
            "source_notes",
            "generated_at",
            "context_preview",
        )
        read_only_fields = ("inspection", "generated_at", "context_preview")

    def get_context_preview(self, obj):
        return build_inspection_ai_context(inspection=obj.inspection)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        inspection = self.context["inspection"]
        request = self.context["request"]
        existing_ai_analysis = getattr(inspection, "ai_analysis", None)
        summary = (attrs.get("summary") or "").strip()
        analysis = (attrs.get("analysis") or "").strip()
        recommendation_summary = (attrs.get("recommendation_summary") or "").strip()
        model_name = (attrs.get("model_name") or "").strip() or "manual"
        payload = attrs.get("payload")

        if existing_ai_analysis and not any(
            [
                user_has_permission(request.user, "inspection.view_ai"),
                user_has_permission(request.user, "inspection.manage"),
            ]
        ):
            raise PermissionDenied(
                "You do not have permission to overwrite an existing AI analysis record."
            )

        if not any([summary, analysis, recommendation_summary]):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "At least one of summary, analysis, or recommendation summary is required."
                    ]
                }
            )

        if payload is not None and not isinstance(payload, dict):
            raise serializers.ValidationError(
                {"payload": ["Payload must be a JSON object."]}
            )

        attrs["summary"] = summary
        attrs["analysis"] = analysis
        attrs["recommendation_summary"] = recommendation_summary
        attrs["source_notes"] = (attrs.get("source_notes") or "").strip()
        attrs["model_name"] = model_name
        if payload is None:
            attrs["payload"] = {}
        return attrs

    def create(self, validated_data):
        return upsert_ai_analysis(
            inspection=self.context["inspection"],
            actor=self.context["request"].user,
            **validated_data,
        )


class InspectionSLASerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionSLA
        fields = (
            "id",
            "inspection",
            "tenant",
            "target_minutes",
            "warning_minutes",
            "due_at",
            "verification_due_at",
            "completion_met",
            "verification_met",
            "completion_breached",
            "verification_breached",
            "sla_status",
            "last_recalculated_at",
        )
        read_only_fields = fields


class InspectionEscalationSerializer(serializers.ModelSerializer):
    escalated_by_email = serializers.EmailField(source="escalated_by.email", read_only=True)
    escalated_to_email = serializers.EmailField(source="escalated_to.email", read_only=True)
    acknowledged_by_email = serializers.EmailField(
        source="acknowledged_by.email",
        read_only=True,
    )
    resolved_by_email = serializers.EmailField(source="resolved_by.email", read_only=True)

    class Meta:
        model = InspectionEscalation
        fields = (
            "id",
            "tenant",
            "inspection",
            "sla",
            "corrective_action",
            "escalated_by",
            "escalated_by_email",
            "escalated_to",
            "escalated_to_email",
            "acknowledged_by",
            "acknowledged_by_email",
            "resolved_by",
            "resolved_by_email",
            "acknowledged_at",
            "reason",
            "escalation_type",
            "level",
            "status",
            "notes",
            "is_active",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields


class InspectionListSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    building_name = serializers.CharField(source="building.name", read_only=True)
    floor_name = serializers.CharField(source="floor.name", read_only=True)
    area_name = serializers.CharField(source="area.name", read_only=True)
    inspector_email = serializers.EmailField(source="inspector.email", read_only=True)
    supervisor_email = serializers.EmailField(source="supervisor.email", read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    finding_count = serializers.IntegerField(read_only=True)
    open_corrective_action_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Inspection
        fields = (
            "id",
            "inspection_number",
            "tenant",
            "tenant_name",
            "organization",
            "organization_name",
            "department",
            "department_name",
            "building",
            "building_name",
            "floor",
            "floor_name",
            "area",
            "area_name",
            "title",
            "inspection_type",
            "five_s_category",
            "inspection_template",
            "inspector",
            "inspector_email",
            "supervisor",
            "supervisor_email",
            "status",
            "priority",
            "scheduled_date",
            "started_date",
            "completed_date",
            "score",
            "item_count",
            "finding_count",
            "open_corrective_action_count",
            "created_at",
            "updated_at",
        )


class InspectionDetailSerializer(InspectionListSerializer):
    items = InspectionItemSerializer(many=True, read_only=True)
    findings = InspectionFindingSerializer(many=True, read_only=True)
    attachments = InspectionAttachmentSerializer(many=True, read_only=True)
    comments = InspectionCommentSerializer(many=True, read_only=True)
    assignments = InspectionAssignmentSerializer(many=True, read_only=True)
    history = InspectionHistorySerializer(source="history_entries", many=True, read_only=True)
    status_history = InspectionStatusHistorySerializer(
        source="status_history_entries",
        many=True,
        read_only=True,
    )
    corrective_actions = InspectionCorrectiveActionSerializer(many=True, read_only=True)
    ai_analysis = serializers.SerializerMethodField()
    ai_analysis_exists = serializers.SerializerMethodField()
    sla = InspectionSLASerializer(source="sla_record", read_only=True)
    escalations = InspectionEscalationSerializer(many=True, read_only=True)
    calculated_score = serializers.SerializerMethodField()

    class Meta(InspectionListSerializer.Meta):
        fields = InspectionListSerializer.Meta.fields + (
            "remarks",
            "verified_date",
            "calculated_score",
            "items",
            "findings",
            "attachments",
            "comments",
            "assignments",
            "history",
            "status_history",
            "corrective_actions",
            "ai_analysis",
            "ai_analysis_exists",
            "sla",
            "escalations",
        )

    def get_calculated_score(self, obj):
        return calculate_inspection_score(obj)

    def get_ai_analysis(self, obj):
        request = self.context.get("request")
        if request and not any(
            [
                user_has_permission(request.user, "inspection.view_ai"),
                user_has_permission(request.user, "inspection.manage"),
            ]
        ):
            return None

        ai_analysis = getattr(obj, "ai_analysis", None)
        if not ai_analysis:
            return None

        return InspectionAISerializer(
            ai_analysis,
            context=self.context,
        ).data

    def get_ai_analysis_exists(self, obj):
        return bool(getattr(obj, "ai_analysis", None))


class InspectionSerializer(InspectionDetailSerializer):
    pass


class InspectionCreateSerializer(InspectionValidationMixin, serializers.ModelSerializer):
    items = InspectionItemSerializer(many=True, required=False)
    inspection_number = serializers.CharField(read_only=True)
    status = serializers.ChoiceField(choices=Inspection.Status.choices, read_only=True)
    score = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Inspection
        fields = (
            "id",
            "inspection_number",
            "tenant",
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "title",
            "inspection_type",
            "five_s_category",
            "inspection_template",
            "inspector",
            "supervisor",
            "status",
            "priority",
            "scheduled_date",
            "remarks",
            "score",
            "items",
        )

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        return create_inspection(
            actor=self.context["request"].user,
            data=validated_data,
            items_data=items_data,
        )


class InspectionUpdateSerializer(InspectionValidationMixin, serializers.ModelSerializer):
    items = InspectionItemSerializer(many=True, required=False)

    class Meta:
        model = Inspection
        fields = (
            "tenant",
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "title",
            "inspection_type",
            "five_s_category",
            "inspection_template",
            "inspector",
            "supervisor",
            "priority",
            "scheduled_date",
            "remarks",
            "items",
        )

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        return update_inspection(
            inspection=instance,
            data=validated_data,
            actor=self.context["request"].user,
            items_data=items_data,
        )


class InspectionItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionItem
        fields = (
            "sequence",
            "checklist_item",
            "category",
            "expected_result",
            "max_score",
            "score",
            "is_pass",
            "observation",
            "notes",
        )

    def create(self, validated_data):
        return add_inspection_item(
            inspection=self.context["inspection"],
            actor=self.context["request"].user,
            data=validated_data,
        )


class InspectionAssignmentActionSerializer(WorkflowSerializerMixin, serializers.Serializer):
    inspector = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs.get("inspector") and not attrs.get("supervisor"):
            raise serializers.ValidationError(
                "At least one of inspector or supervisor is required."
            )
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: assign_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                inspector=validated_data.get("inspector"),
                supervisor=validated_data.get("supervisor"),
                note=validated_data.get("note", ""),
            )
        )


class InspectionStartSerializer(WorkflowSerializerMixin, serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        validate_transition(self.context["inspection"].status, Inspection.Status.IN_PROGRESS)
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: start_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                note=validated_data.get("note", ""),
            )
        )


class InspectionCompleteSerializer(WorkflowSerializerMixin, serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        validate_transition(self.context["inspection"].status, Inspection.Status.COMPLETED)
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: complete_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                note=validated_data.get("note", ""),
            )
        )


class InspectionVerifySerializer(WorkflowSerializerMixin, serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        validate_transition(self.context["inspection"].status, Inspection.Status.VERIFIED)
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: verify_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                note=validated_data.get("note", ""),
            )
        )


class InspectionCancelSerializer(WorkflowSerializerMixin, serializers.Serializer):
    reason = serializers.CharField()
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        validate_transition(self.context["inspection"].status, Inspection.Status.CANCELLED)
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: cancel_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                reason=validated_data["reason"],
                note=validated_data.get("note", ""),
            )
        )


class InspectionReopenSerializer(WorkflowSerializerMixin, serializers.Serializer):
    reason = serializers.CharField()
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        validate_transition(self.context["inspection"].status, Inspection.Status.REOPENED)
        return attrs

    def create(self, validated_data):
        return self._run_workflow_action(
            lambda: reopen_inspection(
                inspection=self.context["inspection"],
                actor=self.context["request"].user,
                reason=validated_data["reason"],
                note=validated_data.get("note", ""),
            )
        )
