"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ReportingOverviewScreen } from "@/features/reporting/components/reporting-overview";

export default function ReportingPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <ReportingOverviewScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
