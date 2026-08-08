"use client";

import { use } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectIssueDetailScreen } from "@/features/projects/components/project-issue-detail";

export default function ProjectIssueDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = use(params);

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
        <ProjectIssueDetailScreen
          projectId={projectId}
          issueId={issueId}
        />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
