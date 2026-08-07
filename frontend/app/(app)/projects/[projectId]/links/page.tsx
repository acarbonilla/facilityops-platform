"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectLinksPageScreen } from "@/features/projects/components/project-links-page";

export default function ProjectLinksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.links.view",
        "projects.view",
        "projects.manage",
      ]}
    >
      <AppShell>
        <ProjectLinksPageScreen projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
