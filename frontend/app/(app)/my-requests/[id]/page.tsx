"use client";

import { use } from "react";

import { ProtectedEmployeeRequesterRoute } from "@/components/auth/protected-employee-requester-route";
import { AppShell } from "@/components/layout/app-shell";
import { MyRequestDetailScreen } from "@/features/my-requests/components/my-request-detail";

export default function MyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedEmployeeRequesterRoute requiredPermission="fm_tickets.view">
      <AppShell>
        <MyRequestDetailScreen id={id} />
      </AppShell>
    </ProtectedEmployeeRequesterRoute>
  );
}
