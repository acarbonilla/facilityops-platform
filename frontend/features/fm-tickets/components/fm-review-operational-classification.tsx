"use client";

import Link from "next/link";

import { DetailField } from "@/components/common/detail-field";
import {
  getBuildingFieldIndicator,
  getCategoryFieldIndicator,
  getPriorityFieldIndicator,
  isOperationalClassificationComplete,
} from "@/lib/fm-tickets/fm-review-experience";
import type { FmTicketDetail } from "@/types/fm-tickets";

import { FmReviewFieldBadge, FmReviewSection } from "./fm-review-section";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TicketStatusBadge } from "./ticket-status-badge";
import { formatTicketLabel } from "./ticket-shared";

export function FmReviewOperationalClassification({
  ticket,
  canUpdate,
}: {
  ticket: FmTicketDetail;
  canUpdate: boolean;
}) {
  const classificationComplete = isOperationalClassificationComplete(ticket);
  const categoryIndicator = getCategoryFieldIndicator(ticket.category);
  const priorityIndicator = getPriorityFieldIndicator(ticket.priority);
  const buildingIndicator = getBuildingFieldIndicator(ticket.building);

  return (
    <FmReviewSection
      step={3}
      title="Operational Classification"
      description="Final Facilities values. AI suggestions never replace these fields."
    >
      {!classificationComplete ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-amber-950">
            Classification needs review
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Set final category, priority, and building before assignment or work
            order actions.
          </p>
        </div>
      ) : (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3"
          role="status"
        >
          <p className="text-sm font-medium text-emerald-950">
            Operational classification complete
          </p>
        </div>
      )}

      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailField
          label="Category"
          value={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{formatTicketLabel(ticket.category)}</span>
              <FmReviewFieldBadge indicator={categoryIndicator} />
            </span>
          }
        />
        <DetailField
          label="Priority"
          value={
            <span className="inline-flex flex-wrap items-center gap-2">
              <TicketPriorityBadge priority={ticket.priority} />
              <FmReviewFieldBadge indicator={priorityIndicator} />
            </span>
          }
        />
        <DetailField
          label="Status"
          value={<TicketStatusBadge status={ticket.status} />}
        />
        <DetailField
          label="Building"
          value={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{ticket.building_name || "Not set"}</span>
              <FmReviewFieldBadge indicator={buildingIndicator} />
            </span>
          }
        />
        <DetailField
          label="Floor"
          value={ticket.floor_name || "Not assigned"}
        />
        <DetailField label="Area" value={ticket.area_name || "Not assigned"} />
        <DetailField
          label="Asset"
          value={ticket.asset_name || "Not assigned"}
        />
      </dl>

      {canUpdate ? (
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            href={`/fm-tickets/${ticket.id}/edit`}
          >
            Edit classification
          </Link>
        </div>
      ) : null}
    </FmReviewSection>
  );
}
