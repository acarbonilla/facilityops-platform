export interface AIAttentionCenterParams
  extends Record<string, string | undefined> {
  start_date?: string;
  end_date?: string;
  period?: string;
}

export interface AIAttentionFilterDraft {
  dateFrom: string;
  dateTo: string;
}

export interface AIAttentionPriority {
  code: string;
  label: string;
}

export interface AIAttentionSuggestedAction {
  code: string;
  title: string;
  message: string;
  actionable: boolean;
  note: string;
}

export interface AIAttentionItem {
  code: string;
  category: string;
  title: string;
  message: string;
  urgency_score: number;
  priority: AIAttentionPriority;
  trend?: string | null;
  suggested_action: AIAttentionSuggestedAction;
  created_at: string;
}

export interface AIAttentionUrgency {
  score: number;
  level: AIAttentionPriority;
  components: {
    pending: number;
    override: number;
    health_inverse: number;
    trend: number;
    confidence: number;
    volume: number;
  };
  weights: {
    pending: number;
    override: number;
    health_inverse: number;
    trend: number;
    confidence: number;
    volume: number;
  };
  interpretation: string;
}

export interface AIAttentionCenter {
  period: {
    start_date: string;
    end_date: string;
    preset?: string | null;
    inclusive: boolean;
    max_range_days: number;
  };
  comparison_period: {
    start_date: string;
    end_date: string;
    inclusive: boolean;
    max_range_days: number;
  };
  filters: Record<string, string | null | undefined>;
  thresholds: Record<string, number>;
  summary: {
    attention_count: number;
    critical_count: number;
    high_count: number;
    pending_review_count: number;
    recommendation_count: number;
    acceptance_rate: number;
    modification_rate: number;
    operational_health_score: number;
    operational_health_band: string;
  };
  urgency_score: AIAttentionUrgency;
  attention_items: AIAttentionItem[];
  critical_items: AIAttentionItem[];
  groups: Array<{
    category: string;
    label: string;
    count: number;
    items: AIAttentionItem[];
  }>;
  trend: Record<
    string,
    {
      direction: string;
      badge: { code: string; label: string };
      current: number | null;
      previous: number | null;
      delta: number | null;
    }
  >;
  operational_health: {
    score: number;
    band: string;
    label: string;
    components: Record<string, number>;
  };
  pending_review_summary: {
    pending_review_count: number;
    recommendation_count: number;
    reviewed_count: number;
  };
  recent_review_activity: {
    accepted_rate: number;
    modification_rate: number;
    ignore_rate: number;
    full_agreement_rate: number;
    note: string;
  };
  interpretation: {
    note: string;
    labels: Record<string, string>;
  };
  generated_at: string;
}
