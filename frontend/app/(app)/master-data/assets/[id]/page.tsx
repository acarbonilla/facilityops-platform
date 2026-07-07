"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AssetDetailScreen } from "@/features/assets/components/asset-detail";

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <AssetDetailScreen id={id} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
