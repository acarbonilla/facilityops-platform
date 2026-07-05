import { MetricCard } from "./metric-card";

import type { DashboardMetricCard, FoundationSummary } from "@/types/dashboard";

const FOUNDATION_METRICS: Array<Pick<DashboardMetricCard, "id" | "label">> = [
  { id: "tenants", label: "Tenants" },
  { id: "organizations", label: "Organizations" },
  { id: "departments", label: "Departments" },
  { id: "buildings", label: "Buildings" },
  { id: "floors", label: "Floors" },
  { id: "areas", label: "Areas" },
  { id: "asset_types", label: "Asset Types" },
  { id: "assets", label: "Assets" },
];

export function FoundationSummaryCards({
  summary,
}: {
  summary: FoundationSummary;
}) {
  return (
    <section aria-label="Foundation metrics" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Foundation metrics</h2>
        <p className="mt-1 text-sm text-slate-600">
          Counts are sourced from the current master data foundation only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FOUNDATION_METRICS.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={summary[metric.id]}
          />
        ))}
      </div>
    </section>
  );
}
