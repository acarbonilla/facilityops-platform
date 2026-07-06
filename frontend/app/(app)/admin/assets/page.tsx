"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AssetListScreen } from "@/features/assets/components/asset-list";

export default function AdminAssetsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AssetListScreen variant="admin" />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
