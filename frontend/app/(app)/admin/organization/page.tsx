"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationManagementScreen } from "@/features/admin/organization/components/organization-management-screen";

export default function AdminOrganizationPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <OrganizationManagementScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
