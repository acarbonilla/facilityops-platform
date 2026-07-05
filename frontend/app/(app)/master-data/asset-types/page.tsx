"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AssetTypesReadScreen } from "@/components/master-data/master-data-screens";

export default function AssetTypesPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AssetTypesReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
