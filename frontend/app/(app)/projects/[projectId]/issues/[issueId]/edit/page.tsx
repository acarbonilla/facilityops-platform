"use client";

import { use } from "react";

import { ProjectIssueEditPageContent } from "@/features/projects/components/project-issue-form-pages";

export default function EditProjectIssuePage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = use(params);

  return (
    <ProjectIssueEditPageContent projectId={projectId} issueId={issueId} />
  );
}
