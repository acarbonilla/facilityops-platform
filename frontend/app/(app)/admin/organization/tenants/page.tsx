"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { TenantsReadScreen } from "@/components/master-data/master-data-screens";

export default function AdminOrganizationTenantsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <TenantsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
