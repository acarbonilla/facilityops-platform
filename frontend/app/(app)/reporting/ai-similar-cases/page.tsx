"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { AISimilarCasesScreen } from "@/features/reporting/components/ai-similar-cases";

export default function AISimilarCasesPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="reporting.view">
      <AppShell>
        <AISimilarCasesScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
