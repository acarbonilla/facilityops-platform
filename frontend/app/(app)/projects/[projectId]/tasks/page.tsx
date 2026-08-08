"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectTaskListScreen } from "@/features/projects/components/project-task-list";

export default function ProjectTaskListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.tasks.view",
        "projects.view",
        "projects.manage",
      ]}
    >
      <AppShell>
        <ProjectTaskListScreen projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
