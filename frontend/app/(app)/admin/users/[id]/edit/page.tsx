"use client";

import { useParams } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { UserEditScreen } from "@/features/admin/users/components/user-form-pages";

export default function AdminUserEditPage() {
  const params = useParams<{ id: string }>();

  return (
    <ProtectedPermissionRoute requiredPermission="users.update">
      <AppShell>
        <UserEditScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}