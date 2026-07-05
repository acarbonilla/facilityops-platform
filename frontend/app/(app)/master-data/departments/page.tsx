"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { DepartmentsReadScreen } from "@/components/master-data/master-data-screens";

export default function DepartmentsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <DepartmentsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
