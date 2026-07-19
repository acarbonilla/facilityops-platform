import copy

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .models import (
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
from .tenant_scope import has_global_fm_ticket_scope


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


class FmTicketListSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    organization_name = serializers.CharField(
        source="organization.name",
        read_only=True,
    )
    building_name = serializers.CharField(source="building.name", read_only=True)
    floor_name = serializers.CharField(source="floor.name", read_only=True)
    area_name = serializers.CharField(source="area.name", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
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

    class Meta(FmTicketListSerializer.Meta):
        fields = FmTicketListSerializer.Meta.fields + (
            "department",
            "department_name",
            "description",
            "sla",
            "escalation_history",
            "linked_work_order",
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
