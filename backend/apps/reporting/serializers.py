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
    ticket_status = serializers.CharField(allow_null=True, required=False)
    ticket_priority = serializers.CharField(allow_null=True, required=False)
    work_order_status = serializers.CharField(allow_null=True, required=False)
    work_order_priority = serializers.CharField(allow_null=True, required=False)
    inspection_status = serializers.CharField(allow_null=True, required=False)


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


class AIAnalyticsPeriodSerializer(serializers.Serializer):
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    preset = serializers.CharField(allow_null=True, required=False)
    inclusive = serializers.BooleanField()
    max_range_days = serializers.IntegerField()


class AIAnalyticsFiltersSerializer(serializers.Serializer):
    decision = serializers.CharField(allow_null=True, required=False)
    category = serializers.CharField(allow_null=True, required=False)
    priority = serializers.CharField(allow_null=True, required=False)
    severity = serializers.CharField(allow_null=True, required=False)
    provider = serializers.CharField(allow_null=True, required=False)
    model = serializers.CharField(allow_null=True, required=False)


class AIAnalyticsSummarySerializer(serializers.Serializer):
    recommendation_count = serializers.IntegerField()
    reviewed_count = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    modified_count = serializers.IntegerField()
    ignored_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    ignore_rate = serializers.FloatField()
    category_agreement_rate = serializers.FloatField()
    priority_agreement_rate = serializers.FloatField()
    full_agreement_rate = serializers.FloatField()
    average_confidence = serializers.FloatField(allow_null=True)
    category_agreement_sample_size = serializers.IntegerField()
    priority_agreement_sample_size = serializers.IntegerField()
    full_agreement_sample_size = serializers.IntegerField()


class AIAnalyticsDecisionCountSerializer(serializers.Serializer):
    decision = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class AIAnalyticsTrendPointSerializer(serializers.Serializer):
    period = serializers.CharField()
    grain = serializers.CharField()
    accepted = serializers.IntegerField()
    modified = serializers.IntegerField()
    ignored = serializers.IntegerField()
    pending = serializers.IntegerField()
    total = serializers.IntegerField()


class AIAnalyticsConfidenceByDecisionSerializer(serializers.Serializer):
    decision = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    average_confidence = serializers.FloatField(allow_null=True)


class AIAnalyticsOverrideSerializer(serializers.Serializer):
    recommended = serializers.CharField()
    final = serializers.CharField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class AIAnalyticsConfidenceBandSerializer(serializers.Serializer):
    band = serializers.CharField()
    label = serializers.CharField()
    bounds = serializers.CharField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class AIAnalyticsInterpretationSerializer(serializers.Serializer):
    note = serializers.CharField()
    labels = serializers.DictField(child=serializers.CharField())


class AIRecommendationAnalyticsSerializer(serializers.Serializer):
    period = AIAnalyticsPeriodSerializer()
    filters = AIAnalyticsFiltersSerializer()
    summary = AIAnalyticsSummarySerializer()
    decision_distribution = AIAnalyticsDecisionCountSerializer(many=True)
    decision_trend = AIAnalyticsTrendPointSerializer(many=True)
    confidence_by_decision = AIAnalyticsConfidenceByDecisionSerializer(many=True)
    category_overrides = AIAnalyticsOverrideSerializer(many=True)
    priority_overrides = AIAnalyticsOverrideSerializer(many=True)
    confidence_bands = AIAnalyticsConfidenceBandSerializer(many=True)
    interpretation = AIAnalyticsInterpretationSerializer()
