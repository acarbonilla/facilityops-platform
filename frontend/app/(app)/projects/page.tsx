"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectListScreen } from "@/features/projects/components/project-list";

export default function ProjectsPage() {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["projects.view", "projects.manage"]}
    >
      <AppShell>
        <ProjectListScreen />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
