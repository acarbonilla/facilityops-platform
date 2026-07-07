"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceDetailScreen } from "@/features/maintenance/components/maintenance-detail";

export default function MaintenanceWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["maintenance.view", "maintenance.work_order.view"]}
    >
      <AppShell>
        <MaintenanceDetailScreen id={id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
