"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AIOperationalInsightsScreen } from "@/features/reporting/components/ai-operational-insights";

export default function AIOperationalInsightsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <AIOperationalInsightsScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
