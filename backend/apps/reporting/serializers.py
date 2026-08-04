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


class AIAttentionPrioritySerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()


class AIAttentionSuggestedActionSerializer(serializers.Serializer):
    code = serializers.CharField()
    title = serializers.CharField()
    message = serializers.CharField()
    actionable = serializers.BooleanField()
    note = serializers.CharField()


class AIAttentionItemSerializer(serializers.Serializer):
    code = serializers.CharField()
    category = serializers.CharField()
    title = serializers.CharField()
    message = serializers.CharField()
    urgency_score = serializers.IntegerField()
    priority = AIAttentionPrioritySerializer()
    trend = serializers.CharField(allow_null=True, required=False)
    suggested_action = AIAttentionSuggestedActionSerializer()
    created_at = serializers.CharField()


class AIAttentionUrgencyComponentsSerializer(serializers.Serializer):
    pending = serializers.FloatField()
    override = serializers.FloatField()
    health_inverse = serializers.FloatField()
    trend = serializers.FloatField()
    confidence = serializers.FloatField()
    volume = serializers.FloatField()


class AIAttentionUrgencyWeightsSerializer(serializers.Serializer):
    pending = serializers.FloatField()
    override = serializers.FloatField()
    health_inverse = serializers.FloatField()
    trend = serializers.FloatField()
    confidence = serializers.FloatField()
    volume = serializers.FloatField()


class AIAttentionUrgencySerializer(serializers.Serializer):
    score = serializers.IntegerField()
    level = AIAttentionPrioritySerializer()
    components = AIAttentionUrgencyComponentsSerializer()
    weights = AIAttentionUrgencyWeightsSerializer()
    interpretation = serializers.CharField()


class AIAttentionSummarySerializer(serializers.Serializer):
    attention_count = serializers.IntegerField()
    critical_count = serializers.IntegerField()
    high_count = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    recommendation_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    operational_health_score = serializers.IntegerField()
    operational_health_band = serializers.CharField()


class AIAttentionGroupSerializer(serializers.Serializer):
    category = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    items = AIAttentionItemSerializer(many=True)


class AIAttentionThresholdsSerializer(serializers.Serializer):
    pending_review_count = serializers.IntegerField()
    high_override_rate = serializers.FloatField()
    low_acceptance_rate = serializers.FloatField()
    high_volume_count = serializers.IntegerField()
    health_needs_review_min = serializers.IntegerField()
    level_critical_min = serializers.IntegerField()
    level_high_min = serializers.IntegerField()
    level_medium_min = serializers.IntegerField()


class AIAttentionOperationalHealthSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    band = serializers.CharField()
    label = serializers.CharField()
    components = AIOperationalHealthComponentsSerializer()


class AIAttentionPendingSummarySerializer(serializers.Serializer):
    pending_review_count = serializers.IntegerField()
    recommendation_count = serializers.IntegerField()
    reviewed_count = serializers.IntegerField()


class AIAttentionRecentActivitySerializer(serializers.Serializer):
    accepted_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    ignore_rate = serializers.FloatField()
    full_agreement_rate = serializers.FloatField()
    note = serializers.CharField()


class AIAttentionCenterSerializer(serializers.Serializer):
    period = AIAnalyticsPeriodSerializer()
    comparison_period = AIOperationalComparisonPeriodSerializer()
    filters = AIAnalyticsFiltersSerializer()
    thresholds = AIAttentionThresholdsSerializer()
    summary = AIAttentionSummarySerializer()
    urgency_score = AIAttentionUrgencySerializer()
    attention_items = AIAttentionItemSerializer(many=True)
    critical_items = AIAttentionItemSerializer(many=True)
    groups = AIAttentionGroupSerializer(many=True)
    trend = AIOperationalTrendSerializer()
    operational_health = AIAttentionOperationalHealthSerializer()
    pending_review_summary = AIAttentionPendingSummarySerializer()
    recent_review_activity = AIAttentionRecentActivitySerializer()
    interpretation = AIAnalyticsInterpretationSerializer()
    generated_at = serializers.CharField()


class AISimilarCaseAlgorithmSerializer(serializers.Serializer):
    version = serializers.CharField()
    name = serializers.CharField()
    weights = serializers.DictField(child=serializers.IntegerField())
    note = serializers.CharField()


class AISimilarCaseFiltersSerializer(serializers.Serializer):
    ticket_id = serializers.CharField(allow_null=True, required=False)
    analysis_id = serializers.CharField(allow_null=True, required=False)
    category = serializers.CharField(allow_null=True, required=False)
    priority = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField(allow_null=True, required=False)
    building = serializers.CharField(allow_null=True, required=False)
    asset = serializers.CharField(allow_null=True, required=False)
    min_similarity = serializers.IntegerField()
    limit = serializers.IntegerField()
    source = serializers.CharField()


class AISimilarDecisionSummarySerializer(serializers.Serializer):
    recommended_category = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    recommended_priority = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    has_findings = serializers.BooleanField(required=False)
    decision_outcome = serializers.CharField(required=False, allow_blank=True)
    final_category = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    final_priority = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    note = serializers.CharField()


class AISimilarCaseCardSerializer(serializers.Serializer):
    source_type = serializers.CharField()
    case_id = serializers.CharField()
    reference = serializers.CharField()
    title = serializers.CharField()
    category = serializers.CharField(allow_null=True, required=False)
    priority = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField(allow_null=True, required=False)
    building_code = serializers.CharField(allow_null=True, required=False)
    asset_code = serializers.CharField(allow_null=True, required=False)
    ai_decision_summary = AISimilarDecisionSummarySerializer(
        allow_null=True, required=False
    )
    human_decision_summary = AISimilarDecisionSummarySerializer(
        allow_null=True, required=False
    )


class AISimilarHistoricalOutcomeSerializer(serializers.Serializer):
    resolved_category = serializers.CharField(allow_null=True, required=False)
    resolved_priority = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField(allow_null=True, required=False)
    resolution_summary = serializers.CharField(allow_blank=True)
    decision_outcome = serializers.CharField()


class AISimilarCaseMatchSerializer(AISimilarCaseCardSerializer):
    similarity_score = serializers.IntegerField()
    reasons = serializers.ListField(child=serializers.CharField())
    components = serializers.DictField(child=serializers.IntegerField())
    historical_outcome = AISimilarHistoricalOutcomeSerializer()
    updated_at = serializers.CharField(allow_null=True, required=False)


class AISimilarCasesSummarySerializer(serializers.Serializer):
    match_count = serializers.IntegerField()
    candidate_evaluated = serializers.IntegerField()
    min_similarity = serializers.IntegerField()
    top_score = serializers.IntegerField()


class AISimilarCasesSerializer(serializers.Serializer):
    period = AIAnalyticsPeriodSerializer()
    filters = AISimilarCaseFiltersSerializer()
    algorithm = AISimilarCaseAlgorithmSerializer()
    current_case = AISimilarCaseCardSerializer()
    similar_cases = AISimilarCaseMatchSerializer(many=True)
    summary = AISimilarCasesSummarySerializer()
    interpretation = AIAnalyticsInterpretationSerializer()
    generated_at = serializers.CharField()


class ExecutiveAIPeriodSerializer(serializers.Serializer):
    start_date = serializers.CharField(allow_null=True, required=False)
    end_date = serializers.CharField(allow_null=True, required=False)
    preset = serializers.CharField(allow_null=True, required=False)
    inclusive = serializers.BooleanField()
    max_range_days = serializers.IntegerField()
    previous_start_date = serializers.CharField(allow_null=True, required=False)
    previous_end_date = serializers.CharField(allow_null=True, required=False)


class ExecutiveAISummarySerializer(serializers.Serializer):
    completed_analyses = serializers.IntegerField()
    recommendations_generated = serializers.IntegerField()
    reviewed_count = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    modified_count = serializers.IntegerField()
    ignored_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    modification_rate = serializers.FloatField()
    ignore_rate = serializers.FloatField()
    override_rate = serializers.FloatField()
    category_agreement_rate = serializers.FloatField()
    priority_agreement_rate = serializers.FloatField()
    full_agreement_rate = serializers.FloatField()
    average_confidence = serializers.FloatField(allow_null=True, required=False)
    operational_health_score = serializers.IntegerField()
    operational_health_band = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    operational_health_label = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    attention_urgency_score = serializers.IntegerField()
    attention_urgency_level = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    attention_urgency_label = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    critical_attention_count = serializers.IntegerField()
    high_attention_count = serializers.IntegerField()


class ExecutiveAIExecutiveSummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    headline = serializers.CharField()
    details = serializers.ListField(child=serializers.CharField())
    positive_trend = serializers.CharField(allow_null=True, required=False)
    primary_concern = serializers.CharField(allow_null=True, required=False)
    recommended_review_area = serializers.CharField(
        allow_null=True, required=False
    )


class ExecutiveAITrendEntrySerializer(serializers.Serializer):
    direction = serializers.CharField()
    label = serializers.CharField()
    current = serializers.FloatField(allow_null=True, required=False)
    previous = serializers.FloatField(allow_null=True, required=False)
    delta = serializers.FloatField(allow_null=True, required=False)


class ExecutiveAIPeriodComparisonSerializer(serializers.Serializer):
    recommendation_volume = ExecutiveAITrendEntrySerializer()
    acceptance_rate = ExecutiveAITrendEntrySerializer()
    modification_rate = ExecutiveAITrendEntrySerializer()
    ignore_rate = ExecutiveAITrendEntrySerializer()
    category_agreement_rate = ExecutiveAITrendEntrySerializer()
    priority_agreement_rate = ExecutiveAITrendEntrySerializer()
    full_agreement_rate = ExecutiveAITrendEntrySerializer()
    average_confidence = ExecutiveAITrendEntrySerializer()
    operational_health_score = ExecutiveAITrendEntrySerializer()
    attention_urgency_score = ExecutiveAITrendEntrySerializer()
    pending_review_count = ExecutiveAITrendEntrySerializer()
    stable_tolerance = serializers.DictField()


class ExecutiveAIAttentionItemSerializer(serializers.Serializer):
    code = serializers.CharField(allow_null=True, required=False)
    title = serializers.CharField(allow_null=True, required=False)
    message = serializers.CharField(allow_null=True, required=False)
    urgency_score = serializers.IntegerField(allow_null=True, required=False)
    priority = serializers.DictField(required=False)
    suggested_action = serializers.DictField(required=False)


class ExecutiveAIAttentionSummarySerializer(serializers.Serializer):
    attention_count = serializers.IntegerField()
    critical_count = serializers.IntegerField()
    high_count = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    urgency_score = serializers.IntegerField()
    urgency_level = serializers.DictField()
    top_attention_items = ExecutiveAIAttentionItemSerializer(many=True)
    suggested_actions = serializers.ListField(child=serializers.DictField())


class ExecutiveAIOperationalHealthSerializer(serializers.Serializer):
    score = serializers.IntegerField(allow_null=True, required=False)
    band = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    label = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    components = serializers.DictField()


class ExecutiveAIInsightSerializer(serializers.Serializer):
    code = serializers.CharField(allow_null=True, required=False)
    severity = serializers.CharField(allow_null=True, required=False)
    title = serializers.CharField(allow_null=True, required=False)
    message = serializers.CharField(allow_null=True, required=False)


class ExecutiveAIKnowledgeSerializer(serializers.Serializer):
    status = serializers.CharField()
    available = serializers.BooleanField()
    reason = serializers.CharField()
    endpoint = serializers.CharField()
    algorithm = serializers.DictField()
    corpus_signals = serializers.DictField()
    search_usage = serializers.JSONField(allow_null=True, required=False)
    source_distribution = serializers.JSONField(allow_null=True, required=False)
    advisory_note = serializers.CharField()


class ExecutiveAIDashboardSerializer(serializers.Serializer):
    period = ExecutiveAIPeriodSerializer()
    filters = AIAnalyticsFiltersSerializer()
    summary = ExecutiveAISummarySerializer()
    executive_summary = ExecutiveAIExecutiveSummarySerializer()
    period_comparison = ExecutiveAIPeriodComparisonSerializer()
    decision_distribution = AIAnalyticsDecisionCountSerializer(many=True)
    decision_trend = AIAnalyticsTrendPointSerializer(many=True)
    confidence_by_decision = AIAnalyticsConfidenceByDecisionSerializer(many=True)
    confidence_bands = AIAnalyticsConfidenceBandSerializer(many=True)
    top_category_overrides = AIAnalyticsOverrideSerializer(many=True)
    top_priority_overrides = AIAnalyticsOverrideSerializer(many=True)
    attention_summary = ExecutiveAIAttentionSummarySerializer()
    operational_health = ExecutiveAIOperationalHealthSerializer()
    operational_insights = ExecutiveAIInsightSerializer(many=True)
    knowledge_summary = ExecutiveAIKnowledgeSerializer()
    interpretation = AIAnalyticsInterpretationSerializer()
    generated_at = serializers.CharField()
