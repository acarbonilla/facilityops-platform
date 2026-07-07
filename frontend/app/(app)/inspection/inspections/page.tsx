"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { InspectionListScreen } from "@/features/inspection/components/inspection-list";

export default function InspectionListPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["inspection.view", "inspection.manage"]}
    >
      <AppShell>
        <InspectionListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
