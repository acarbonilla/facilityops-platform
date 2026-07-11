"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { UserCreateScreen } from "@/features/admin/users/components/user-form-pages";

export default function AdminUsersCreatePage() {
  return (
    <ProtectedPermissionRoute requiredPermission="users.create">
      <AppShell>
        <UserCreateScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}