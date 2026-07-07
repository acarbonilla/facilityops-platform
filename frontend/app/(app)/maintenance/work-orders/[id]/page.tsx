"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceDetailScreen } from "@/features/maintenance/components/maintenance-detail";

export default function MaintenanceWorkOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ProtectedPermissionRoute requiredPermission="maintenance.view">
      <AppShell>
        <MaintenanceDetailScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
