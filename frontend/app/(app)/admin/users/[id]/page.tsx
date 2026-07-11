"use client";

import { useParams } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { UserDetailScreen } from "@/features/admin/users/components/user-detail-screen";

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <ProtectedPermissionRoute requiredPermission="users.view">
      <AppShell>
        <UserDetailScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}