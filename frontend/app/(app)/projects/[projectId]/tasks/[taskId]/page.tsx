"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectTaskDetailScreen } from "@/features/projects/components/project-task-detail";

export default function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = use(params);

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
        <ProjectTaskDetailScreen projectId={projectId} taskId={taskId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
