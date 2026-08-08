import type {
  ProjectIssueCreatePayload,
  ProjectIssueDetail,
  ProjectIssueFormValues,
  ProjectIssueUpdatePayload,
} from "@/types/projects";

const PROJECT_ISSUE_FORM_FLASH_KEY = "project-issue-form-flash";

function normalizeOptionalValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeOptionalDate(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

export function validateProjectIssueFormValues(
  values: ProjectIssueFormValues,
): {
  title?: string;
} {
  const errors: { title?: string } = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  }

  return errors;
}

export function sanitizeProjectIssueFormValues(
  values: ProjectIssueFormValues,
): ProjectIssueFormValues {
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    owner: values.owner.trim(),
    due_date: values.due_date.trim(),
  };
}

export function mapProjectIssueFormValuesToCreatePayload(
  values: ProjectIssueFormValues,
): ProjectIssueCreatePayload {
  const sanitized = sanitizeProjectIssueFormValues(values);

  return {
    title: sanitized.title,
    description: sanitized.description,
    severity: sanitized.severity,
    status: sanitized.status,
    owner: normalizeOptionalValue(sanitized.owner),
    due_date: normalizeOptionalDate(sanitized.due_date),
  };
}

export function mapProjectIssueFormValuesToUpdatePayload(
  values: ProjectIssueFormValues,
): ProjectIssueUpdatePayload {
  return mapProjectIssueFormValuesToCreatePayload(values);
}

export function buildProjectIssueFormDefaults(): ProjectIssueFormValues {
  return {
    title: "",
    description: "",
    severity: "medium",
    status: "open",
    owner: "",
    due_date: "",
  };
}

export function mapProjectIssueDetailToFormValues(
  detail: ProjectIssueDetail,
): ProjectIssueFormValues {
  return {
    title: detail.title,
    description: detail.description ?? "",
    severity: detail.severity,
    status: detail.status,
    owner: detail.owner ?? "",
    due_date: detail.due_date ?? "",
  };
}

export function writeProjectIssueFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PROJECT_ISSUE_FORM_FLASH_KEY, message);
}

export function readProjectIssueFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }
  const message = window.sessionStorage.getItem(PROJECT_ISSUE_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(PROJECT_ISSUE_FORM_FLASH_KEY);
  }
  return message;
}
