"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { MyWorkTaskListScreen } from "@/features/projects/components/my-work-task-list";

export default function MyWorkTasksPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.view",
        "projects.manage",
        "projects.tasks.view",
      ]}
    >
      <AppShell>
        <MyWorkTaskListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
