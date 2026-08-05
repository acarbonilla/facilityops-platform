export interface AIInsightsParams extends Record<string, string | undefined> {
  start_date?: string;
  end_date?: string;
  period?: string;
  decision?: string;
  category?: string;
  priority?: string;
  severity?: string;
  provider?: string;
  model?: string;
}

export interface AIInsightsPeriod {
  start_date: string;
  end_date: string;
  preset?: string | null;
  inclusive: boolean;
  max_range_days: number;
}

export interface AIInsightsFiltersEcho {
  decision?: string | null;
  category?: string | null;
  priority?: string | null;
  severity?: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface AIInsightsSummary {
  recommendation_count: number;
  reviewed_count: number;
  pending_review_count: number;
  accepted_count: number;
  modified_count: number;
  ignored_count: number;
  acceptance_rate: number;
  modification_rate: number;
  ignore_rate: number;
  category_agreement_rate: number;
  priority_agreement_rate: number;
  full_agreement_rate: number;
  average_confidence: number | null;
  category_agreement_sample_size: number;
  priority_agreement_sample_size: number;
  full_agreement_sample_size: number;
  unclassified_ticket_recommendation_count?: number;
  pending_classification_recommendation_count?: number;
  ai_ready_awaiting_classification_count?: number;
}

export interface AIInsightsDecisionCount {
  decision: string;
  label: string;
  count: number;
}

export interface AIInsightsTrendPoint {
  period: string;
  grain: string;
  accepted: number;
  modified: number;
  ignored: number;
  pending: number;
  total: number;
}

export interface AIInsightsConfidenceByDecision {
  decision: string;
  label: string;
  count: number;
  average_confidence: number | null;
}

export interface AIInsightsOverride {
  recommended: string;
  final: string;
  count: number;
  percentage: number;
}

export interface AIInsightsConfidenceBand {
  band: string;
  label: string;
  bounds: string;
  count: number;
  percentage: number;
}

export interface AIInsightsInterpretation {
  note: string;
  labels: Record<string, string>;
}

export interface AIRecommendationInsights {
  period: AIInsightsPeriod;
  filters: AIInsightsFiltersEcho;
  summary: AIInsightsSummary;
  decision_distribution: AIInsightsDecisionCount[];
  decision_trend: AIInsightsTrendPoint[];
  confidence_by_decision: AIInsightsConfidenceByDecision[];
  category_overrides: AIInsightsOverride[];
  priority_overrides: AIInsightsOverride[];
  confidence_bands: AIInsightsConfidenceBand[];
  interpretation: AIInsightsInterpretation;
}

export interface AIInsightsFilterDraft {
  dateFrom: string;
  dateTo: string;
  decision: string;
  category: string;
  priority: string;
}
