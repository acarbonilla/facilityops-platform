import type { AuthUser } from "@/types/auth";
import type {
  MaintenanceFormOptions,
  MaintenanceLaborFormValues,
  MaintenanceMaterialFormValues,
  MaintenanceTaskFormValues,
  MaintenanceWorkOrderCreatePayload,
  MaintenanceWorkOrderDetail,
  MaintenanceWorkOrderFormValues,
  MaintenanceWorkOrderUpdatePayload,
} from "@/types/maintenance";

const MAINTENANCE_FORM_FLASH_KEY = "maintenance-work-order-flash";

export function createEmptyMaintenanceTask(
  sequence = 1,
): MaintenanceTaskFormValues {
  return {
    title: "",
    description: "",
    estimated_hours: "",
    sequence: String(sequence),
    required: true,
  };
}

export function createEmptyMaintenanceMaterial(): MaintenanceMaterialFormValues {
  return {
    name: "",
    quantity: "",
    unit: "unit",
    estimated_cost: "",
    notes: "",
  };
}

export function createEmptyMaintenanceLabor(): MaintenanceLaborFormValues {
  return {
    estimated_hours: "",
    rate: "",
    notes: "",
  };
}

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

function taskHasContent(task: MaintenanceTaskFormValues) {
  return Boolean(
    task.title.trim() ||
      task.description.trim() ||
      task.estimated_hours.trim() ||
      task.sequence.trim(),
  );
}

function materialHasContent(material: MaintenanceMaterialFormValues) {
  return Boolean(
    material.name.trim() ||
      material.quantity.trim() ||
      material.unit.trim() ||
      material.estimated_cost.trim() ||
      material.notes.trim(),
  );
}

function laborHasContent(entry: MaintenanceLaborFormValues) {
  return Boolean(
    entry.estimated_hours.trim() ||
      entry.rate.trim() ||
      entry.notes.trim(),
  );
}

export function sanitizeMaintenanceFormValues(
  values: MaintenanceWorkOrderFormValues,
): MaintenanceWorkOrderFormValues {
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    notes: values.notes.trim(),
    location_description: values.location_description.trim(),
    requested_by: values.requested_by.trim(),
    assignment_team: values.assignment_team.trim(),
    tasks: values.tasks.filter(taskHasContent).map((task) => ({
      ...task,
      title: task.title.trim(),
      description: task.description.trim(),
      estimated_hours: task.estimated_hours.trim(),
      sequence: task.sequence.trim(),
    })),
    materials: values.materials.filter(materialHasContent).map((material) => ({
      ...material,
      name: material.name.trim(),
      quantity: material.quantity.trim(),
      unit: material.unit.trim(),
      estimated_cost: material.estimated_cost.trim(),
      notes: material.notes.trim(),
    })),
    labor: values.labor.filter(laborHasContent).map((entry) => ({
      ...entry,
      estimated_hours: entry.estimated_hours.trim(),
      rate: entry.rate.trim(),
      notes: entry.notes.trim(),
    })),
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
    category: "preventive",
    maintenance_type: "planned",
    priority: "medium",
    notes: "",
    asset: "",
    building: "",
    floor: "",
    area: "",
    location_description: "",
    requested_at: requestedAt,
    due_at: "",
    estimated_start_at: "",
    estimated_completion_at: "",
    estimated_hours: "",
    assignment_team: "",
    tasks: [createEmptyMaintenanceTask(1)],
    materials: [createEmptyMaintenanceMaterial()],
    labor: [createEmptyMaintenanceLabor()],
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
    category: "preventive",
    maintenance_type: "planned",
    priority: detail.priority,
    notes: "",
    asset: detail.asset,
    building: detail.building,
    floor: detail.floor ?? "",
    area: detail.area ?? "",
    location_description: "",
    requested_at: formatDateTimeLocalValue(detail.requested_at),
    due_at: formatDateTimeLocalValue(detail.due_at),
    estimated_start_at: formatDateTimeLocalValue(detail.scheduled_start_at),
    estimated_completion_at: formatDateTimeLocalValue(detail.scheduled_end_at),
    estimated_hours: "",
    assignment_team: detail.department_name ?? "",
    tasks:
      detail.tasks.length > 0
          ? detail.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            estimated_hours: "",
            sequence: String(task.sequence),
            required: true,
          }))
        : [createEmptyMaintenanceTask(1)],
    materials:
      detail.materials.length > 0
        ? detail.materials.map((material) => ({
            name: material.name,
            quantity: material.quantity,
            unit: material.unit,
            estimated_cost: "",
            notes: material.notes,
          }))
        : [createEmptyMaintenanceMaterial()],
    labor:
      detail.labor_entries.length > 0
        ? detail.labor_entries.map((entry) => ({
            estimated_hours: entry.hours,
            rate: "",
            notes: entry.description,
          }))
        : [createEmptyMaintenanceLabor()],
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

export function getMaintenanceCapabilityNotes(options: MaintenanceFormOptions) {
  return {
    attachments: options.supports_attachments
      ? null
      : "Attachment upload is pending because the current backend foundation does not expose an upload endpoint.",
    assignments: options.supports_assignment_persistence
      ? null
      : "Assignment planning fields are visible, but persistence is deferred to later maintenance workflow APIs.",
    tasks:
      options.supports_task_persistence &&
      options.supports_material_persistence &&
      options.supports_labor_persistence
        ? null
        : "Task, material, and labor rows are planning-only in this form because the current create/update endpoints do not save line items yet.",
    draft: options.supports_save_draft
      ? null
      : "Save draft is unavailable because the backend create endpoint still creates open work orders directly.",
  };
}
