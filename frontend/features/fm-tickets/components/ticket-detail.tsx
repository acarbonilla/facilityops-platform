"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { DetailField } from "@/components/common/detail-field";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { readAiQueuedFromSearch, readTicketCreatedFromSearch } from "@/lib/fm-tickets/create-image-staging";
import {
  FM_REVIEW_LAYOUT_DESCRIPTION,
  buildReviewGuidanceSteps,
  formatClassificationBlockReason,
  getClassificationBlockReason,
  isOperationalClassificationComplete,
} from "@/lib/fm-tickets/fm-review-experience";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";
import { getFmTicket, getFmTicketAiAnalyses } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import { resolveAiAnalysisUiStatus } from "@/lib/fm-tickets/ai-analysis-status";

import { TicketCommentForm } from "./ticket-comment-form";
import { TicketComments } from "./ticket-comments";
import { TicketAssignmentPanel } from "./ticket-assignment-panel";
import { TicketEscalationForm } from "./ticket-escalation-form";
import { TicketEscalationHistory } from "./ticket-escalation-history";
import { TicketGenerateWorkOrderPanel } from "./ticket-generate-work-order-panel";
import { TicketHistory } from "./ticket-history";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TicketSlaPanel } from "./ticket-sla-panel";
import { TicketStatusActions } from "./ticket-status-actions";
import { TicketStatusBadge } from "./ticket-status-badge";
import { TicketAiAnalysisStatusPanel } from "./ticket-ai-analysis-status";
import { TicketSubmittedSuccessBanner } from "./ticket-submitted-success-banner";
import { FmReviewEmployeeReport } from "./fm-review-employee-report";
import { FmReviewOperationalClassification } from "./fm-review-operational-classification";
import {
  FmReviewGuidanceStrip,
  FmReviewSection,
} from "./fm-review-section";
import {
  SectionCard,
  formatDateTime,
  formatPersonLabel,
} from "./ticket-shared";

export function TicketDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAiQueued = readAiQueuedFromSearch(searchParams.toString());
  const showCreated = readTicketCreatedFromSearch(searchParams.toString());
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("fm_tickets.update");
  const canManage = hasPermission("fm_tickets.manage");
  const canClose = hasPermission("fm_tickets.close");
  const canComment = canUpdate || canManage;
  const canRunStatusWorkflow = canUpdate || canClose || canManage;
  const canEscalate = canManage;
  const ticketQuery = useQuery({
    queryKey: fmTicketsQueryKeys.detail(id),
    queryFn: () => getFmTicket(id),
  });
  const analysesQuery = useQuery({
    queryKey: fmTicketsQueryKeys.aiAnalyses(id),
    queryFn: () => getFmTicketAiAnalyses(id),
    enabled: Boolean(ticketQuery.data),
  });

  if (ticketQuery.isPending) {
    return (
      <LoadingState
        title="Loading ticket detail"
        message="Retrieving the Facility Manager review workspace for this concern."
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
  const latestAnalysis = analysesQuery.data?.results?.[0];
  const aiStatus = resolveAiAnalysisUiStatus(latestAnalysis?.status);
  const classificationComplete = isOperationalClassificationComplete(ticket);
  const classificationBlock = getClassificationBlockReason(ticket);
  const guidanceSteps = buildReviewGuidanceSteps({
    classificationComplete,
    hasAiDecision: Boolean(latestAnalysis?.decision),
    aiCompleted: aiStatus === "completed",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={FM_REVIEW_LAYOUT_DESCRIPTION}
        eyebrow="FM Ticketing · Guided Review"
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

      <TicketSubmittedSuccessBanner
        showAiQueued={showAiQueued}
        showCreated={showCreated}
        ticketNumber={ticket.ticket_number}
      />

      <FmReviewGuidanceStrip steps={guidanceSteps} />

      <p className="text-sm text-slate-600" role="status">
        Ticket {ticket.ticket_number}
        {classificationBlock
          ? ` · ${formatClassificationBlockReason(classificationBlock)}`
          : " · Ready for operational workflow after review"}
      </p>

      <FmReviewEmployeeReport ticket={ticket} />

      <FmReviewSection
        step={2}
        title="AI Recommendation"
        description="Advisory findings only. Accept, modify, or ignore — then save final operational values."
      >
        <TicketAiAnalysisStatusPanel
          audience="internal"
          canReview={canUpdate}
          headingMode="embedded"
          ticketId={ticket.id}
          onApplyRecommendation={(selection) => {
            const params = new URLSearchParams({
              ai_category: selection.category,
              ai_priority: selection.priority,
            });
            router.push(`/fm-tickets/${ticket.id}/edit?${params.toString()}`);
          }}
        />
      </FmReviewSection>

      <FmReviewOperationalClassification
        canUpdate={canUpdate}
        ticket={ticket}
      />

      <FmReviewSection
        step={4}
        title="Operational Assignment"
        description="Assign technicians and review SLA after classification is complete."
      >
        {classificationBlock ? (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3"
            role="status"
          >
            <p className="text-sm text-amber-950">
              {formatClassificationBlockReason(classificationBlock)}
            </p>
          </div>
        ) : null}
        <TicketAssignmentPanel
          classificationBlocked={Boolean(classificationBlock)}
          classificationBlockedMessage={formatClassificationBlockReason(
            classificationBlock,
          )}
          embedded
          ticket={ticket}
        />
        <div className="mt-4">
          <TicketSlaPanel ticket={ticket} />
        </div>
      </FmReviewSection>

      <FmReviewSection
        step={5}
        title="Actions"
        description="Status workflow, work orders, escalation, comments, and history."
      >
        <TicketGenerateWorkOrderPanel ticket={ticket} />
        {canRunStatusWorkflow ? <TicketStatusActions ticket={ticket} /> : null}
        {canEscalate ? <TicketEscalationForm ticket={ticket} /> : null}
        <TicketEscalationHistory ticketId={ticket.id} />
        {canComment ? <TicketCommentForm ticketId={ticket.id} /> : null}
        <TicketComments ticketId={ticket.id} />
        <TicketHistory ticketId={ticket.id} />
      </FmReviewSection>

      <SectionCard title="Dates">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Reported at" value={formatDateTime(ticket.reported_at)} />
          <DetailField label="Due at" value={formatDateTime(ticket.due_at)} />
          <DetailField label="Resolved at" value={formatDateTime(ticket.resolved_at)} />
          <DetailField label="Closed at" value={formatDateTime(ticket.closed_at)} />
        </dl>
      </SectionCard>

      <SectionCard title="People & ownership">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField
            label="Requester"
            value={formatPersonLabel(ticket.requester_email, "Unavailable")}
          />
          <DetailField
            label="Assignee"
            value={formatPersonLabel(ticket.assignee_email)}
          />
          <DetailField label="Organization" value={ticket.organization_name} />
          <DetailField
            label="Department"
            value={ticket.department_name || "Not assigned"}
          />
        </dl>
      </SectionCard>

      {canManage ? (
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
      ) : null}
    </div>
  );
}
