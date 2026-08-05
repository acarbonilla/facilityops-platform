export interface ExecutiveAIDashboardParams
  extends Record<string, string | undefined> {
  start_date?: string;
  end_date?: string;
  period?: string;
  decision?: string;
  category?: string;
  priority?: string;
}

export interface ExecutiveAIFilterDraft {
  dateFrom: string;
  dateTo: string;
  decision: string;
  category: string;
  priority: string;
}

export interface ExecutiveAITrendEntry {
  direction: string;
  label: string;
  current?: number | null;
  previous?: number | null;
  delta?: number | null;
}

export interface ExecutiveAISummary {
  completed_analyses: number;
  recommendations_generated: number;
  reviewed_count: number;
  pending_review_count: number;
  accepted_count: number;
  modified_count: number;
  ignored_count: number;
  acceptance_rate: number;
  modification_rate: number;
  ignore_rate: number;
  override_rate: number;
  category_agreement_rate: number;
  priority_agreement_rate: number;
  full_agreement_rate: number;
  average_confidence?: number | null;
  operational_health_score: number;
  operational_health_band?: string | null;
  operational_health_label?: string | null;
  attention_urgency_score: number;
  attention_urgency_level?: string | null;
  attention_urgency_label?: string | null;
  critical_attention_count: number;
  high_attention_count: number;
  unclassified_ticket_recommendation_count?: number;
  pending_classification_recommendation_count?: number;
  ai_ready_awaiting_classification_count?: number;
}

export interface ExecutiveAIExecutiveSummary {
  status: string;
  label: string;
  headline: string;
  details: string[];
  positive_trend?: string | null;
  primary_concern?: string | null;
  recommended_review_area?: string | null;
}

export interface ExecutiveAIDashboard {
  period: {
    start_date?: string | null;
    end_date?: string | null;
    preset?: string | null;
    inclusive: boolean;
    max_range_days: number;
    previous_start_date?: string | null;
    previous_end_date?: string | null;
  };
  filters: Record<string, string | null | undefined>;
  summary: ExecutiveAISummary;
  executive_summary: ExecutiveAIExecutiveSummary;
  period_comparison: Record<string, ExecutiveAITrendEntry | Record<string, unknown>>;
  decision_distribution: Array<{
    decision: string;
    label: string;
    count: number;
  }>;
  decision_trend: Array<{
    period: string;
    grain: string;
    accepted: number;
    modified: number;
    ignored: number;
    pending: number;
    total: number;
  }>;
  confidence_by_decision: Array<{
    decision: string;
    label: string;
    count: number;
    average_confidence?: number | null;
  }>;
  confidence_bands: Array<{
    band: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  top_category_overrides: Array<{
    recommended: string;
    final: string;
    count: number;
    percentage: number;
  }>;
  top_priority_overrides: Array<{
    recommended: string;
    final: string;
    count: number;
    percentage: number;
  }>;
  attention_summary: {
    attention_count: number;
    critical_count: number;
    high_count: number;
    pending_review_count: number;
    urgency_score: number;
    urgency_level: Record<string, string>;
    top_attention_items: Array<{
      code?: string;
      title?: string;
      message?: string;
      urgency_score?: number;
      priority?: { code?: string; label?: string };
      suggested_action?: {
        title?: string;
        message?: string;
        actionable?: boolean;
      };
    }>;
    suggested_actions: Array<{
      title?: string;
      message?: string;
      actionable?: boolean;
    }>;
  };
  operational_health: {
    score?: number | null;
    band?: string | null;
    label?: string | null;
    components: Record<string, number>;
  };
  operational_insights: Array<{
    code?: string;
    severity?: string;
    title?: string;
    message?: string;
  }>;
  knowledge_summary: {
    status: string;
    available: boolean;
    reason: string;
    endpoint: string;
    algorithm: Record<string, string>;
    corpus_signals: Record<string, unknown>;
    search_usage?: unknown;
    source_distribution?: unknown;
    advisory_note: string;
  };
  interpretation: {
    note: string;
    labels: Record<string, string>;
  };
  generated_at: string;
}
