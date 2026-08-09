/**
 * FO-116 — Normalize expected API/form validation errors for application UX.
 * ApiError may still be thrown by the client; callers must catch expected errors
 * so they do not surface as Next.js Runtime overlays.
 */

import { ApiError } from "@/services/api/types";

export type FormValidationKind =
  | "validation"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "server"
  | "network"
  | "unexpected";

export interface FormValidationResult {
  kind: FormValidationKind;
  status: number;
  title: string;
  message: string;
  fieldErrors: Record<string, string>;
  nonFieldErrors: string[];
  code?: string;
  /** True when callers should swallow the rejection (no runtime overlay). */
  isExpected: boolean;
}

export interface FormValidationNormalizeOptions {
  entityLabel?: string;
  projectSchedule?: {
    plannedStart?: string | null;
    plannedEnd?: string | null;
  };
  fieldLabels?: Record<string, string>;
}

const DEFAULT_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  person_in_charge: "Person in charge",
  project_manager: "Project manager",
  status: "Status",
  priority: "Priority",
  planned_start: "Planned start",
  planned_end: "Planned end",
  planned_start_date: "Planned start date",
  planned_end_date: "Planned end date",
  is_milestone: "Milestone",
  organization: "Organization",
  building: "Building",
  non_field_errors: "Form",
  task_schedule_dependency_conflict: "Schedule dependency",
};

function formatDateLabel(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

function formatProjectScheduleRange(options?: FormValidationNormalizeOptions["projectSchedule"]): string | null {
  if (!options) return null;
  const start = formatDateLabel(options.plannedStart);
  const end = formatDateLabel(options.plannedEnd);
  if (start && end) return `${start} – ${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return null;
}

function firstMessage(messages?: string[]): string | undefined {
  return messages?.find((item) => Boolean(item?.trim()))?.trim();
}

function enhanceScheduleFieldMessage(
  field: string,
  raw: string,
  options?: FormValidationNormalizeOptions,
): string {
  const schedule = formatProjectScheduleRange(options?.projectSchedule);
  const lower = raw.toLowerCase();
  const mentionsProjectWindow =
    lower.includes("project planned") ||
    lower.includes("within the project") ||
    lower.includes("project schedule");

  if (field === "planned_end" && mentionsProjectWindow) {
    const end = formatDateLabel(options?.projectSchedule?.plannedEnd);
    const parts = [
      "Task ends after the Project schedule.",
      schedule ? `Project schedule: ${schedule}.` : null,
      end
        ? `Choose a Planned End on or before ${end}, or update the Project schedule first.`
        : "Choose Task dates within the Project schedule, or update the Project schedule first.",
    ];
    return parts.filter(Boolean).join(" ");
  }

  if (field === "planned_start" && mentionsProjectWindow) {
    const start = formatDateLabel(options?.projectSchedule?.plannedStart);
    const parts = [
      "Task starts before the Project schedule.",
      schedule ? `Project schedule: ${schedule}.` : null,
      start
        ? `Choose a Planned Start on or after ${start}.`
        : "Choose Task dates within the Project schedule, or update the Project schedule first.",
    ];
    return parts.filter(Boolean).join(" ");
  }

  if (
    (field === "planned_start" || field === "planned_end" || field === "non_field_errors") &&
    (lower.includes("both") || lower.includes("both-or-neither") || lower.includes("leave both"))
  ) {
    return "Set both Planned Start and Planned End, or leave both blank.";
  }

  if (
    field === "task_schedule_dependency_conflict" ||
    lower.includes("dependency") ||
    lower.includes("predecessor")
  ) {
    return raw.includes("must finish")
      ? `This schedule conflicts with a predecessor. ${raw} Adjust the Task schedule or review its dependency.`
      : `This schedule conflicts with a predecessor. ${raw}`;
  }

  if (field === "project_manager" || lower.includes("project manager")) {
    if (lower.includes("invalid") || lower.includes("eligible") || lower.includes("must")) {
      return "This user cannot be assigned as Project Manager.";
    }
  }

  if (field === "person_in_charge" || lower.includes("person in charge") || lower.includes("task pic")) {
    if (lower.includes("invalid") || lower.includes("eligible") || lower.includes("must")) {
      return "This user cannot be assigned as Person in Charge for this Task.";
    }
  }

  return raw;
}

function mapFieldErrors(
  errors: Record<string, string[]> | undefined,
  options?: FormValidationNormalizeOptions,
): { fieldErrors: Record<string, string>; nonFieldErrors: string[] } {
  const fieldErrors: Record<string, string> = {};
  const nonFieldErrors: string[] = [];
  if (!errors) {
    return { fieldErrors, nonFieldErrors };
  }

  for (const [field, messages] of Object.entries(errors)) {
    const raw = firstMessage(messages);
    if (!raw) continue;
    const enhanced = enhanceScheduleFieldMessage(field, raw, options);
    if (
      field === "non_field_errors" ||
      field === "detail" ||
      field === "task_schedule_dependency_conflict"
    ) {
      nonFieldErrors.push(enhanced);
      if (field === "task_schedule_dependency_conflict") {
        fieldErrors.planned_start = fieldErrors.planned_start ?? enhanced;
        fieldErrors.planned_end = fieldErrors.planned_end ?? enhanced;
      }
      continue;
    }
    fieldErrors[field] = enhanced;
  }

  return { fieldErrors, nonFieldErrors };
}

function buildValidationSummary(
  fieldErrors: Record<string, string>,
  nonFieldErrors: string[],
  fallbackMessage: string,
  options?: FormValidationNormalizeOptions,
): string {
  if (nonFieldErrors.length > 0) {
    return nonFieldErrors.join(" ");
  }

  const plannedStart = fieldErrors.planned_start;
  const plannedEnd = fieldErrors.planned_end;
  if (plannedStart || plannedEnd) {
    const schedule = formatProjectScheduleRange(options?.projectSchedule);
    const parts = [
      plannedStart && plannedEnd
        ? "Task schedule is outside the Project schedule."
        : plannedStart || plannedEnd,
      schedule ? `Project schedule: ${schedule}.` : null,
      "Review the highlighted fields below.",
    ];
    return parts.filter(Boolean).join(" ");
  }

  const firstField = Object.values(fieldErrors)[0];
  if (firstField) {
    return `${firstField} Review the highlighted fields below.`;
  }

  return fallbackMessage;
}

export function isExpectedFormApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.status === 0) {
    return true;
  }
  if (error.status === 401 || error.status === 403 || error.status === 404) {
    return true;
  }
  if (error.status === 409 || error.status === 422) {
    return true;
  }
  if (error.status >= 400 && error.status < 500) {
    return true;
  }
  if (error.status >= 500) {
    return true;
  }
  return false;
}

export function normalizeFormValidationError(
  error: unknown,
  options: FormValidationNormalizeOptions = {},
): FormValidationResult {
  const entity = options.entityLabel?.trim() || "record";

  if (!(error instanceof ApiError)) {
    if (error instanceof Error) {
      return {
        kind: "unexpected",
        status: 0,
        title: `Unable to save ${entity}`,
        message: "Something went wrong. Try again.",
        fieldErrors: {},
        nonFieldErrors: [],
        isExpected: false,
      };
    }
    return {
      kind: "unexpected",
      status: 0,
      title: `Unable to save ${entity}`,
      message: "Something went wrong. Try again.",
      fieldErrors: {},
      nonFieldErrors: [],
      isExpected: false,
    };
  }

  if (error.status === 401) {
    return {
      kind: "auth",
      status: 401,
      title: `Unable to save ${entity}`,
      message: "Your session has expired. Sign in again to continue.",
      fieldErrors: {},
      nonFieldErrors: [],
      code: error.code,
      isExpected: true,
    };
  }

  if (error.status === 403) {
    return {
      kind: "forbidden",
      status: 403,
      title: `Unable to save ${entity}`,
      message: "You do not have permission to perform this action.",
      fieldErrors: {},
      nonFieldErrors: [],
      code: error.code,
      isExpected: true,
    };
  }

  if (error.status === 404) {
    return {
      kind: "not_found",
      status: 404,
      title: `Unable to save ${entity}`,
      message: `The requested ${entity} could not be found.`,
      fieldErrors: {},
      nonFieldErrors: [],
      code: error.code,
      isExpected: true,
    };
  }

  if (error.status === 0) {
    return {
      kind: "network",
      status: 0,
      title: `Unable to save ${entity}`,
      message: "Unable to connect to the backend service. Try again.",
      fieldErrors: {},
      nonFieldErrors: [],
      isExpected: true,
    };
  }

  if (error.status >= 500) {
    return {
      kind: "server",
      status: error.status,
      title: `Unable to save ${entity}`,
      message: `Something went wrong while saving this ${entity}. Try again.`,
      fieldErrors: {},
      nonFieldErrors: [],
      code: error.code,
      isExpected: true,
    };
  }

  if (error.status === 409) {
    return {
      kind: "conflict",
      status: 409,
      title: `Unable to save ${entity}`,
      message:
        error.message?.trim() ||
        `This ${entity} could not be saved because of a conflict. Review your changes and try again.`,
      fieldErrors: {},
      nonFieldErrors: error.message ? [error.message] : [],
      code: error.code,
      isExpected: true,
    };
  }

  const { fieldErrors, nonFieldErrors } = mapFieldErrors(
    error.details?.errors,
    options,
  );

  // Assignment codes may arrive as message/code without field map.
  const code = error.code ?? error.details?.code;
  if (code === "invalid_project_manager" && !fieldErrors.project_manager) {
    fieldErrors.project_manager =
      "This user cannot be assigned as Project Manager.";
  }
  if (code === "invalid_task_pic" && !fieldErrors.person_in_charge) {
    fieldErrors.person_in_charge =
      "This user cannot be assigned as Person in Charge for this Task.";
  }

  const message = buildValidationSummary(
    fieldErrors,
    nonFieldErrors,
    error.message?.trim() ||
      `One or more fields are invalid. Review the highlighted fields below.`,
    options,
  );

  return {
    kind: "validation",
    status: error.status,
    title: `Unable to save ${entity}`,
    message,
    fieldErrors,
    nonFieldErrors,
    code,
    isExpected: true,
  };
}

export function getFormFieldLabel(
  field: string,
  fieldLabels?: Record<string, string>,
): string {
  return fieldLabels?.[field] ?? DEFAULT_FIELD_LABELS[field] ?? field;
}
