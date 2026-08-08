"use client";

import { use } from "react";

import { ProjectIssueCreatePageContent } from "@/features/projects/components/project-issue-form-pages";

export default function NewProjectIssuePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return <ProjectIssueCreatePageContent projectId={projectId} />;
}
