"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { TicketDetailScreen } from "@/features/fm-tickets/components/ticket-detail";

export default function FmTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ProtectedPermissionRoute requiredPermission="fm_tickets.view">
      <AppShell>
        <TicketDetailScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
