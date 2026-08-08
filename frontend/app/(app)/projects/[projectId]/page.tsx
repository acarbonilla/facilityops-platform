"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectDetailScreen } from "@/features/projects/components/project-detail";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["projects.view", "projects.manage"]}
    >
      <AppShell>
        <ProjectDetailScreen projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
