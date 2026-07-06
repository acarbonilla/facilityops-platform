"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTicketComments } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";

import { SectionCard, formatDateTime, formatPersonLabel } from "./ticket-shared";

export function TicketComments({ ticketId }: { ticketId: string }) {
  const commentsQuery = useQuery({
    queryKey: fmTicketsQueryKeys.comments(ticketId),
    queryFn: () => getFmTicketComments(ticketId),
  });

  return (
    <SectionCard
      title="Comments"
      description="Read-only comment history for the selected FM ticket."
    >
      {commentsQuery.isPending ? (
        <LoadingState
          title="Loading comments"
          message="Retrieving the latest ticket comments from the backend."
        />
      ) : null}

      {!commentsQuery.isPending && commentsQuery.isError ? (
        <ErrorState
          title="Unable to load comments"
          message={getFirstQueryErrorMessage(
            [commentsQuery.error],
            "Ticket comments could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void commentsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!commentsQuery.isPending &&
      !commentsQuery.isError &&
      (commentsQuery.data?.results.length ?? 0) === 0 ? (
        <EmptyState
          title="No comments yet"
          message="This ticket does not currently have any comment records."
        />
      ) : null}

      {!commentsQuery.isPending &&
      !commentsQuery.isError &&
      (commentsQuery.data?.results.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {commentsQuery.data?.results.map((comment) => (
            <article
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={comment.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-950">
                    {formatPersonLabel(comment.author_email, "Unknown author")}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                    {formatDateTime(comment.created_at)}
                  </p>
                </div>
                {comment.is_internal ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Internal
                  </span>
                ) : null}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
