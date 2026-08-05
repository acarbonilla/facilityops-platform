"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AIMonitoringScreen } from "@/features/admin/components/ai-monitoring";
import { AI_MONITORING_PERMISSION } from "@/lib/admin/ai-monitoring";

export default function AIMonitoringPage() {
  return (
    <ProtectedPermissionRoute requiredPermission={AI_MONITORING_PERMISSION}>
      <AppShell>
        <AIMonitoringScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
