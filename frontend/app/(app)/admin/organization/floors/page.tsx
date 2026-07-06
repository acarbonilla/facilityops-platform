"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { FloorsReadScreen } from "@/components/master-data/master-data-screens";

export default function AdminOrganizationFloorsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <FloorsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
