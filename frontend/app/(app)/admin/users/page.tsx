"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { UserManagementScreen } from "@/features/admin/users/components/user-management-screen";

export default function AdminUsersPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="users.view">
      <AppShell>
        <UserManagementScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
