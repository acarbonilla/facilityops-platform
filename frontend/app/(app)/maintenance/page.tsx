"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceDashboardScreen } from "@/features/maintenance/components/maintenance-dashboard";

export default function MaintenanceDashboardPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["maintenance.view", "maintenance.work_order.view"]}
    >
      <AppShell>
        <MaintenanceDashboardScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
