"use client";

import { Suspense, use } from "react";

import { ProtectedEmployeeRequesterRoute } from "@/components/auth/protected-employee-requester-route";
import { LoadingState } from "@/components/common/loading-state";
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
        <Suspense
          fallback={
            <LoadingState message="Loading request details." title="Loading request" />
          }
        >
          <MyRequestDetailScreen id={id} />
        </Suspense>
      </AppShell>
    </ProtectedEmployeeRequesterRoute>
  );
}
