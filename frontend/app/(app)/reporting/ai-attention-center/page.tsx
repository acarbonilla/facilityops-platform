"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AIAttentionCenterScreen } from "@/features/reporting/components/ai-attention-center";

export default function AIAttentionCenterPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <AIAttentionCenterScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
