"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTicket } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";

import { TicketCommentForm } from "./ticket-comment-form";
import { TicketComments } from "./ticket-comments";
import { TicketHistory } from "./ticket-history";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TicketStatusActions } from "./ticket-status-actions";
import { TicketStatusBadge } from "./ticket-status-badge";
import {
  SectionCard,
  formatDateTime,
  formatPersonLabel,
  formatTicketLabel,
} from "./ticket-shared";

export function TicketDetailScreen({ id }: { id: string }) {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("fm_tickets.update");
  const canManage = hasPermission("fm_tickets.manage");
  const canClose = hasPermission("fm_tickets.close");
  const canComment = canUpdate || canManage;
  const canRunStatusWorkflow = canUpdate || canClose || canManage;
  const ticketQuery = useQuery({
    queryKey: fmTicketsQueryKeys.detail(id),
    queryFn: () => getFmTicket(id),
  });

  if (ticketQuery.isPending) {
    return (
      <LoadingState
        title="Loading ticket detail"
        message="Retrieving the selected FM ticket and its current read-only summary."
      />
    );
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <ErrorState
        title="Unable to load ticket"
        message={getFirstQueryErrorMessage(
          [ticketQuery.error],
          "Ticket detail could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void ticketQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const ticket = ticketQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description={`FM ticket detail for ${ticket.ticket_number}. Comments and basic status workflow are supported here, while assignment, attachments, notifications, and automation remain out of scope.`}
        eyebrow="FM Ticketing"
        title={ticket.title}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/fm-tickets"
          >
            Back to tickets
          </Link>
          {canUpdate ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/fm-tickets/${ticket.id}/edit`}
            >
              Edit ticket
            </Link>
          ) : null}
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </PageHeader>

      <SectionCard title="Ticket Summary">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Ticket number" value={ticket.ticket_number} />
          <DetailField label="Status" value={<TicketStatusBadge status={ticket.status} />} />
          <DetailField
            label="Priority"
            value={<TicketPriorityBadge priority={ticket.priority} />}
          />
          <DetailField label="Category" value={formatTicketLabel(ticket.category)} />
          <DetailField label="Source" value={formatTicketLabel(ticket.source)} />
          <DetailField
            label="Description"
            value={
              <span className="whitespace-pre-wrap font-normal text-slate-700">
                {ticket.description}
              </span>
            }
          />
        </dl>
      </SectionCard>

      <SectionCard title="Location">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Tenant" value={ticket.tenant_name} />
          <DetailField label="Organization" value={ticket.organization_name} />
          <DetailField
            label="Department"
            value={ticket.department_name || "Not assigned"}
          />
          <DetailField label="Building" value={ticket.building_name} />
          <DetailField label="Floor" value={ticket.floor_name || "Not assigned"} />
          <DetailField label="Area" value={ticket.area_name || "Not assigned"} />
          <DetailField label="Asset" value={ticket.asset_name || "Not assigned"} />
        </dl>
      </SectionCard>

      <SectionCard title="People">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField
            label="Requester"
            value={formatPersonLabel(ticket.requester_email, "Unavailable")}
          />
          <DetailField label="Assignee" value={formatPersonLabel(ticket.assignee_email)} />
        </dl>
      </SectionCard>

      <SectionCard title="Dates">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Reported at" value={formatDateTime(ticket.reported_at)} />
          <DetailField label="Due at" value={formatDateTime(ticket.due_at)} />
          <DetailField label="Resolved at" value={formatDateTime(ticket.resolved_at)} />
          <DetailField label="Closed at" value={formatDateTime(ticket.closed_at)} />
        </dl>
      </SectionCard>

      <SectionCard title="System Metadata">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField
            label="Ticket ID"
            value={<span className="font-mono text-xs">{ticket.id}</span>}
          />
          <DetailField label="Created at" value={formatDateTime(ticket.created_at)} />
          <DetailField label="Updated at" value={formatDateTime(ticket.updated_at)} />
        </dl>
      </SectionCard>

      {canRunStatusWorkflow ? <TicketStatusActions ticket={ticket} /> : null}
      {canComment ? <TicketCommentForm ticketId={ticket.id} /> : null}
      <TicketComments ticketId={ticket.id} />
      <TicketHistory ticketId={ticket.id} />
    </div>
  );
}
