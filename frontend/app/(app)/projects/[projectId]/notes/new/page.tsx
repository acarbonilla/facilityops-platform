"use client";

import { use } from "react";

import { ProjectNoteCreatePageContent } from "@/features/projects/components/project-note-form-pages";

export default function NewProjectNotePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return <ProjectNoteCreatePageContent projectId={projectId} />;
}
