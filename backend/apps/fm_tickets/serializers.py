import copy

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import FmTicket, FmTicketComment, FmTicketHistory, FmTicketStatusHistory
from .services import add_ticket_comment, create_ticket, update_ticket


User = get_user_model()


class TicketValidationMixin:
    def _raise_validation_error(self, exception):
        if hasattr(exception, "message_dict"):
            raise serializers.ValidationError(exception.message_dict)
        raise serializers.ValidationError(exception.messages)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
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

    class Meta(FmTicketListSerializer.Meta):
        fields = FmTicketListSerializer.Meta.fields + (
            "department",
            "department_name",
            "description",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
        )


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


class FmTicketAssignSerializer(serializers.Serializer):
    assignee = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    note = serializers.CharField(required=False, allow_blank=True)


class FmTicketStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FmTicket.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
