"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTicketEscalations } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";

import {
  SectionCard,
  formatDateTime,
  formatPersonLabel,
  formatTicketLabel,
} from "./ticket-shared";

function formatEscalationStatus(isActive: boolean, resolvedAt: string | null) {
  if (isActive) {
    return "Active";
  }

  if (resolvedAt) {
    return "Resolved";
  }

  return "Closed";
}

export function TicketEscalationHistory({ ticketId }: { ticketId: string }) {
  const escalationQuery = useQuery({
    queryKey: fmTicketsQueryKeys.escalations(ticketId),
    queryFn: () => getFmTicketEscalations(ticketId),
  });

  return (
    <SectionCard
      title="Escalation History"
      description="Read-only escalation records for the selected FM ticket."
    >
      {escalationQuery.isPending ? (
        <LoadingState
          title="Loading escalations"
          message="Retrieving the latest escalation history for this ticket."
        />
      ) : null}

      {!escalationQuery.isPending && escalationQuery.isError ? (
        <ErrorState
          title="Unable to load escalations"
          message={getFirstQueryErrorMessage(
            [escalationQuery.error],
            "Escalation history could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void escalationQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!escalationQuery.isPending &&
      !escalationQuery.isError &&
      (escalationQuery.data?.results.length ?? 0) === 0 ? (
        <EmptyState
          title="No escalations yet"
          message="This ticket does not currently have any escalation records."
        />
      ) : null}

      {!escalationQuery.isPending &&
      !escalationQuery.isError &&
      (escalationQuery.data?.results.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {escalationQuery.data?.results.map((entry) => (
            <article
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={entry.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-950">
                    {formatTicketLabel(entry.level, "Escalation")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{entry.reason}</p>
                </div>
                <div className="text-sm text-slate-500 sm:text-right">
                  <p>{formatDateTime(entry.created_at)}</p>
                  <p className="mt-1">
                    {formatEscalationStatus(entry.is_active, entry.resolved_at)}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Escalated by
                  </dt>
                  <dd className="mt-2 text-sm text-slate-700">
                    {formatPersonLabel(entry.escalated_by_email, "System activity")}
                  </dd>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Escalated to
                  </dt>
                  <dd className="mt-2 text-sm text-slate-700">
                    {formatPersonLabel(entry.escalated_to_email, "Not assigned")}
                  </dd>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Resolved at
                  </dt>
                  <dd className="mt-2 text-sm text-slate-700">
                    {formatDateTime(entry.resolved_at)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
