"use client";

import { ProtectedEmployeeRequesterRoute } from "@/components/auth/protected-employee-requester-route";
import { AppShell } from "@/components/layout/app-shell";
import { MyRequestCreateScreen } from "@/features/my-requests/components/my-request-create";

export default function MyRequestNewPage() {
  return (
    <ProtectedEmployeeRequesterRoute requiredPermission="fm_tickets.create">
      <AppShell>
        <MyRequestCreateScreen />
      </AppShell>
    </ProtectedEmployeeRequesterRoute>
  );
}
