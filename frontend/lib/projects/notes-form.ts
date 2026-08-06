import type {
  ProjectNote,
  ProjectNoteCreatePayload,
  ProjectNoteFormValues,
  ProjectNoteUpdatePayload,
} from "@/types/projects";

const PROJECT_NOTE_FORM_FLASH_KEY = "project-note-form-flash";

export function validateProjectNoteFormValues(
  values: ProjectNoteFormValues,
): {
  title?: string;
  note?: string;
} {
  const errors: { title?: string; note?: string } = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  }
  if (!values.note.trim()) {
    errors.note = "Note is required.";
  }

  return errors;
}

export function sanitizeProjectNoteFormValues(
  values: ProjectNoteFormValues,
): ProjectNoteFormValues {
  return {
    ...values,
    title: values.title.trim(),
    note: values.note.trim(),
  };
}

export function mapProjectNoteFormValuesToCreatePayload(
  values: ProjectNoteFormValues,
): ProjectNoteCreatePayload {
  const sanitized = sanitizeProjectNoteFormValues(values);
  return {
    title: sanitized.title,
    note: sanitized.note,
    category: sanitized.category,
  };
}

export function mapProjectNoteFormValuesToUpdatePayload(
  values: ProjectNoteFormValues,
): ProjectNoteUpdatePayload {
  return mapProjectNoteFormValuesToCreatePayload(values);
}

export function buildProjectNoteFormDefaults(): ProjectNoteFormValues {
  return {
    title: "",
    note: "",
    category: "general",
  };
}

export function mapProjectNoteDetailToFormValues(
  detail: ProjectNote,
): ProjectNoteFormValues {
  return {
    title: detail.title,
    note: detail.note ?? "",
    category: detail.category,
  };
}

export function writeProjectNoteFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PROJECT_NOTE_FORM_FLASH_KEY, message);
}

export function readProjectNoteFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }
  const message = window.sessionStorage.getItem(PROJECT_NOTE_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(PROJECT_NOTE_FORM_FLASH_KEY);
  }
  return message;
}
