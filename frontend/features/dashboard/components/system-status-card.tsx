import { formatDashboardHealthLabel } from "@/lib/dashboard/display";
import type { SystemStatus } from "@/types/dashboard";

function statusBadgeClass(status: SystemStatus): string {
  if (status.checking) {
    return "bg-slate-100 text-slate-700";
  }
  if (status.connected) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status.status === "unavailable") {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-900";
}

export function SystemStatusCard({ status }: { status: SystemStatus }) {
  const healthLabel = formatDashboardHealthLabel(status);
  const politeStatus = status.checking || status.status !== "unavailable";

  return (
    <section
      aria-label="Backend connectivity status"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Backend status</h2>
          <p
            className="mt-1 text-sm text-slate-600"
            role={politeStatus ? "status" : "alert"}
          >
            {status.message}
          </p>
        </div>
        <span
          className={[
            "inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
            statusBadgeClass(status),
          ].join(" ")}
        >
          <span className="sr-only">Connectivity: </span>
          {healthLabel}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Service
          </dt>
          <dd className="mt-1 break-words text-sm font-medium text-slate-900">
            {status.service}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Health
          </dt>
          <dd className="mt-1 break-words text-sm font-medium capitalize text-slate-900">
            {status.status}
          </dd>
        </div>
      </dl>
    </section>
  );
}
