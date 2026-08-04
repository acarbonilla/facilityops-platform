import type {
  AIAdminConfig,
  AIAdminFeatureFlags,
  AIAdminThresholds,
} from "@/types/ai-administration";

export const AI_ADMIN_PERMISSION = "settings.manage";

export const AI_ADMIN_DISCLAIMER =
  "AI administration governs configuration only. It never runs analysis, modifies tickets, bypasses human review, or exposes API keys or prompt text.";

export const FEATURE_FLAG_LABELS: Record<keyof AIAdminFeatureFlags, string> = {
  image_analysis: "Image Analysis",
  recommendation_engine: "Recommendation Engine",
  executive_dashboard: "Executive Dashboard",
  similar_cases: "Similar Cases",
  attention_center: "Attention Center",
  operational_insights: "Operational Insights",
};

export const THRESHOLD_LABELS: Record<keyof AIAdminThresholds, string> = {
  confidence_threshold: "Confidence threshold",
  health_warning_threshold: "Operational health warning",
  health_critical_threshold: "Operational health healthy-min",
  attention_warning_threshold: "Attention urgency warning",
  attention_critical_threshold: "Attention urgency critical",
  acceptance_healthy_rate: "Acceptance healthy rate",
  override_warning_rate: "Override warning rate",
};

export function healthBadgeClass(status?: string | null): string {
  switch (status) {
    case "healthy":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "degraded":
    case "misconfigured":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "disabled":
      return "border-slate-300 bg-slate-100 text-slate-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function formatRateAsPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(0)}%`;
}

export function containsForbiddenAdminSecrets(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? {}).toLowerCase();
  const forbidden = [
    '"gemini_api_key"',
    '"api_key":',
    '"prompt_text"',
    '"raw_response":',
    "begin private",
  ];
  return forbidden.some((token) => serialized.includes(token));
}

export function summarizeConfig(config?: AIAdminConfig | null): string {
  if (!config) {
    return "No AI administration configuration loaded.";
  }
  return `${config.provider.provider} · model ${config.provider.model || "default"} · ${
    config.provider.enabled ? "enabled" : "disabled"
  }`;
}
