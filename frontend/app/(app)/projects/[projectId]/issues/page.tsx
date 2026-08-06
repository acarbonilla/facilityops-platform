"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectIssuesListScreen } from "@/features/projects/components/project-issues-list";

export default function ProjectIssuesListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.issues.view",
        "projects.view",
        "projects.manage",
        "projects.issues.manage",
      ]}
    >
      <AppShell>
        <ProjectIssuesListScreen projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
