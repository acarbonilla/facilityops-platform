"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MyWorkDashboardScreen } from "@/features/projects/components/my-work-dashboard";

export default function MyWorkPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.view",
        "projects.manage",
        "projects.tasks.view",
      ]}
    >
      <AppShell>
        <MyWorkDashboardScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
