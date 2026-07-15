import type { AuthUser } from "@/types/auth";
import type {
  MaintenanceWorkOrderCreatePayload,
  MaintenanceWorkOrderDetail,
  MaintenanceWorkOrderFormValues,
  MaintenanceWorkOrderUpdatePayload,
} from "@/types/maintenance";

const MAINTENANCE_FORM_FLASH_KEY = "maintenance-work-order-flash";

export const MAINTENANCE_FORM_WORKFLOW_GUIDANCE =
  "After creation, use Work Order Details to assign personnel and perform status actions. To create work from an FM Ticket, use Generate Work Order from the Ticket instead.";

export const MAINTENANCE_FORM_ASSIGNMENT_GUIDANCE =
  "Create the Work Order first. Technician and Supervisor assignments are managed from the Work Order Details page.";

export const MAINTENANCE_FORM_ATTACHMENT_GUIDANCE =
  "Attachments can be added when the Maintenance upload workflow becomes available.";

function formatDateTimeLocalValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const timezoneOffset = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeOptionalValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeDateTime(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return trimmedValue;
  }

  return parsed.toISOString();
}

export function sanitizeMaintenanceFormValues(
  values: MaintenanceWorkOrderFormValues,
): MaintenanceWorkOrderFormValues {
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    requested_by: values.requested_by.trim(),
    department: values.department.trim(),
    floor: values.floor.trim(),
    area: values.area.trim(),
    estimated_start_at: values.estimated_start_at.trim(),
    estimated_completion_at: values.estimated_completion_at.trim(),
  };
}

export function mapMaintenanceFormValuesToCreatePayload(
  values: MaintenanceWorkOrderFormValues,
): MaintenanceWorkOrderCreatePayload {
  const sanitizedValues = sanitizeMaintenanceFormValues(values);

  return {
    tenant: sanitizedValues.tenant,
    organization: sanitizedValues.organization,
    department: normalizeOptionalValue(sanitizedValues.department),
    building: sanitizedValues.building,
    floor: normalizeOptionalValue(sanitizedValues.floor),
    area: normalizeOptionalValue(sanitizedValues.area),
    asset: sanitizedValues.asset,
    title: sanitizedValues.title,
    description: sanitizedValues.description,
    priority: sanitizedValues.priority,
    scheduled_start_at: normalizeDateTime(sanitizedValues.estimated_start_at),
    scheduled_end_at: normalizeDateTime(
      sanitizedValues.estimated_completion_at,
    ),
    due_at: normalizeDateTime(sanitizedValues.due_at),
  };
}

export function mapMaintenanceFormValuesToUpdatePayload(
  values: MaintenanceWorkOrderFormValues,
): MaintenanceWorkOrderUpdatePayload {
  return {
    ...mapMaintenanceFormValuesToCreatePayload(values),
    cancellation_reason: "",
  };
}

/** Maps backend create/update error keys onto maintenance form field paths. */
export const MAINTENANCE_FORM_API_FIELD_MAP: Record<
  string,
  keyof MaintenanceWorkOrderFormValues
> = {
  tenant: "tenant",
  organization: "organization",
  department: "department",
  building: "building",
  floor: "floor",
  area: "area",
  asset: "asset",
  title: "title",
  description: "description",
  priority: "priority",
  due_at: "due_at",
  scheduled_start_at: "estimated_start_at",
  scheduled_end_at: "estimated_completion_at",
};

export function buildMaintenanceFormDefaults(
  user: AuthUser | null,
): MaintenanceWorkOrderFormValues {
  const requestedBy = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.email
    : "";
  const requestedAt = formatDateTimeLocalValue(new Date().toISOString());

  return {
    tenant: "",
    organization: "",
    department: "",
    requested_by: requestedBy,
    title: "",
    description: "",
    priority: "medium",
    asset: "",
    building: "",
    floor: "",
    area: "",
    requested_at: requestedAt,
    due_at: "",
    estimated_start_at: "",
    estimated_completion_at: "",
  };
}

export function mapMaintenanceDetailToFormValues(
  detail: MaintenanceWorkOrderDetail,
): MaintenanceWorkOrderFormValues {
  return {
    tenant: detail.tenant,
    organization: detail.organization,
    department: detail.department ?? "",
    requested_by: detail.requester_email,
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    asset: detail.asset,
    building: detail.building,
    floor: detail.floor ?? "",
    area: detail.area ?? "",
    requested_at: formatDateTimeLocalValue(detail.requested_at),
    due_at: formatDateTimeLocalValue(detail.due_at),
    estimated_start_at: formatDateTimeLocalValue(detail.scheduled_start_at),
    estimated_completion_at: formatDateTimeLocalValue(detail.scheduled_end_at),
  };
}

export function writeMaintenanceFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(MAINTENANCE_FORM_FLASH_KEY, message);
}

export function readMaintenanceFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }

  const message = window.sessionStorage.getItem(MAINTENANCE_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(MAINTENANCE_FORM_FLASH_KEY);
  }
  return message;
}

export function getMaintenanceCapabilityNotes() {
  return {
    attachments: MAINTENANCE_FORM_ATTACHMENT_GUIDANCE,
    assignments: MAINTENANCE_FORM_ASSIGNMENT_GUIDANCE,
  };
}
