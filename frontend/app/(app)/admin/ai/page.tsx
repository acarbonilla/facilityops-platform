"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AIAdministrationScreen } from "@/features/admin/components/ai-administration";
import { AI_ADMIN_PERMISSION } from "@/lib/admin/ai-administration";

export default function AIAdministrationPage() {
  return (
    <ProtectedPermissionRoute requiredPermission={AI_ADMIN_PERMISSION}>
      <AppShell>
        <AIAdministrationScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
