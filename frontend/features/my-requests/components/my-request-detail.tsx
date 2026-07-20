"use client";

import Link from "next/link";

import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useMyRequestDetail } from "@/hooks/use-my-requests";
import {
  formatRequesterCategoryLabel,
  formatRequesterDateTime,
  formatRequesterLocation,
  getCommentsGuidanceText,
  getStatusGuidanceText,
  isGenericMyRequestNotFound,
} from "@/lib/my-requests/display";
import { TicketPriorityBadge } from "@/features/fm-tickets/components/ticket-priority-badge";

import { MyRequestWorkflowActions } from "./my-request-workflow-actions";
import { RequesterStatusBadge } from "./requester-status-badge";

export function MyRequestDetailScreen({ id }: { id: string }) {
  const detailQuery = useMyRequestDetail(id);

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
    <div className="space-y-6">
      <PageHeader
        description={getStatusGuidanceText()}
        eyebrow={request.ticket_number}
        title={request.title}
      >
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          href="/my-requests"
        >
          Back to My Requests
        </Link>
      </PageHeader>

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
          {request.description}
        </p>
      </section>

      <MyRequestWorkflowActions request={request} />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">What happens next</h2>
        <p className="mt-2 text-sm text-slate-700">{getStatusGuidanceText()}</p>
        <p className="mt-2 text-sm text-slate-700">{getCommentsGuidanceText()}</p>
      </section>
    </div>
  );
}
