"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectTimelinePage } from "@/features/projects/components/project-timeline-page";

export default function ProjectTimelineRoutePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        "projects.timeline.view",
        "projects.view",
        "projects.manage",
      ]}
    >
      <AppShell>
        <ProjectTimelinePage projectId={projectId} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
