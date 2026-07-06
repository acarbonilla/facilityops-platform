"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { BuildingsReadScreen } from "@/components/master-data/master-data-screens";

export default function AdminOrganizationBuildingsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <BuildingsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
