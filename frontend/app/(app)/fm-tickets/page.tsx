"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { TicketListScreen } from "@/features/fm-tickets/components/ticket-list";

export default function FmTicketsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="fm_tickets.view">
      <AppShell>
        <TicketListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
