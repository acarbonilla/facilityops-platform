"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectNotesListScreen } from "@/features/projects/components/project-notes-list";

export default function ProjectNotesListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.notes.view",
        "projects.view",
        "projects.manage",
        "projects.notes.manage",
      ]}
    >
      <AppShell>
        <ProjectNotesListScreen projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
