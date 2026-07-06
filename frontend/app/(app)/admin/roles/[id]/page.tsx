"use client";

import { useParams } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { RoleDetailScreen } from "@/features/admin/rbac/components/role-detail";

export default function AdminRoleDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <ProtectedPermissionRoute requiredPermission="roles.view">
      <AppShell>
        <RoleDetailScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
