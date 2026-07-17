import type { DashboardMetricCard } from "@/types/dashboard";

type MetricCardProps = Omit<DashboardMetricCard, "id">;

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p
        aria-label={`${label}: ${value.toLocaleString()}`}
        className="mt-3 break-words text-3xl font-semibold tracking-tight text-slate-950"
      >
        {value.toLocaleString()}
      </p>
    </article>
  );
}
