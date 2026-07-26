"use client";

import { use } from "react";

import { EmployeeFmTicketRedirect } from "@/components/auth/protected-employee-requester-route";
import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { TicketDetailScreen } from "@/features/fm-tickets/components/ticket-detail";

export default function FmTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedPermissionRoute requiredPermission="fm_tickets.view">
      <EmployeeFmTicketRedirect>
        <AppShell>
          <TicketDetailScreen id={id} />
        </AppShell>
      </EmployeeFmTicketRedirect>
    </ProtectedPermissionRoute>
  );
}
