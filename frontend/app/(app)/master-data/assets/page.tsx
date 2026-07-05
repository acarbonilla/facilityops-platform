"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AssetsReadScreen } from "@/components/master-data/master-data-screens";

export default function AssetsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AssetsReadScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
