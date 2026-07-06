"use client";

import { DetailField } from "@/components/common/detail-field";
import type { FmTicketDetail } from "@/types/fm-tickets";

import { SectionCard, formatDateTime } from "./ticket-shared";
import { TicketSlaBadge } from "./ticket-sla-badge";

function formatSlaMet(value: boolean | null) {
  if (value === null) {
    return "Pending";
  }

  return value ? "Met" : "Missed";
}

export function TicketSlaPanel({ ticket }: { ticket: FmTicketDetail }) {
  return (
    <SectionCard
      title="SLA"
      description="Read-only response and resolution targets for the selected FM ticket."
    >
      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailField
          label="SLA status"
          value={<TicketSlaBadge status={ticket.sla?.sla_status} />}
        />
        <DetailField
          label="Response due at"
          value={formatDateTime(ticket.sla?.response_due_at)}
        />
        <DetailField
          label="Resolution due at"
          value={formatDateTime(ticket.sla?.resolution_due_at)}
        />
        <DetailField
          label="First responded at"
          value={formatDateTime(ticket.sla?.first_responded_at)}
        />
        <DetailField
          label="Resolved at"
          value={formatDateTime(ticket.sla?.resolved_at)}
        />
        <DetailField
          label="Response target"
          value={formatSlaMet(ticket.sla?.response_met ?? null)}
        />
        <DetailField
          label="Resolution target"
          value={formatSlaMet(ticket.sla?.resolution_met ?? null)}
        />
      </dl>
    </SectionCard>
  );
}
