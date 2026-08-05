"use client";

import { DetailField } from "@/components/common/detail-field";
import type { FmTicketDetail } from "@/types/fm-tickets";

import { FmTicketAttachments } from "./fm-ticket-attachments";
import { FmReviewSection } from "./fm-review-section";
import { formatDateTime, formatPersonLabel } from "./ticket-shared";

export function FmReviewEmployeeReport({
  ticket,
}: {
  ticket: FmTicketDetail;
}) {
  return (
    <FmReviewSection
      step={1}
      title="Employee Report"
      description="Requester-submitted concern. Separate from Facilities operational classification."
    >
      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailField
          label="Requester"
          value={formatPersonLabel(ticket.requester_email, "Unavailable")}
        />
        <DetailField label="Organization" value={ticket.organization_name} />
        <DetailField
          label="Submitted"
          value={formatDateTime(ticket.reported_at)}
        />
        <DetailField label="Title" value={ticket.title} />
        <DetailField
          label="Description"
          value={
            <span className="whitespace-pre-wrap font-normal text-slate-700">
              {ticket.description?.trim()
                ? ticket.description
                : "No description provided"}
            </span>
          }
        />
      </dl>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-950">Submitted images</h3>
        <p className="text-sm text-slate-600">
          Images provided by the requester for Facilities review.
        </p>
        <FmTicketAttachments
          ticketId={ticket.id}
          ticketStatus={ticket.status}
          audience="internal"
        />
      </div>
    </FmReviewSection>
  );
}
