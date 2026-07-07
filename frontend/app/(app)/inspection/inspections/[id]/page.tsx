"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { InspectionDetailScreen } from "@/features/inspection/components/inspection-detail";

export default function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["inspection.view", "inspection.manage"]}
    >
      <AppShell>
        <InspectionDetailScreen id={id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
