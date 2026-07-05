"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationsReadScreen } from "@/components/master-data/master-data-screens";

export default function OrganizationsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <OrganizationsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
