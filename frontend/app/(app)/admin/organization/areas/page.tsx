"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AreasReadScreen } from "@/components/master-data/master-data-screens";

export default function AdminOrganizationAreasPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AreasReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
