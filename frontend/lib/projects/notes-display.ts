import { ApiError } from "@/services/api/types";
import type { ProjectNoteCategory } from "@/types/projects";

import { formatProjectLabel } from "./display";

export const PROJECT_NOTE_CATEGORY_LABELS: Record<
  ProjectNoteCategory,
  string
> = {
  general: "General",
  meeting: "Meeting",
  decision: "Decision",
  safety: "Safety",
  material: "Material",
  contractor: "Contractor",
  client: "Client",
  other: "Other",
};

export function formatProjectNoteCategoryLabel(
  category: ProjectNoteCategory,
): string {
  return PROJECT_NOTE_CATEGORY_LABELS[category] ?? formatProjectLabel(category);
}

const PROJECT_NOTE_FORM_API_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  note: "Note",
  category: "Category",
  non_field_errors: "Form",
};

export function formatProjectNoteApiFieldLabel(field: string): string {
  return (
    PROJECT_NOTE_FORM_API_FIELD_LABELS[field] ??
    formatProjectLabel(field, field)
  );
}

export function formatProjectNoteValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatProjectNoteApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatProjectNoteError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to manage this note.";
    }
    if (error.status === 404) {
      return "The requested note could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading note data.";
    }

    const validationMessages = formatProjectNoteValidationMessages(
      error.details?.errors ?? {},
    );
    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getProjectNoteListLayoutClasses() {
  return {
    tableWrapper: "hidden md:block",
    cardsWrapper: "space-y-3 md:hidden",
  };
}

export function canViewProjectNotes(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.notes.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.notes.manage")
  );
}

export function canManageProjectNotes(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.notes.manage") ||
    hasPermission("projects.manage")
  );
}
