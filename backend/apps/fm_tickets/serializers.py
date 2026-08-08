import copy

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .models import (
    AITicketAnalysis,
    FmTicket,
    FmTicketComment,
    FmTicketEscalation,
    FmTicketHistory,
    FmTicketStatusHistory,
)
from .services import (
    add_ticket_comment,
    calculate_ticket_sla_status,
    create_ticket,
    create_ticket_escalation,
    update_ticket,
)
from .tenant_scope import (
    has_global_fm_ticket_scope,
    is_eligible_employee_requester,
)
from apps.master_data.models import Building


User = get_user_model()

TICKET_RELATION_FIELDS = (
    "tenant",
    "organization",
    "department",
    "building",
    "floor",
    "area",
    "asset",
)


class TicketValidationMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None:
            return

        is_global = has_global_fm_ticket_scope(user)
        tenant_id = getattr(user, "tenant_id", None)
        for field_name in TICKET_RELATION_FIELDS:
            field = self.fields.get(field_name)
            queryset = getattr(field, "queryset", None)
            if queryset is None:
                continue

            queryset = queryset.filter(is_active=True, is_deleted=False)
            if not is_global:
                if not tenant_id:
                    queryset = queryset.none()
                elif field_name == "tenant":
                    queryset = queryset.filter(id=tenant_id)
                else:
                    queryset = queryset.filter(tenant_id=tenant_id)
            field.queryset = queryset

        tenant_field = self.fields.get("tenant")
        if tenant_field is not None and not is_global:
            tenant_field.required = False

    def to_internal_value(self, data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if (
            self.instance is None
            and user is not None
            and not has_global_fm_ticket_scope(user)
        ):
            if not getattr(user, "tenant_id", None):
                raise PermissionDenied(
                    "Tenantless accounts cannot create FM Tickets."
                )
            if "tenant" not in data:
                data = data.copy()
                data["tenant"] = str(user.tenant_id)
        return super().to_internal_value(data)

    def _raise_validation_error(self, exception):
        if hasattr(exception, "message_dict"):
            raise serializers.ValidationError(exception.message_dict)
        raise serializers.ValidationError(exception.messages)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        user = request.user
        is_global = has_global_fm_ticket_scope(user)

        if self.instance is None:
            if is_global:
                if attrs.get("tenant") is None:
                    raise serializers.ValidationError(
                        {"tenant": "A tenant is required."}
                    )
            else:
                attrs["tenant"] = user.tenant
        elif "tenant" in attrs:
            if attrs["tenant"].id != self.instance.tenant_id:
                raise serializers.ValidationError(
                    {"tenant": "The ticket tenant cannot be changed."}
                )
            attrs["tenant"] = self.instance.tenant

        requester = self.instance.requester if self.instance else request.user
        ticket = copy.copy(self.instance) if self.instance else FmTicket(requester=requester)

        for field, value in attrs.items():
            setattr(ticket, field, value)

        if not ticket.status:
            ticket.status = FmTicket.Status.OPEN
        if not ticket.source:
            ticket.source = FmTicket.Source.WEB

        try:
            ticket.clean()
        except DjangoValidationError as exception:
            self._raise_validation_error(exception)

        return attrs


class EmployeeFmTicketListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name",
        read_only=True,
    )
    building_name = serializers.CharField(
        source="building.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    floor_name = serializers.CharField(
        source="floor.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    area_name = serializers.CharField(
        source="area.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    asset_name = serializers.CharField(
        source="asset.name",
        read_only=True,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = FmTicket
        fields = (
            "id",
            "ticket_number",
            "organization",
            "organization_name",
            "building",
            "building_name",
            "floor",
            "floor_name",
            "area",
            "area_name",
            "asset",
            "asset_name",
            "title",
            "category",
            "priority",
            "status",
            "reported_at",
        )
        read_only_fields = fields


class EmployeeFmTicketDetailSerializer(EmployeeFmTicketListSerializer):
    can_cancel = serializers.SerializerMethodField()
    can_acknowledge = serializers.SerializerMethodField()
    can_reopen = serializers.SerializerMethodField()
    closed_automatically = serializers.SerializerMethodField()

    class Meta(EmployeeFmTicketListSerializer.Meta):
        fields = EmployeeFmTicketListSerializer.Meta.fields + (
            "description",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
            "can_cancel",
            "can_acknowledge",
            "can_reopen",
            "closed_automatically",
        )

    def get_can_cancel(self, obj):
        from .requester_workflow import can_requester_cancel

        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_requester_cancel(obj, user)

    def get_can_acknowledge(self, obj):
        from .requester_workflow import can_requester_acknowledge

        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_requester_acknowledge(obj, user)

    def get_can_reopen(self, obj):
        from .requester_workflow import can_requester_reopen

        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_requester_reopen(obj, user)

    def get_closed_automatically(self, obj):
        from .auto_closure import ticket_was_automatically_closed

        return ticket_was_automatically_closed(obj)


class EmployeeRequesterReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)


class EmployeeRequesterAcknowledgeSerializer(serializers.Serializer):
    """Acknowledge has no client-controlled fields."""

    pass


class FmTicketListSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    organization_name = serializers.CharField(
        source="organization.name",
        read_only=True,
    )
    building_name = serializers.CharField(
        source="building.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    floor_name = serializers.CharField(
        source="floor.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    area_name = serializers.CharField(
        source="area.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    asset_name = serializers.CharField(
        source="asset.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    requester_email = serializers.EmailField(source="requester.email", read_only=True)
    assignee_email = serializers.EmailField(source="assignee.email", read_only=True)

    class Meta:
        model = FmTicket
        fields = (
            "id",
            "ticket_number",
            "tenant",
            "tenant_name",
            "organization",
            "organization_name",
            "building",
            "building_name",
            "floor",
            "floor_name",
            "area",
            "area_name",
            "asset",
            "asset_name",
            "title",
            "category",
            "priority",
            "status",
            "source",
            "requester",
            "requester_email",
            "assignee",
            "assignee_email",
            "reported_at",
            "due_at",
        )


class FmTicketDetailSerializer(FmTicketListSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    sla = serializers.SerializerMethodField()
    escalation_history = serializers.SerializerMethodField()
    linked_work_order = serializers.SerializerMethodField()
    linked_projects = serializers.SerializerMethodField()

    class Meta(FmTicketListSerializer.Meta):
        fields = FmTicketListSerializer.Meta.fields + (
            "department",
            "department_name",
            "description",
            "sla",
            "escalation_history",
            "linked_work_order",
            "linked_projects",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
        )

    def get_linked_work_order(self, obj):
        try:
            work_order = obj.maintenance_work_order
        except ObjectDoesNotExist:
            return None
        if work_order.is_deleted:
            return None
        return {
            "id": str(work_order.id),
            "work_order_number": work_order.work_order_number,
            "status": work_order.status,
            "title": work_order.title,
        }

    def get_linked_projects(self, obj):
        request = self.context.get("request")
        actor = getattr(request, "user", None) if request else None
        if actor is None:
            return []
        from apps.fm_tickets.tenant_scope import uses_employee_requester_scope
        from apps.projects.link_service import (
            LINK_TYPE_FM,
            reverse_project_summaries_for_target,
        )

        if uses_employee_requester_scope(actor):
            return []
        return reverse_project_summaries_for_target(actor, LINK_TYPE_FM, obj)

    def get_sla(self, obj):
        return {
            "response_due_at": obj.response_due_at,
            "resolution_due_at": obj.resolution_due_at,
            "first_responded_at": obj.first_responded_at,
            "resolved_at": obj.resolved_at,
            "response_met": obj.response_met,
            "resolution_met": obj.resolution_met,
            "sla_status": calculate_ticket_sla_status(obj),
        }

    def get_escalation_history(self, obj):
        escalations = obj.escalations.select_related(
            "escalated_by",
            "escalated_to",
            "resolved_by",
        )
        return FmTicketEscalationSerializer(escalations, many=True).data


class FmTicketCreateSerializer(TicketValidationMixin, serializers.ModelSerializer):
    requester = serializers.PrimaryKeyRelatedField(read_only=True)
    ticket_number = serializers.CharField(read_only=True)
    status = serializers.ChoiceField(
        choices=FmTicket.Status.choices,
        read_only=True,
    )
    reported_at = serializers.DateTimeField(read_only=True)
    building = serializers.PrimaryKeyRelatedField(
        queryset=Building.objects.all(),
        required=True,
        allow_null=False,
    )

    class Meta:
        model = FmTicket
        fields = (
            "id",
            "ticket_number",
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
            "category",
            "priority",
            "status",
            "source",
            "reported_at",
            "due_at",
        )

    def create(self, validated_data):
        return create_ticket(
            requester=self.context["request"].user,
            data=validated_data,
        )


class EmployeeFmTicketCreateSerializer(serializers.ModelSerializer):
    """FO-096: Employee intake accepts title + optional description only."""

    protected_fields = (
        "requester",
        "tenant",
        "organization",
        "department",
        "source",
        "priority",
        "status",
        "assignee",
        "category",
        "building",
        "floor",
        "area",
        "asset",
        "due_at",
        "response_due_at",
        "resolution_due_at",
        "first_responded_at",
        "response_met",
        "resolution_met",
        "resolved_at",
        "closed_at",
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    class Meta:
        model = FmTicket
        fields = (
            "title",
            "description",
        )

    def to_internal_value(self, data):
        protected_errors = {
            field: ["This field is controlled by the authenticated Employee account."]
            for field in self.protected_fields
            if field in data
        }
        if protected_errors:
            raise serializers.ValidationError(protected_errors)
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context["request"].user
        if not is_eligible_employee_requester(user):
            raise PermissionDenied(
                "Employee requests require an active Tenant and Organization."
            )

        title = (attrs.get("title") or "").strip()
        if not title:
            raise serializers.ValidationError(
                {"title": ["Title is required."]}
            )
        attrs["title"] = title
        attrs["description"] = (attrs.get("description") or "").strip()

        attrs.update(
            {
                "tenant": user.tenant,
                "organization": user.organization,
                "requester": user,
                "source": FmTicket.Source.WEB,
                "category": FmTicket.Category.UNCLASSIFIED,
                "priority": FmTicket.Priority.PENDING_REVIEW,
                "status": FmTicket.Status.OPEN,
                "building": None,
                "floor": None,
                "area": None,
                "asset": None,
                "department": None,
                "assignee": None,
            }
        )
        ticket = FmTicket(**attrs)
        try:
            ticket.clean()
        except DjangoValidationError as exception:
            if hasattr(exception, "message_dict"):
                raise serializers.ValidationError(exception.message_dict)
            raise serializers.ValidationError(exception.messages)
        return attrs

    def create(self, validated_data):
        requester = validated_data.pop("requester")
        return create_ticket(requester=requester, data=validated_data)


class FmTicketUpdateSerializer(TicketValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = FmTicket
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
            "category",
            "priority",
            "source",
            "due_at",
        )

    def update(self, instance, validated_data):
        return update_ticket(
            ticket=instance,
            data=validated_data,
            actor=self.context["request"].user,
        )


class FmTicketCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = FmTicketComment
        fields = (
            "id",
            "ticket",
            "author",
            "author_email",
            "body",
            "is_internal",
            "created_at",
        )
        read_only_fields = ("ticket", "author", "created_at")

    def create(self, validated_data):
        return add_ticket_comment(
            ticket=self.context["ticket"],
            author=self.context["request"].user,
            body=validated_data["body"],
            is_internal=validated_data.get("is_internal", False),
        )


class FmTicketHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = FmTicketHistory
        fields = (
            "id",
            "ticket",
            "actor",
            "actor_email",
            "action",
            "description",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class FmTicketStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
    )

    class Meta:
        model = FmTicketStatusHistory
        fields = (
            "id",
            "ticket",
            "from_status",
            "to_status",
            "changed_by",
            "changed_by_email",
            "changed_at",
            "note",
        )
        read_only_fields = fields


class EmployeeRequestOrganizationSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)


class EmployeeRequestBuildingSerializer(EmployeeRequestOrganizationSerializer):
    pass


class EmployeeRequestFloorSerializer(EmployeeRequestOrganizationSerializer):
    building_id = serializers.UUIDField(read_only=True)


class EmployeeRequestAreaSerializer(EmployeeRequestOrganizationSerializer):
    building_id = serializers.UUIDField(read_only=True)
    floor_id = serializers.UUIDField(read_only=True)


class EmployeeRequestAssetSerializer(EmployeeRequestOrganizationSerializer):
    building_id = serializers.UUIDField(read_only=True)
    floor_id = serializers.UUIDField(read_only=True, allow_null=True)
    area_id = serializers.UUIDField(read_only=True, allow_null=True)


class EmployeeRequestChoiceSerializer(serializers.Serializer):
    value = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)


class EmployeeRequestOptionsSerializer(serializers.Serializer):
    organization = EmployeeRequestOrganizationSerializer(read_only=True)
    buildings = EmployeeRequestBuildingSerializer(many=True, read_only=True)
    floors = EmployeeRequestFloorSerializer(many=True, read_only=True)
    areas = EmployeeRequestAreaSerializer(many=True, read_only=True)
    assets = EmployeeRequestAssetSerializer(many=True, read_only=True)
    categories = EmployeeRequestChoiceSerializer(many=True, read_only=True)


class FmTicketEscalationSerializer(serializers.ModelSerializer):
    escalated_by_email = serializers.EmailField(
        source="escalated_by.email",
        read_only=True,
    )
    escalated_to_email = serializers.EmailField(
        source="escalated_to.email",
        read_only=True,
    )
    resolved_by_email = serializers.EmailField(
        source="resolved_by.email",
        read_only=True,
    )

    class Meta:
        model = FmTicketEscalation
        fields = (
            "id",
            "ticket",
            "escalated_by",
            "escalated_by_email",
            "escalated_to",
            "escalated_to_email",
            "reason",
            "level",
            "created_at",
            "is_active",
            "resolved_at",
            "resolved_by",
            "resolved_by_email",
        )
        read_only_fields = fields


class FmTicketAssignSerializer(serializers.Serializer):
    assignee = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    note = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        ticket = self.context.get("ticket")
        if ticket is not None:
            self.fields["assignee"].queryset = User.objects.filter(
                is_active=True,
                tenant_id=ticket.tenant_id,
            )


class FmTicketStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FmTicket.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)


class GeneratedWorkOrderSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    work_order_number = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    source_ticket_id = serializers.SerializerMethodField()

    def get_source_ticket_id(self, obj):
        return str(obj.source_ticket_id) if obj.source_ticket_id else None


class FmTicketEscalationCreateSerializer(serializers.Serializer):
    escalated_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    reason = serializers.CharField()
    level = serializers.ChoiceField(choices=FmTicketEscalation.Level.choices)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        ticket = self.context.get("ticket")
        if ticket is not None:
            self.fields["escalated_to"].queryset = User.objects.filter(
                is_active=True,
                tenant_id=ticket.tenant_id,
            )

    def create(self, validated_data):
        return create_ticket_escalation(
            ticket=self.context["ticket"],
            escalated_by=self.context["request"].user,
            escalated_to=validated_data.get("escalated_to"),
            reason=validated_data["reason"],
            level=validated_data["level"],
        )


class AITicketAnalysisQueueSerializer(serializers.Serializer):
    """Internal queue payload: authorized attachment IDs only."""

    attachment_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=20,
    )


class AIRecommendationDecisionSerializer(serializers.Serializer):
    """FO-087 human review decision (does not mutate ticket fields)."""

    decision = serializers.ChoiceField(
        choices=("accepted", "modified", "ignored"),
    )
    final_category = serializers.ChoiceField(
        choices=FmTicket.Category.choices,
        required=False,
        allow_blank=True,
    )
    final_priority = serializers.ChoiceField(
        choices=FmTicket.Priority.choices,
        required=False,
        allow_blank=True,
    )


class AITicketAnalysisSerializer(serializers.ModelSerializer):
    attachment_ids = serializers.SerializerMethodField()
    ticket_id = serializers.UUIDField(source="ticket.id", read_only=True)
    ticket_number = serializers.CharField(
        source="ticket.ticket_number",
        read_only=True,
        allow_null=True,
    )
    result = serializers.SerializerMethodField()
    findings = serializers.SerializerMethodField()
    recommended_category = serializers.SerializerMethodField()
    recommended_priority = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()
    confidence = serializers.SerializerMethodField()
    reasoning = serializers.SerializerMethodField()
    requires_human_review = serializers.SerializerMethodField()
    decision_timestamp = serializers.DateTimeField(
        source="decision_at",
        read_only=True,
        allow_null=True,
    )
    decision_user = serializers.SerializerMethodField()
    accepted = serializers.SerializerMethodField()
    modified = serializers.SerializerMethodField()
    ignored = serializers.SerializerMethodField()
    schema_version = serializers.CharField(read_only=True)
    provider = serializers.CharField(read_only=True)
    error_code = serializers.CharField(read_only=True)
    retryable = serializers.BooleanField(read_only=True)

    class Meta:
        model = AITicketAnalysis
        fields = (
            "id",
            "ticket_id",
            "ticket_number",
            "status",
            "provider",
            "model_name",
            "model_version",
            "prompt_version",
            "schema_version",
            "queued_at",
            "started_at",
            "completed_at",
            "duration_ms",
            "result",
            "result_json",
            "findings",
            "recommended_category",
            "recommended_priority",
            "severity",
            "confidence",
            "reasoning",
            "requires_human_review",
            "decision",
            "accepted",
            "modified",
            "ignored",
            "final_category",
            "final_priority",
            "decision_timestamp",
            "decision_user",
            "error_message",
            "error_code",
            "retryable",
            "attempt_count",
            "input_image_count",
            "attachment_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_attachment_ids(self, obj):
        return [
            str(link.attachment_id)
            for link in obj.analysis_attachments.all()
        ]

    def get_result(self, obj):
        payload = obj.result_json or {}
        if not isinstance(payload, dict):
            return {}
        # Strip debug/raw keys from API responses.
        return {
            key: value
            for key, value in payload.items()
            if not str(key).startswith("_")
        }

    def _payload(self, obj) -> dict:
        payload = obj.result_json or {}
        return payload if isinstance(payload, dict) else {}

    def get_findings(self, obj):
        findings = self._payload(obj).get("findings")
        return findings if isinstance(findings, list) else []

    def get_recommended_category(self, obj):
        if obj.decision_recommended_category:
            return obj.decision_recommended_category
        value = self._payload(obj).get("recommended_category")
        return value if isinstance(value, str) else None

    def get_recommended_priority(self, obj):
        if obj.decision_recommended_priority:
            return obj.decision_recommended_priority
        value = self._payload(obj).get("recommended_priority")
        return value if isinstance(value, str) else None

    def get_severity(self, obj):
        value = self._payload(obj).get("severity")
        return value if isinstance(value, str) else None

    def get_confidence(self, obj):
        payload = self._payload(obj)
        value = payload.get("overall_confidence", payload.get("confidence"))
        if isinstance(value, (int, float)):
            return int(value)
        return None

    def get_reasoning(self, obj):
        value = self._payload(obj).get("reasoning")
        return value if isinstance(value, str) else None

    def get_requires_human_review(self, obj):
        # FO-086/087: advisory recommendations never auto-apply; always require human review.
        return True

    def get_decision_user(self, obj):
        user = obj.decision_by
        if user is None:
            return None
        return {
            "id": str(user.id),
            "email": getattr(user, "email", "") or "",
        }

    def get_accepted(self, obj):
        return obj.decision == AITicketAnalysis.Decision.ACCEPTED

    def get_modified(self, obj):
        return obj.decision == AITicketAnalysis.Decision.MODIFIED

    def get_ignored(self, obj):
        return obj.decision == AITicketAnalysis.Decision.IGNORED

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Prefer sanitized `result`; keep result_json for FO-084 compatibility but sanitized.
        data["result_json"] = data.get("result") or {}
        return data


class RequesterSafeAITicketAnalysisSerializer(serializers.ModelSerializer):
    """FO-101: audience-safe AI status for employee-only requesters.

    Exposes lifecycle status for progress UI only. Omits recommendations,
    confidence, reasoning, provider/model/prompt metadata, and result payloads.
    """

    ticket_id = serializers.UUIDField(source="ticket.id", read_only=True)
    ticket_number = serializers.CharField(
        source="ticket.ticket_number",
        read_only=True,
        allow_null=True,
    )
    attachment_ids = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()

    class Meta:
        model = AITicketAnalysis
        fields = (
            "id",
            "ticket_id",
            "ticket_number",
            "status",
            "queued_at",
            "started_at",
            "completed_at",
            "input_image_count",
            "attachment_ids",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_attachment_ids(self, obj):
        return [
            str(link.attachment_id)
            for link in obj.analysis_attachments.all()
        ]

    def get_error_message(self, obj):
        if obj.status != AITicketAnalysis.Status.FAILED:
            return ""
        return "Image analysis could not be completed. Facilities can still review your report."
