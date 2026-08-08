"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectProgressPage } from "@/features/projects/components/project-progress-page";

export default function ProjectProgressRoutePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.progress.view",
        "projects.view",
        "projects.manage",
      ]}
    >
      <AppShell>
        <ProjectProgressPage projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
