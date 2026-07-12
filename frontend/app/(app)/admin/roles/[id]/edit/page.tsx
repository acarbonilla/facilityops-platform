"use client";

import { useParams } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { RoleEditScreen } from "@/features/admin/rbac/components/role-form-pages";

export default function AdminRoleEditPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedPermissionRoute requiredPermission="roles.manage">
      <AppShell>
        <RoleEditScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
