import type {
  AIMonitoringHealthBadge,
  AIMonitoringOverview,
  AIMonitoringRuntime,
} from "@/types/ai-monitoring";

export const AI_MONITORING_PERMISSION = "settings.manage";

export const AI_MONITORING_DISCLAIMER =
  "AI production monitoring is informational only. It never runs analysis, modifies tickets, remediates failures automatically, or exposes API keys, prompt text, or identities.";

export function monitoringHealthBadgeClass(status?: string | null): string {
  switch (status) {
    case "healthy":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "critical":
      return "border-rose-300 bg-rose-50 text-rose-950";
    case "unavailable":
      return "border-slate-400 bg-slate-100 text-slate-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function formatMonitoringRate(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDurationMs(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

export function summarizeMonitoringHealth(
  health?: AIMonitoringHealthBadge | null,
): string {
  if (!health) {
    return "Health unavailable";
  }
  return `${health.status_label} (${health.status})`;
}

export function summarizeRuntime(runtime?: AIMonitoringRuntime | null): string {
  if (!runtime) {
    return "No runtime metrics loaded.";
  }
  return `Success ${formatMonitoringRate(runtime.success_rate)} · Failure ${formatMonitoringRate(runtime.failure_rate)} · Retry ${formatMonitoringRate(runtime.retry_rate)}`;
}

export function containsForbiddenMonitoringSecrets(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? {}).toLowerCase();
  const forbidden = [
    '"gemini_api_key"',
    '"api_key":',
    '"prompt_text"',
    '"raw_response":',
    '"description":',
    "begin private",
    "traceback",
  ];
  return forbidden.some((token) => serialized.includes(token));
}

export function overviewScreenReaderSummary(
  data?: AIMonitoringOverview | null,
): string {
  if (!data) {
    return "AI monitoring data is not loaded.";
  }
  return [
    `Overall health ${data.health.overall.status_label}.`,
    `Provider ${data.provider.provider}, model ${data.provider.model}.`,
    `Queue backlog ${data.queue.backlog}.`,
    `${data.alerts.length} alert${data.alerts.length === 1 ? "" : "s"}.`,
  ].join(" ");
}
