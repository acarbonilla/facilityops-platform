"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionListScreen } from "@/features/admin/rbac/components/permission-list";

export default function AdminPermissionsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="roles.manage">
      <AppShell>
        <PermissionListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
