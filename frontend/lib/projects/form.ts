import type { AuthUser } from "@/types/auth";
import type {
  ProjectCreatePayload,
  ProjectDetail,
  ProjectFormValues,
  ProjectUpdatePayload,
} from "@/types/projects";

const PROJECT_FORM_FLASH_KEY = "project-form-flash";

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

export function validateProjectDateRanges(values: ProjectFormValues): {
  planned_end_date?: string;
  actual_end_date?: string;
} {
  const errors: {
    planned_end_date?: string;
    actual_end_date?: string;
  } = {};

  const plannedStart = parseDate(values.planned_start_date);
  const plannedEnd = parseDate(values.planned_end_date);
  if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
    errors.planned_end_date =
      "Planned end date must be on or after the planned start date.";
  }

  const actualStart = parseDate(values.actual_start_date);
  const actualEnd = parseDate(values.actual_end_date);
  if (actualStart && actualEnd && actualEnd < actualStart) {
    errors.actual_end_date =
      "Actual end date must be on or after the actual start date.";
  }

  return errors;
}

export function sanitizeProjectFormValues(
  values: ProjectFormValues,
): ProjectFormValues {
  return {
    ...values,
    organization: values.organization.trim(),
    building: values.building.trim(),
    project_code: values.project_code.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    project_manager: values.project_manager.trim(),
    planned_start_date: values.planned_start_date.trim(),
    planned_end_date: values.planned_end_date.trim(),
    actual_start_date: values.actual_start_date.trim(),
    actual_end_date: values.actual_end_date.trim(),
  };
}

export function mapProjectFormValuesToCreatePayload(
  values: ProjectFormValues,
): ProjectCreatePayload {
  const sanitizedValues = sanitizeProjectFormValues(values);
  const projectCode = sanitizedValues.project_code;

  return {
    organization: sanitizedValues.organization,
    building: normalizeOptionalValue(sanitizedValues.building),
    project_code: projectCode || undefined,
    name: sanitizedValues.name,
    description: sanitizedValues.description,
    project_manager: normalizeOptionalValue(sanitizedValues.project_manager),
    status: sanitizedValues.status,
    priority: sanitizedValues.priority,
    planned_start_date: normalizeOptionalDate(sanitizedValues.planned_start_date),
    planned_end_date: normalizeOptionalDate(sanitizedValues.planned_end_date),
    actual_start_date: normalizeOptionalDate(sanitizedValues.actual_start_date),
    actual_end_date: normalizeOptionalDate(sanitizedValues.actual_end_date),
  };
}

export function mapProjectFormValuesToUpdatePayload(
  values: ProjectFormValues,
): ProjectUpdatePayload {
  return mapProjectFormValuesToCreatePayload(values);
}

export function buildProjectFormDefaults(
  user: AuthUser | null,
): ProjectFormValues {
  return {
    organization: user?.organization ?? "",
    building: "",
    project_code: "",
    name: "",
    description: "",
    project_manager: "",
    status: "draft",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    actual_start_date: "",
    actual_end_date: "",
  };
}

export function mapProjectDetailToFormValues(
  detail: ProjectDetail,
): ProjectFormValues {
  return {
    organization: detail.organization,
    building: detail.building ?? "",
    project_code: detail.project_code,
    name: detail.name,
    description: detail.description,
    project_manager: detail.project_manager ?? "",
    status: detail.status,
    priority: detail.priority,
    planned_start_date: detail.planned_start_date ?? "",
    planned_end_date: detail.planned_end_date ?? "",
    actual_start_date: detail.actual_start_date ?? "",
    actual_end_date: detail.actual_end_date ?? "",
  };
}

export function writeProjectFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PROJECT_FORM_FLASH_KEY, message);
}

export function readProjectFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }

  const message = window.sessionStorage.getItem(PROJECT_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(PROJECT_FORM_FLASH_KEY);
  }
  return message;
}

/** Maps backend create/update error keys onto project form field paths. */
export const PROJECT_FORM_API_FIELD_MAP: Record<
  string,
  keyof ProjectFormValues
> = {
  organization: "organization",
  building: "building",
  project_code: "project_code",
  name: "name",
  description: "description",
  project_manager: "project_manager",
  status: "status",
  priority: "priority",
  planned_start_date: "planned_start_date",
  planned_end_date: "planned_end_date",
  actual_start_date: "actual_start_date",
  actual_end_date: "actual_end_date",
};
