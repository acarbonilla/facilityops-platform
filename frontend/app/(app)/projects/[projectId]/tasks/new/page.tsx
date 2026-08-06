"use client";

import { use } from "react";

import { ProjectTaskCreatePageContent } from "@/features/projects/components/project-task-form-pages";

export default function NewProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return <ProjectTaskCreatePageContent projectId={projectId} />;
}
