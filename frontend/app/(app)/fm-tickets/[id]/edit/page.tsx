"use client";

import { TicketEditPageContent } from "@/features/fm-tickets/components/ticket-form-pages";

export default function EditFmTicketPage({
  params,
}: {
  params: { id: string };
}) {
  return <TicketEditPageContent id={params.id} />;
}
