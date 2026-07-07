"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceDashboardScreen } from "@/features/maintenance/components/maintenance-dashboard";

export default function MaintenanceDashboardPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="maintenance.view">
      <AppShell>
        <MaintenanceDashboardScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
