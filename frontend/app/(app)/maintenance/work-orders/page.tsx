"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceListScreen } from "@/features/maintenance/components/maintenance-list";

export default function MaintenanceWorkOrdersPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="maintenance.view">
      <AppShell>
        <MaintenanceListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
