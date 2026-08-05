"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { TicketAiAnalysisStatusPanel } from "@/features/fm-tickets/components/ticket-ai-analysis-status";
import { TicketSubmittedSuccessBanner } from "@/features/fm-tickets/components/ticket-submitted-success-banner";
import { useMyRequestDetail } from "@/hooks/use-my-requests";
import { readAiQueuedFromSearch, readTicketCreatedFromSearch } from "@/lib/fm-tickets/create-image-staging";
import { resolveAiAnalysisUiStatus } from "@/lib/fm-tickets/ai-analysis-status";
import {
  buildRequesterIntakeTimeline,
  readAiNotRequestedFromSearch,
  readAiUnavailableFromSearch,
  readUploadPartialFromSearch,
} from "@/lib/my-requests/ai-first-submit";
import {
  formatRequesterCategoryLabel,
  formatRequesterDateTime,
  formatRequesterLocation,
  getClosedExplanationText,
  getCommentsGuidanceText,
  getStatusGuidanceText,
  isGenericMyRequestNotFound,
} from "@/lib/my-requests/display";
import { TicketPriorityBadge } from "@/features/fm-tickets/components/ticket-priority-badge";
import { FmTicketAttachments } from "@/features/fm-tickets/components/fm-ticket-attachments";
import { getFmTicketAiAnalyses, queueFmTicketAiAnalysis } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import { myRequestsQueryKeys } from "@/lib/my-requests/query-keys";

import { MyRequestWorkflowActions } from "./my-request-workflow-actions";
import { RequesterIntakeTimeline } from "./requester-intake-timeline";
import { RequesterStatusBadge } from "./requester-status-badge";

export function MyRequestDetailScreen({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const showAiQueued = readAiQueuedFromSearch(searchParams.toString());
  const showCreated = readTicketCreatedFromSearch(searchParams.toString());
  const showAiUnavailable = readAiUnavailableFromSearch(searchParams.toString());
  const showAiNotRequested = readAiNotRequestedFromSearch(searchParams.toString());
  const showUploadPartial = readUploadPartialFromSearch(searchParams.toString());
  const detailQuery = useMyRequestDetail(id);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueueingAi, setIsQueueingAi] = useState(false);

  async function queueAiForUploadedImages(uploadedIds: string[]) {
    if (uploadedIds.length === 0 || isQueueingAi) {
      return;
    }
    setIsQueueingAi(true);
    setQueueError(null);
    setQueueMessage(null);
    try {
      const existing = await getFmTicketAiAnalyses(id);
      const latest = existing.results?.[0];
      const status = resolveAiAnalysisUiStatus(latest?.status);
      if (status === "queued" || status === "processing") {
        setQueueMessage("AI analysis is already in progress for this request.");
        return;
      }
      await queueFmTicketAiAnalysis(id, { attachment_ids: uploadedIds });
      setQueueMessage("AI analysis queued for the uploaded photos.");
      await queryClient.invalidateQueries({
        queryKey: fmTicketsQueryKeys.aiAnalyses(id),
      });
    } catch {
      setQueueError(
        "Photos uploaded, but AI analysis could not be queued. Facilities can still review your concern.",
      );
    } finally {
      setIsQueueingAi(false);
    }
  }

  if (detailQuery.isLoading) {
    return (
      <LoadingState
        message="Loading request details."
        title="Loading request"
      />
    );
  }

  if (detailQuery.isError) {
    if (isGenericMyRequestNotFound(detailQuery.error)) {
      return (
        <EmptyState
          message="This request could not be found or is no longer available."
          title="Request not found"
        />
      );
    }

    return (
      <ErrorState
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void detailQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
        message="This request could not be loaded. Retry to refresh the details."
        title="Unable to load request"
      />
    );
  }

  const request = detailQuery.data;
  if (!request) {
    return (
      <EmptyState
        message="This request could not be found or is no longer available."
        title="Request not found"
      />
    );
  }

  return (
    <MyRequestDetailContent
      id={id}
      request={request}
      showAiQueued={showAiQueued}
      showCreated={showCreated}
      showAiUnavailable={showAiUnavailable}
      showAiNotRequested={showAiNotRequested}
      showUploadPartial={showUploadPartial}
      queueMessage={queueMessage}
      queueError={queueError}
      isQueueingAi={isQueueingAi}
      onUploadedImages={(ids) => {
        void queueAiForUploadedImages(ids);
        void queryClient.invalidateQueries({
          queryKey: myRequestsQueryKeys.myRequestDetail(id),
        });
      }}
    />
  );
}

function MyRequestDetailContent({
  id,
  request,
  showAiQueued,
  showCreated,
  showAiUnavailable,
  showAiNotRequested,
  showUploadPartial,
  queueMessage,
  queueError,
  isQueueingAi,
  onUploadedImages,
}: {
  id: string;
  request: NonNullable<ReturnType<typeof useMyRequestDetail>["data"]>;
  showAiQueued: boolean;
  showCreated: boolean;
  showAiUnavailable: boolean;
  showAiNotRequested: boolean;
  showUploadPartial: boolean;
  queueMessage: string | null;
  queueError: string | null;
  isQueueingAi: boolean;
  onUploadedImages: (ids: string[]) => void;
}) {
  const analysesQuery = useQuery({
    queryKey: fmTicketsQueryKeys.aiAnalyses(id),
    queryFn: () => getFmTicketAiAnalyses(id),
    refetchInterval: (query) => {
      const latest = query.state.data?.results?.[0];
      const status = resolveAiAnalysisUiStatus(latest?.status);
      return status === "queued" || status === "processing" ? 5000 : false;
    },
  });

  const latestStatus = (() => {
    const latest = analysesQuery.data?.results?.[0];
    if (analysesQuery.isFetched && !(analysesQuery.data?.results?.length ?? 0)) {
      return "not_requested" as const;
    }
    return resolveAiAnalysisUiStatus(latest?.status);
  })();

  const timeline = useMemo(
    () =>
      buildRequesterIntakeTimeline({
        ticketStatus: request.status,
        aiStatus: latestStatus,
        hasImages:
          showAiQueued ||
          showUploadPartial ||
          showAiUnavailable ||
          latestStatus === "queued" ||
          latestStatus === "processing" ||
          latestStatus === "completed" ||
          latestStatus === "failed",
        resolved:
          request.status === "resolved" ||
          request.status === "closed" ||
          request.status === "cancelled",
      }),
    [
      latestStatus,
      request.status,
      showAiQueued,
      showAiUnavailable,
      showUploadPartial,
    ],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description={getStatusGuidanceText(
          request.status,
          request.closed_automatically,
        )}
        eyebrow={request.ticket_number}
        title={request.title}
      >
        <Link
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          href="/my-requests"
        >
          Back to My Requests
        </Link>
      </PageHeader>

      <TicketSubmittedSuccessBanner
        showAiQueued={showAiQueued}
        showCreated={showCreated}
        showAiUnavailable={showAiUnavailable}
        showAiNotRequested={showAiNotRequested}
        showUploadPartial={showUploadPartial}
        ticketNumber={request.ticket_number}
      />

      {queueMessage ? (
        <p
          aria-live="polite"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"
          role="status"
        >
          {queueMessage}
        </p>
      ) : null}
      {queueError ? (
        <p
          aria-live="polite"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          role="status"
        >
          {queueError}
        </p>
      ) : null}
      {isQueueingAi ? (
        <p aria-live="polite" className="text-sm text-slate-600" role="status">
          Preparing AI analysis…
        </p>
      ) : null}

      <RequesterIntakeTimeline steps={timeline} />

      <TicketAiAnalysisStatusPanel audience="requester" ticketId={request.id} />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Request details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Request number" value={request.ticket_number} />
          <DetailField
            label="Status"
            value={<RequesterStatusBadge status={request.status} />}
          />
          <DetailField
            label="Category"
            value={formatRequesterCategoryLabel(request.category)}
          />
          <DetailField
            label="Priority"
            value={<TicketPriorityBadge priority={request.priority} />}
          />
          <DetailField label="Organization" value={request.organization_name} />
          <DetailField label="Building" value={request.building_name} />
          {request.floor_name ? (
            <DetailField label="Floor" value={request.floor_name} />
          ) : null}
          {request.area_name ? (
            <DetailField label="Area" value={request.area_name} />
          ) : null}
          {request.asset_name ? (
            <DetailField label="Asset" value={request.asset_name} />
          ) : null}
          <DetailField
            label="Location summary"
            value={formatRequesterLocation([
              request.building_name,
              request.floor_name,
              request.area_name,
              request.asset_name,
            ])}
          />
          <DetailField
            label="Reported date"
            value={formatRequesterDateTime(request.reported_at)}
          />
          {request.resolved_at ? (
            <DetailField
              label="Resolved date"
              value={formatRequesterDateTime(request.resolved_at)}
            />
          ) : null}
          {request.closed_at ? (
            <DetailField
              label="Closed date"
              value={formatRequesterDateTime(request.closed_at)}
            />
          ) : null}
          <DetailField
            label="Last updated"
            value={formatRequesterDateTime(request.updated_at)}
          />
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Description
        </h2>
        <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
          {request.description || "No description provided."}
        </p>
      </section>

      <MyRequestWorkflowActions request={request} />

      <FmTicketAttachments
        ticketId={request.id}
        ticketStatus={request.status}
        audience="requester"
        onUploaded={onUploadedImages}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">What happens next</h2>
        <p className="mt-2 text-sm text-slate-700">
          {getClosedExplanationText(
            request.status,
            request.closed_at,
            request.closed_automatically,
          ) ?? getStatusGuidanceText(request.status, request.closed_automatically)}
        </p>
        <p className="mt-2 text-sm text-slate-700">{getCommentsGuidanceText()}</p>
      </section>
    </div>
  );
}
