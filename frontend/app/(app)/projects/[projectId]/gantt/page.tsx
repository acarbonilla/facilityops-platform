"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectGanttPage } from "@/features/projects/components/project-gantt-page";

export default function ProjectGanttRoutePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.gantt.view",
        "projects.view",
        "projects.manage",
      ]}
    >
      <AppShell>
        <ProjectGanttPage projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
