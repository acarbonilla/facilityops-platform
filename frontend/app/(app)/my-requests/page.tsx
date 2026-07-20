"use client";

import { ProtectedEmployeeRequesterRoute } from "@/components/auth/protected-employee-requester-route";
import { AppShell } from "@/components/layout/app-shell";
import { MyRequestListScreen } from "@/features/my-requests/components/my-request-list";

export default function MyRequestsPage() {
  return (
    <ProtectedEmployeeRequesterRoute requiredPermission="fm_tickets.view">
      <AppShell>
        <MyRequestListScreen />
      </AppShell>
    </ProtectedEmployeeRequesterRoute>
  );
}
