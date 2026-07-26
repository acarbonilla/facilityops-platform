"use client";

import { use } from "react";

import { EmployeeFmTicketRedirect } from "@/components/auth/protected-employee-requester-route";
import { TicketEditPageContent } from "@/features/fm-tickets/components/ticket-form-pages";

export default function EditFmTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <EmployeeFmTicketRedirect>
      <TicketEditPageContent id={id} />
    </EmployeeFmTicketRedirect>
  );
}
