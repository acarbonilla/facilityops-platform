"use client";

import { EmployeeFmTicketRedirect } from "@/components/auth/protected-employee-requester-route";
import { TicketCreatePageContent } from "@/features/fm-tickets/components/ticket-form-pages";

export default function NewFmTicketPage() {
  return (
    <EmployeeFmTicketRedirect>
      <TicketCreatePageContent />
    </EmployeeFmTicketRedirect>
  );
}
