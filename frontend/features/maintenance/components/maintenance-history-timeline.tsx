import { EmptyState } from "@/components/common/empty-state";
import { formatDateTime } from "@/lib/maintenance/display";
import type { MaintenanceTimelineEvent } from "@/types/maintenance";

import { SectionCard } from "./maintenance-shared";

const EVENT_STYLES: Record<MaintenanceTimelineEvent["type"], string> = {
  history: "bg-slate-900",
  status: "bg-blue-700",
  assignment: "bg-amber-600",
  completion: "bg-emerald-600",
  escalation: "bg-rose-600",
};

export function MaintenanceHistoryTimeline({
  events,
}: {
  events: MaintenanceTimelineEvent[];
}) {
  return (
    <SectionCard
      title="History"
      description="Combined timeline of status changes, assignment events, escalations, and recorded backend history."
    >
      {events.length === 0 ? (
        <EmptyState
          title="No history yet"
          message="The backend has not recorded history entries for this work order."
        />
      ) : (
        <ol className="space-y-4">
          {events.map((event) => (
            <li
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              key={event.id}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-1 h-3 w-3 rounded-full",
                      EVENT_STYLES[event.type],
                    ].join(" ")}
                  />
                  <div>
                    <p className="font-semibold text-slate-950">{event.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{event.description}</p>
                    {event.metadata && Object.keys(event.metadata).length > 0 ? (
                      <dl className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <div key={`${event.id}-${key}`}>
                            <dt className="font-semibold uppercase tracking-wide">
                              {key.replace(/_/g, " ")}
                            </dt>
                            <dd className="mt-1 text-slate-700">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-sm text-slate-500">
                  <p>{event.actor}</p>
                  <p className="mt-1">{formatDateTime(event.occurred_at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
