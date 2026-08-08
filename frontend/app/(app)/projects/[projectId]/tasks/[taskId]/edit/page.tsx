"use client";

import { use } from "react";

import { ProjectTaskEditPageContent } from "@/features/projects/components/project-task-form-pages";

export default function EditProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = use(params);

  return (
    <ProjectTaskEditPageContent projectId={projectId} taskId={taskId} />
  );
}
