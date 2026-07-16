from rest_framework import serializers


class ReportingSlaSummarySerializer(serializers.Serializer):
    response_met = serializers.IntegerField()
    response_missed = serializers.IntegerField()
    resolution_met = serializers.IntegerField()
    resolution_missed = serializers.IntegerField()


class TicketReportingSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    open = serializers.IntegerField()
    overdue = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    by_priority = serializers.DictField(child=serializers.IntegerField())
    by_category = serializers.DictField(child=serializers.IntegerField())
    sla = ReportingSlaSummarySerializer()


class WorkOrderReportingSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    overdue = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    by_priority = serializers.DictField(child=serializers.IntegerField())
    linked_to_ticket = serializers.IntegerField()
    standalone = serializers.IntegerField()


class InspectionReportingSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    average_score = serializers.FloatField(allow_null=True)
    scored_count = serializers.IntegerField()


class ReportingFiltersSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    building = serializers.CharField(allow_null=True, required=False)
    organization = serializers.CharField(allow_null=True, required=False)


class OperationalOverviewSerializer(serializers.Serializer):
    filters = ReportingFiltersSerializer()
    tickets = TicketReportingSummarySerializer()
    work_orders = WorkOrderReportingSummarySerializer()
    inspections = InspectionReportingSummarySerializer()


class ReportingOrganizationOptionSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()


class ReportingBuildingOptionSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    organization_id = serializers.CharField()


class ReportingFilterOptionsSerializer(serializers.Serializer):
    organizations = ReportingOrganizationOptionSerializer(many=True)
    buildings = ReportingBuildingOptionSerializer(many=True)
