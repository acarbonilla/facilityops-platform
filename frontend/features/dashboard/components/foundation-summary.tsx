import {
  FOUNDATION_METRIC_DEFINITIONS,
  isAllZeroFoundationSummary,
  mapFoundationMetrics,
} from "@/lib/dashboard/metrics";
import {
  DASHBOARD_SCOPE_SUMMARY,
  DASHBOARD_SCOPE_SUPPORTING,
  DASHBOARD_ZERO_CONTEXT,
} from "@/lib/dashboard/scope";
import type { FoundationSummary } from "@/types/dashboard";

import { MetricCard } from "./metric-card";

export function FoundationSummaryCards({
  summary,
}: {
  summary: FoundationSummary;
}) {
  const metrics = mapFoundationMetrics(summary);
  const isEmpty = isAllZeroFoundationSummary(summary);

  return (
    <section aria-label="Foundation metrics" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Foundation metrics</h2>
        <p className="mt-1 text-sm text-slate-600">{DASHBOARD_SCOPE_SUMMARY}</p>
        <p className="mt-1 text-sm text-slate-500">{DASHBOARD_SCOPE_SUPPORTING}</p>
      </div>

      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600" role="status">
          {DASHBOARD_ZERO_CONTEXT}
        </p>
      ) : null}

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <li key={metric.id}>
            <MetricCard label={metric.label} value={metric.value} />
          </li>
        ))}
      </ul>

      <p className="sr-only">
        {FOUNDATION_METRIC_DEFINITIONS.length} foundation metric cards are shown.
      </p>
    </section>
  );
}
