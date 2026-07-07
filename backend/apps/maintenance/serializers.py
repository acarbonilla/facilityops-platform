import copy

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    MaintenanceAISummary,
    MaintenanceAssignment,
    MaintenanceAttachment,
    MaintenanceCompletion,
    MaintenanceEscalation,
    MaintenanceHistory,
    MaintenanceLabor,
    MaintenanceMaterial,
    MaintenanceSLA,
    MaintenanceStatusHistory,
    MaintenanceSupervisorApproval,
    MaintenanceTask,
    MaintenanceWorkOrder,
)
from .services import (
    assign_work_order,
    complete_work_order,
    create_work_order,
    update_work_order,
)
from .validators import validate_status_transition


User = get_user_model()


class WorkOrderValidationMixin:
    def _raise_validation_error(self, exception):
        if hasattr(exception, "message_dict"):
            raise serializers.ValidationError(exception.message_dict)
        raise serializers.ValidationError(exception.messages)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        requester = self.instance.requester if self.instance else request.user
        work_order = (
            copy.copy(self.instance)
            if self.instance
            else MaintenanceWorkOrder(requester=requester)
        )

        for field, value in attrs.items():
            setattr(work_order, field, value)

        if not work_order.status:
            work_order.status = MaintenanceWorkOrder.Status.OPEN

        try:
            work_order.clean()
        except DjangoValidationError as exception:
            self._raise_validation_error(exception)

        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.EmailField(
        source="assigned_to.email",
        read_only=True,
    )
    assigned_by_email = serializers.EmailField(
        source="assigned_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceAssignment
        fields = (
            "id",
            "work_order",
            "assigned_to",
            "assigned_to_email",
            "assigned_by",
            "assigned_by_email",
            "note",
            "assigned_at",
            "is_active",
            "unassigned_at",
        )
        read_only_fields = fields


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.EmailField(
        source="assigned_to.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceTask
        fields = (
            "id",
            "work_order",
            "assigned_to",
            "assigned_to_email",
            "title",
            "description",
            "sequence",
            "status",
            "completed_at",
        )
        read_only_fields = fields


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceMaterial
        fields = (
            "id",
            "work_order",
            "task",
            "name",
            "quantity",
            "unit",
            "notes",
        )
        read_only_fields = fields


class LaborSerializer(serializers.ModelSerializer):
    performed_by_email = serializers.EmailField(
        source="performed_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceLabor
        fields = (
            "id",
            "work_order",
            "task",
            "performed_by",
            "performed_by_email",
            "description",
            "hours",
            "labor_date",
        )
        read_only_fields = fields


class CompletionSerializer(serializers.ModelSerializer):
    completed_by_email = serializers.EmailField(
        source="completed_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceCompletion
        fields = (
            "id",
            "work_order",
            "completed_by",
            "completed_by_email",
            "completion_notes",
            "resolution_summary",
            "downtime_minutes",
            "follow_up_required",
            "completed_at",
        )
        read_only_fields = fields


class HistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = MaintenanceHistory
        fields = (
            "id",
            "work_order",
            "actor",
            "actor_email",
            "action",
            "description",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceStatusHistory
        fields = (
            "id",
            "work_order",
            "from_status",
            "to_status",
            "changed_by",
            "changed_by_email",
            "changed_at",
            "note",
        )
        read_only_fields = fields


class SLASerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceSLA
        fields = (
            "id",
            "work_order",
            "response_due_at",
            "resolution_due_at",
            "first_responded_at",
            "resolved_at",
            "response_met",
            "resolution_met",
            "sla_status",
        )
        read_only_fields = fields


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(
        source="uploaded_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceAttachment
        fields = (
            "id",
            "work_order",
            "uploaded_by",
            "uploaded_by_email",
            "file_name",
            "file_path",
            "content_type",
            "size_bytes",
            "note",
            "created_at",
        )
        read_only_fields = fields


class EscalationSerializer(serializers.ModelSerializer):
    escalated_by_email = serializers.EmailField(
        source="escalated_by.email",
        read_only=True,
    )
    escalated_to_email = serializers.EmailField(
        source="escalated_to.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceEscalation
        fields = (
            "id",
            "work_order",
            "escalated_by",
            "escalated_by_email",
            "escalated_to",
            "escalated_to_email",
            "reason",
            "level",
            "is_active",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields


class AISummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceAISummary
        fields = (
            "id",
            "work_order",
            "summary",
            "model_name",
            "source_notes",
            "generated_at",
        )
        read_only_fields = fields


class SupervisorApprovalSerializer(serializers.ModelSerializer):
    approved_by_email = serializers.EmailField(
        source="approved_by.email",
        read_only=True,
    )

    class Meta:
        model = MaintenanceSupervisorApproval
        fields = (
            "id",
            "work_order",
            "approved_by",
            "approved_by_email",
            "status",
            "comments",
            "approved_at",
        )
        read_only_fields = fields


class WorkOrderListSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    organization_name = serializers.CharField(
        source="organization.name",
        read_only=True,
    )
    department_name = serializers.CharField(source="department.name", read_only=True)
    building_name = serializers.CharField(source="building.name", read_only=True)
    floor_name = serializers.CharField(source="floor.name", read_only=True)
    area_name = serializers.CharField(source="area.name", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    requester_email = serializers.EmailField(source="requester.email", read_only=True)
    assignee_email = serializers.EmailField(source="assignee.email", read_only=True)
    attachments_count = serializers.IntegerField(read_only=True)
    created_by = serializers.UUIDField(read_only=True)
    updated_by = serializers.UUIDField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = MaintenanceWorkOrder
        fields = (
            "id",
            "work_order_number",
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
            "asset",
            "asset_name",
            "asset_code",
            "title",
            "priority",
            "status",
            "requester",
            "requester_email",
            "assignee",
            "assignee_email",
            "requested_at",
            "due_at",
            "attachments_count",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )


class WorkOrderSerializer(WorkOrderListSerializer):
    assignments = AssignmentSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    materials = MaterialSerializer(many=True, read_only=True)
    labor_entries = LaborSerializer(many=True, read_only=True)
    completion_record = CompletionSerializer(read_only=True)
    sla = SLASerializer(source="sla_record", read_only=True)
    status_history = StatusHistorySerializer(
        source="status_history_entries",
        many=True,
        read_only=True,
    )
    escalations = EscalationSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    ai_summary = AISummarySerializer(read_only=True)
    supervisor_approval = SupervisorApprovalSerializer(read_only=True)

    class Meta(WorkOrderListSerializer.Meta):
        fields = WorkOrderListSerializer.Meta.fields + (
            "description",
            "scheduled_start_at",
            "scheduled_end_at",
            "started_at",
            "completed_at",
            "closed_at",
            "cancellation_reason",
            "assignments",
            "tasks",
            "materials",
            "labor_entries",
            "completion_record",
            "sla",
            "status_history",
            "escalations",
            "attachments",
            "ai_summary",
            "supervisor_approval",
            "created_at",
            "updated_at",
        )


class WorkOrderCreateSerializer(WorkOrderValidationMixin, serializers.ModelSerializer):
    requester = serializers.PrimaryKeyRelatedField(read_only=True)
    work_order_number = serializers.CharField(read_only=True)
    status = serializers.ChoiceField(
        choices=MaintenanceWorkOrder.Status.choices,
        read_only=True,
    )
    requested_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = MaintenanceWorkOrder
        fields = (
            "id",
            "work_order_number",
            "tenant",
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "asset",
            "requester",
            "title",
            "description",
            "priority",
            "status",
            "requested_at",
            "scheduled_start_at",
            "scheduled_end_at",
            "due_at",
        )

    def create(self, validated_data):
        return create_work_order(
            requester=self.context["request"].user,
            data=validated_data,
        )


class WorkOrderUpdateSerializer(WorkOrderValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = MaintenanceWorkOrder
        fields = (
            "tenant",
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "asset",
            "title",
            "description",
            "priority",
            "scheduled_start_at",
            "scheduled_end_at",
            "due_at",
            "cancellation_reason",
        )

    def update(self, instance, validated_data):
        return update_work_order(
            work_order=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class WorkOrderAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    note = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        return assign_work_order(
            work_order=self.context["work_order"],
            assigned_to=validated_data["assigned_to"],
            assigned_by=self.context["request"].user,
            note=validated_data.get("note", ""),
        )


class WorkOrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=MaintenanceWorkOrder.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
    cancellation_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        work_order = self.context["work_order"]
        if (
            attrs["status"] == MaintenanceWorkOrder.Status.CANCELLED
            and not attrs.get("cancellation_reason")
        ):
            raise serializers.ValidationError(
                {"cancellation_reason": "Cancellation reason is required."}
            )
        try:
            validate_status_transition(work_order.status, attrs["status"])
        except DjangoValidationError as exception:
            if hasattr(exception, "message_dict"):
                raise serializers.ValidationError(exception.message_dict)
            raise serializers.ValidationError(exception.messages)
        return attrs


class WorkOrderCompleteSerializer(serializers.Serializer):
    completion_notes = serializers.CharField(required=False, allow_blank=True)
    resolution_summary = serializers.CharField(required=False, allow_blank=True)
    downtime_minutes = serializers.IntegerField(required=False, min_value=0)
    follow_up_required = serializers.BooleanField(required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        work_order = self.context["work_order"]
        try:
            validate_status_transition(
                work_order.status,
                MaintenanceWorkOrder.Status.COMPLETED,
            )
        except DjangoValidationError as exception:
            if hasattr(exception, "message_dict"):
                raise serializers.ValidationError(exception.message_dict)
            raise serializers.ValidationError(exception.messages)
        return attrs

    def create(self, validated_data):
        return complete_work_order(
            work_order=self.context["work_order"],
            completed_by=self.context["request"].user,
            completion_notes=validated_data.get("completion_notes", ""),
            resolution_summary=validated_data.get("resolution_summary", ""),
            downtime_minutes=validated_data.get("downtime_minutes"),
            follow_up_required=validated_data.get("follow_up_required", False),
        )
