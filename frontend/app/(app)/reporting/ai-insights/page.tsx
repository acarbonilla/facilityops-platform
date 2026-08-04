"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AIRecommendationInsightsScreen } from "@/features/reporting/components/ai-recommendation-insights";

export default function AIRecommendationInsightsPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <AIRecommendationInsightsScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
