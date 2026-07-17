import type {
  DashboardMetricCard,
  FoundationMetricKey,
  FoundationSummary,
} from "@/types/dashboard";

export const FOUNDATION_METRIC_DEFINITIONS: ReadonlyArray<{
  id: FoundationMetricKey;
  label: string;
}> = [
  { id: "tenants", label: "Tenants" },
  { id: "organizations", label: "Organizations" },
  { id: "departments", label: "Departments" },
  { id: "buildings", label: "Buildings" },
  { id: "floors", label: "Floors" },
  { id: "areas", label: "Areas" },
  { id: "asset_types", label: "Asset Types" },
  { id: "assets", label: "Assets" },
] as const;

export function mapFoundationMetrics(
  summary: FoundationSummary,
): DashboardMetricCard[] {
  return FOUNDATION_METRIC_DEFINITIONS.map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: summary[metric.id],
  }));
}

export function isAllZeroFoundationSummary(
  summary: Pick<FoundationSummary, FoundationMetricKey>,
): boolean {
  return FOUNDATION_METRIC_DEFINITIONS.every(
    (metric) => summary[metric.id] === 0,
  );
}
