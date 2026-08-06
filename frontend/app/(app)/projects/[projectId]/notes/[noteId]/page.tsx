"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectNoteDetailScreen } from "@/features/projects/components/project-note-form-pages";

export default function ProjectNoteDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; noteId: string }>;
}) {
  const { projectId, noteId } = use(params);

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
        <ProjectNoteDetailScreen projectId={projectId} noteId={noteId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
