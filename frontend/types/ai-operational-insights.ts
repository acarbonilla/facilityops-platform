export interface AIOperationalInsightsParams
  extends Record<string, string | undefined> {
  start_date?: string;
  end_date?: string;
  period?: string;
  decision?: string;
  category?: string;
  priority?: string;
}

export interface AIOperationalFilterDraft {
  dateFrom: string;
  dateTo: string;
}

export interface AIOperationalBadge {
  code: string;
  label: string;
}

export interface AIOperationalHealth {
  score: number;
  band: string;
  label: string;
  components: {
    acceptance: number;
    agreement: number;
    pending_throughput: number;
    confidence: number;
  };
  weights: {
    acceptance: number;
    agreement: number;
    pending_throughput: number;
    confidence: number;
  };
  interpretation: string;
}

export interface AIOperationalTrendMetric {
  direction: "increasing" | "stable" | "decreasing" | string;
  badge: AIOperationalBadge;
  current: number | null;
  previous: number | null;
  delta: number | null;
}

export interface AIOperationalInsight {
  code: string;
  severity: string;
  badge: AIOperationalBadge;
  title: string;
  message: string;
  metric?: string | null;
  value?: number | null;
}

export interface AIOperationalRecommendation {
  code: string;
  title: string;
  message: string;
  actionable: boolean;
  note: string;
}

export interface AIOperationalCard {
  code: string;
  label: string;
  value: string | number | boolean | null;
  display: string;
  badge: AIOperationalBadge;
}

export interface AIOperationalOverride {
  recommended: string;
  final: string;
  count: number;
  percentage: number;
}

export interface AIOperationalInsights {
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
    recommendation_count: number;
    reviewed_count: number;
    pending_review_count: number;
    acceptance_rate: number;
    modification_rate: number;
    ignore_rate: number;
    full_agreement_rate: number;
    average_confidence: number | null;
  };
  health_score: AIOperationalHealth;
  trend: {
    acceptance: AIOperationalTrendMetric;
    override: AIOperationalTrendMetric;
    confidence: AIOperationalTrendMetric;
    agreement: AIOperationalTrendMetric;
    volume: AIOperationalTrendMetric;
  };
  comparison: {
    current: {
      recommendation_count: number;
      acceptance_rate: number;
      modification_rate: number;
      full_agreement_rate: number;
      average_confidence: number | null;
      pending_review_count: number;
    };
    previous: {
      recommendation_count: number;
      acceptance_rate: number;
      modification_rate: number;
      full_agreement_rate: number;
      average_confidence: number | null;
      pending_review_count: number;
    };
  };
  insights: AIOperationalInsight[];
  recommendations: AIOperationalRecommendation[];
  cards: AIOperationalCard[];
  category_overrides: AIOperationalOverride[];
  priority_overrides: AIOperationalOverride[];
  manager_notes: {
    placeholder: boolean;
    message: string;
  };
  interpretation: {
    note: string;
    labels: Record<string, string>;
  };
}
