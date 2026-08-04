"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ExecutiveAIDashboardScreen } from "@/features/reporting/components/ai-executive-dashboard";

export default function ExecutiveAIDashboardPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <ExecutiveAIDashboardScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
