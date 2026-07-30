"use client";

import { Suspense, use } from "react";

import { EmployeeFmTicketRedirect } from "@/components/auth/protected-employee-requester-route";
import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { LoadingState } from "@/components/common/loading-state";
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
          <Suspense
            fallback={
              <LoadingState
                title="Loading ticket detail"
                message="Retrieving the selected FM ticket and its current read-only summary."
              />
            }
          >
            <TicketDetailScreen id={id} />
          </Suspense>
        </AppShell>
      </EmployeeFmTicketRedirect>
    </ProtectedPermissionRoute>
  );
}
