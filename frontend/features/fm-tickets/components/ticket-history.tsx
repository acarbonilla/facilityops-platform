"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTicketHistory } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";

import {
  SectionCard,
  formatDateTime,
  formatPersonLabel,
  formatTicketLabel,
} from "./ticket-shared";

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "Not provided";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unavailable";
  }
}

export function TicketHistory({ ticketId }: { ticketId: string }) {
  const historyQuery = useQuery({
    queryKey: fmTicketsQueryKeys.history(ticketId),
    queryFn: () => getFmTicketHistory(ticketId),
  });

  return (
    <SectionCard
      title="History"
      description="Read-only system activity for the selected FM ticket."
    >
      {historyQuery.isPending ? (
        <LoadingState
          title="Loading history"
          message="Retrieving the latest FM ticket activity entries."
        />
      ) : null}

      {!historyQuery.isPending && historyQuery.isError ? (
        <ErrorState
          title="Unable to load history"
          message={getFirstQueryErrorMessage(
            [historyQuery.error],
            "Ticket history could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void historyQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!historyQuery.isPending &&
      !historyQuery.isError &&
      (historyQuery.data?.results.length ?? 0) === 0 ? (
        <EmptyState
          title="No history yet"
          message="This ticket does not currently have any activity history."
        />
      ) : null}

      {!historyQuery.isPending &&
      !historyQuery.isError &&
      (historyQuery.data?.results.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {historyQuery.data?.results.map((entry) => {
            const metadataEntries = Object.entries(entry.metadata ?? {});

            return (
              <article
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                key={entry.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">
                      {formatTicketLabel(entry.action, "Activity")}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{entry.description}</p>
                  </div>
                  <div className="text-sm text-slate-500 sm:text-right">
                    <p>{formatPersonLabel(entry.actor_email, "System activity")}</p>
                    <p className="mt-1">{formatDateTime(entry.created_at)}</p>
                  </div>
                </div>

                {metadataEntries.length > 0 ? (
                  <dl className="mt-4 grid gap-3 md:grid-cols-2">
                    {metadataEntries.map(([key, value]) => (
                      <div
                        className="rounded-md border border-slate-200 bg-white p-3"
                        key={key}
                      >
                        <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          {formatTicketLabel(key)}
                        </dt>
                        <dd className="mt-2 text-sm text-slate-700">
                          {formatMetadataValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </SectionCard>
  );
}
