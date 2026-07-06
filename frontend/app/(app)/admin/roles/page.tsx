"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { RoleListScreen } from "@/features/admin/rbac/components/role-list";

export default function AdminRolesPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="roles.view">
      <AppShell>
        <RoleListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
