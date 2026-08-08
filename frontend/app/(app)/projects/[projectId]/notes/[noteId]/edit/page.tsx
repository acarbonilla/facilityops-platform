"use client";

import { use } from "react";

import { ProjectNoteEditPageContent } from "@/features/projects/components/project-note-form-pages";

export default function EditProjectNotePage({
  params,
}: {
  params: Promise<{ projectId: string; noteId: string }>;
}) {
  const { projectId, noteId } = use(params);

  return (
    <ProjectNoteEditPageContent projectId={projectId} noteId={noteId} />
  );
}
