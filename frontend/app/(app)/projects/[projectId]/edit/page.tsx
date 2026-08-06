"use client";

import { use } from "react";

import { ProjectEditPageContent } from "@/features/projects/components/project-form-pages";

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return <ProjectEditPageContent projectId={projectId} />;
}
