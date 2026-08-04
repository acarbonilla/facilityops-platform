export interface AISimilarCasesParams extends Record<string, string | undefined> {
  ticket_id?: string;
  analysis_id?: string;
  start_date?: string;
  end_date?: string;
  period?: string;
  category?: string;
  priority?: string;
  status?: string;
  building?: string;
  asset?: string;
  min_similarity?: string;
  limit?: string;
  source?: string;
}

export interface AISimilarFilterDraft {
  ticketId: string;
  analysisId: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  priority: string;
  status: string;
  minSimilarity: string;
  source: string;
}

export interface AISimilarDecisionSummary {
  recommended_category?: string | null;
  recommended_priority?: string | null;
  has_findings?: boolean;
  decision_outcome?: string;
  final_category?: string | null;
  final_priority?: string | null;
  note: string;
}

export interface AISimilarCaseCard {
  source_type: string;
  case_id: string;
  reference: string;
  title: string;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  building_code?: string | null;
  asset_code?: string | null;
  ai_decision_summary?: AISimilarDecisionSummary | null;
  human_decision_summary?: AISimilarDecisionSummary | null;
}

export interface AISimilarHistoricalOutcome {
  resolved_category?: string | null;
  resolved_priority?: string | null;
  status?: string | null;
  resolution_summary: string;
  decision_outcome: string;
}

export interface AISimilarCaseMatch extends AISimilarCaseCard {
  similarity_score: number;
  reasons: string[];
  components: Record<string, number>;
  historical_outcome: AISimilarHistoricalOutcome;
  updated_at?: string | null;
}

export interface AISimilarCases {
  period: {
    start_date: string;
    end_date: string;
    preset?: string | null;
    inclusive: boolean;
    max_range_days: number;
  };
  filters: Record<string, string | number | null | undefined>;
  algorithm: {
    version: string;
    name: string;
    weights: Record<string, number>;
    note: string;
  };
  current_case: AISimilarCaseCard;
  similar_cases: AISimilarCaseMatch[];
  summary: {
    match_count: number;
    candidate_evaluated: number;
    min_similarity: number;
    top_score: number;
  };
  interpretation: {
    note: string;
    labels: Record<string, string>;
  };
  generated_at: string;
}
