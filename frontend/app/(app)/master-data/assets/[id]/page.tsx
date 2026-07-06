"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AssetDetailScreen } from "@/features/assets/components/asset-detail";

export default function AssetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AssetDetailScreen id={params.id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
