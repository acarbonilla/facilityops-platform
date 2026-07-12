"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { RoleCreateScreen } from "@/features/admin/rbac/components/role-form-pages";

export default function AdminRoleCreatePage() {
  return (
    <ProtectedPermissionRoute requiredPermission="roles.manage">
      <AppShell>
        <RoleCreateScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
