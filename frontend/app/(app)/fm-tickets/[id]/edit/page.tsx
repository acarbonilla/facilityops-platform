"use client";

import { use } from "react";

import { TicketEditPageContent } from "@/features/fm-tickets/components/ticket-form-pages";

export default function EditFmTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TicketEditPageContent id={id} />;
}
