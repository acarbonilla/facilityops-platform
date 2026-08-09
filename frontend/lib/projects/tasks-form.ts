import type {
  ProjectTaskCreatePayload,
  ProjectTaskDetail,
  ProjectTaskFormValues,
  ProjectTaskStatus,
  ProjectTaskUpdatePayload,
} from "@/types/projects";

const PROJECT_TASK_FORM_FLASH_KEY = "project-task-form-flash";

function normalizeOptionalValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeOptionalDate(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseDate(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseProgress(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return numeric;
}

export function validateProjectTaskFormValues(values: ProjectTaskFormValues): {
  planned_start?: string;
  planned_end?: string;
  progress_percentage?: string;
  person_in_charge?: string;
  name?: string;
  is_milestone?: string;
} {
  const errors: {
    planned_start?: string;
    planned_end?: string;
    progress_percentage?: string;
    person_in_charge?: string;
    name?: string;
    is_milestone?: string;
  } = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  const plannedStartRaw = values.planned_start.trim();
  const plannedEndRaw = values.planned_end.trim();
  const plannedStart = parseDate(plannedStartRaw);
  const plannedEnd = parseDate(plannedEndRaw);

  if (values.is_milestone) {
    if (!plannedStartRaw && !plannedEndRaw) {
      errors.planned_start = "Milestone tasks require a milestone date.";
    }
  } else if (Boolean(plannedStartRaw) !== Boolean(plannedEndRaw)) {
    errors.planned_end =
      "Provide both planned start and planned end, or leave both empty for an unscheduled task.";
  }

  if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
    errors.planned_end =
      "Planned end must be on or after the planned start.";
  }

  const progress = parseProgress(values.progress_percentage);
  if (values.progress_percentage.trim()) {
    if (progress === null) {
      errors.progress_percentage = "Progress must be a valid number.";
    } else if (progress < 0 || progress > 100) {
      errors.progress_percentage =
        "Progress must be a decimal between 0 and 100.";
    }
  }

  const statusesRequiringPic: ProjectTaskStatus[] = [
    "in_progress",
    "completed",
  ];
  if (
    statusesRequiringPic.includes(values.status) &&
    !values.person_in_charge.trim()
  ) {
    errors.person_in_charge =
      "Person in charge is required before moving a task to in progress or completed.";
  }

  return errors;
}

export function sanitizeProjectTaskFormValues(
  values: ProjectTaskFormValues,
): ProjectTaskFormValues {
  const plannedStart = values.planned_start.trim();
  const plannedEnd = values.planned_end.trim();
  // Milestone: single date persists as start=end.
  const normalizedStart =
    values.is_milestone && !plannedStart && plannedEnd
      ? plannedEnd
      : plannedStart;
  const normalizedEnd =
    values.is_milestone && plannedStart
      ? plannedStart
      : values.is_milestone && plannedEnd
        ? plannedEnd
        : plannedEnd;

  return {
    ...values,
    name: values.name.trim(),
    description: values.description.trim(),
    person_in_charge: values.person_in_charge.trim(),
    planned_start: normalizedStart,
    planned_end: values.is_milestone ? normalizedStart || normalizedEnd : normalizedEnd,
    actual_start: "",
    actual_end: "",
    progress_percentage: values.progress_percentage.trim(),
    sequence: values.sequence.trim(),
  };
}

export function mapProjectTaskFormValuesToCreatePayload(
  values: ProjectTaskFormValues,
): ProjectTaskCreatePayload {
  const sanitized = sanitizeProjectTaskFormValues(values);
  const progress = parseProgress(sanitized.progress_percentage);
  const sequence = sanitized.sequence
    ? Number.parseInt(sanitized.sequence, 10)
    : undefined;

  return {
    name: sanitized.name,
    description: sanitized.description,
    person_in_charge: normalizeOptionalValue(sanitized.person_in_charge),
    status: sanitized.status,
    priority: sanitized.priority,
    planned_start: normalizeOptionalDate(sanitized.planned_start),
    planned_end: normalizeOptionalDate(sanitized.planned_end),
    progress_percentage: progress ?? undefined,
    sequence: Number.isFinite(sequence) ? sequence : undefined,
    is_milestone: sanitized.is_milestone,
  };
}

export function mapProjectTaskFormValuesToUpdatePayload(
  values: ProjectTaskFormValues,
): ProjectTaskUpdatePayload {
  return mapProjectTaskFormValuesToCreatePayload(values);
}

export function buildProjectTaskFormDefaults(): ProjectTaskFormValues {
  return {
    name: "",
    description: "",
    person_in_charge: "",
    status: "not_started",
    priority: "medium",
    planned_start: "",
    planned_end: "",
    actual_start: "",
    actual_end: "",
    progress_percentage: "0",
    sequence: "",
    is_milestone: false,
  };
}

export function mapProjectTaskDetailToFormValues(
  detail: ProjectTaskDetail,
): ProjectTaskFormValues {
  return {
    name: detail.name,
    description: detail.description ?? "",
    person_in_charge: detail.person_in_charge ?? "",
    status: detail.status,
    priority: detail.priority,
    planned_start: detail.planned_start ?? "",
    planned_end: detail.planned_end ?? "",
    actual_start: "",
    actual_end: "",
    progress_percentage: String(detail.progress_percentage ?? "0"),
    sequence: String(detail.sequence ?? ""),
    is_milestone: Boolean(detail.is_milestone),
  };
}

export function writeProjectTaskFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PROJECT_TASK_FORM_FLASH_KEY, message);
}

export function readProjectTaskFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }

  const message = window.sessionStorage.getItem(PROJECT_TASK_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(PROJECT_TASK_FORM_FLASH_KEY);
  }
  return message;
}

export const PROJECT_TASK_FORM_API_FIELD_MAP: Record<
  string,
  keyof ProjectTaskFormValues
> = {
  name: "name",
  description: "description",
  person_in_charge: "person_in_charge",
  status: "status",
  priority: "priority",
  planned_start: "planned_start",
  planned_end: "planned_end",
  progress_percentage: "progress_percentage",
  sequence: "sequence",
  is_milestone: "is_milestone",
};
