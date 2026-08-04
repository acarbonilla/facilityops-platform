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


class AIOperationalBadgeSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()


class AIOperationalHealthComponentsSerializer(serializers.Serializer):
    acceptance = serializers.FloatField()
    agreement = serializers.FloatField()
    pending_throughput = serializers.FloatField()
    confidence = serializers.FloatField()


class AIOperationalHealthWeightsSerializer(serializers.Serializer):
    acceptance = serializers.FloatField()
    agreement = serializers.FloatField()
    pending_throughput = serializers.FloatField()
    confidence = serializers.FloatField()


class AIOperationalHealthSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    band = serializers.CharField()
    label = serializers.CharField()
    components = AIOperationalHealthComponentsSerializer()
    weights = AIOperationalHealthWeightsSerializer()
    interpretation = serializers.CharField()


class AIOperationalTrendMetricSerializer(serializers.Serializer):
    direction = serializers.CharField()
    badge = AIOperationalBadgeSerializer()
    current = serializers.FloatField(allow_null=True)
    previous = serializers.FloatField(allow_null=True)
    delta = serializers.FloatField(allow_null=True)


class AIOperationalTrendSerializer(serializers.Serializer):
    acceptance = AIOperationalTrendMetricSerializer()
    override = AIOperationalTrendMetricSerializer()
    confidence = AIOperationalTrendMetricSerializer()
    agreement = AIOperationalTrendMetricSerializer()
    volume = AIOperationalTrendMetricSerializer()


class AIOperationalComparisonSideSerializer(serializers.Serializer):
    recommendation_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    full_agreement_rate = serializers.FloatField()
    average_confidence = serializers.FloatField(allow_null=True)
    pending_review_count = serializers.IntegerField()


class AIOperationalComparisonSerializer(serializers.Serializer):
    current = AIOperationalComparisonSideSerializer()
    previous = AIOperationalComparisonSideSerializer()


class AIOperationalInsightSerializer(serializers.Serializer):
    code = serializers.CharField()
    severity = serializers.CharField()
    badge = AIOperationalBadgeSerializer()
    title = serializers.CharField()
    message = serializers.CharField()
    metric = serializers.CharField(allow_null=True, required=False)
    value = serializers.FloatField(allow_null=True, required=False)


class AIOperationalRecommendationSerializer(serializers.Serializer):
    code = serializers.CharField()
    title = serializers.CharField()
    message = serializers.CharField()
    actionable = serializers.BooleanField()
    note = serializers.CharField()


class AIOperationalCardSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    value = serializers.JSONField(allow_null=True)
    display = serializers.CharField()
    badge = AIOperationalBadgeSerializer()


class AIOperationalSummarySerializer(serializers.Serializer):
    recommendation_count = serializers.IntegerField()
    reviewed_count = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    ignore_rate = serializers.FloatField()
    full_agreement_rate = serializers.FloatField()
    average_confidence = serializers.FloatField(allow_null=True)


class AIOperationalThresholdsSerializer(serializers.Serializer):
    high_override_rate = serializers.FloatField()
    low_acceptance_rate = serializers.FloatField()
    high_acceptance_rate = serializers.FloatField()
    pending_review_count = serializers.IntegerField()
    low_confidence = serializers.FloatField()
    high_confidence = serializers.FloatField()
    high_volume_count = serializers.IntegerField()
    low_volume_count = serializers.IntegerField()
    trend_stable_delta = serializers.FloatField()
    health_healthy_min = serializers.IntegerField()
    health_needs_review_min = serializers.IntegerField()


class AIOperationalComparisonPeriodSerializer(serializers.Serializer):
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    inclusive = serializers.BooleanField()
    max_range_days = serializers.IntegerField()


class AIOperationalManagerNotesSerializer(serializers.Serializer):
    placeholder = serializers.BooleanField()
    message = serializers.CharField()


class AIOperationalInsightsSerializer(serializers.Serializer):
    period = AIAnalyticsPeriodSerializer()
    comparison_period = AIOperationalComparisonPeriodSerializer()
    filters = AIAnalyticsFiltersSerializer()
    thresholds = AIOperationalThresholdsSerializer()
    summary = AIOperationalSummarySerializer()
    health_score = AIOperationalHealthSerializer()
    trend = AIOperationalTrendSerializer()
    comparison = AIOperationalComparisonSerializer()
    insights = AIOperationalInsightSerializer(many=True)
    recommendations = AIOperationalRecommendationSerializer(many=True)
    cards = AIOperationalCardSerializer(many=True)
    category_overrides = AIAnalyticsOverrideSerializer(many=True)
    priority_overrides = AIAnalyticsOverrideSerializer(many=True)
    manager_notes = AIOperationalManagerNotesSerializer()
    interpretation = AIAnalyticsInterpretationSerializer()
