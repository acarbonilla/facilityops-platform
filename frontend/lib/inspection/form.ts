import type { AuthUser } from "@/types/auth";
import type {
  InspectionCreatePayload,
  InspectionDetail,
  InspectionFormOptions,
  InspectionFormValues,
  InspectionItemFormValues,
  InspectionItemPayload,
  InspectionUpdatePayload,
} from "@/types/inspection";

const INSPECTION_FORM_FLASH_KEY = "inspection-form-flash";

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

function inspectionItemHasContent(item: InspectionItemFormValues) {
  return Boolean(
    item.sequence.trim() ||
      item.checklist_item.trim() ||
      item.category.trim() ||
      item.expected_result.trim() ||
      item.max_score.trim() ||
      item.score.trim() ||
      item.observation.trim() ||
      item.notes.trim(),
  );
}

function normalizePassValue(value: InspectionItemFormValues["is_pass"]) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function mapInspectionItemToPayload(
  item: InspectionItemFormValues,
): InspectionItemPayload {
  const normalizedScore = normalizeOptionalValue(item.score);
  const normalizedPass = normalizePassValue(item.is_pass);

  return {
    sequence: Number(item.sequence.trim() || "1"),
    checklist_item: item.checklist_item.trim(),
    category: item.category.trim(),
    expected_result: item.expected_result.trim(),
    max_score: normalizeOptionalValue(item.max_score) ?? "5.00",
    score: normalizedScore,
    is_pass: normalizedScore !== null ? normalizedPass : null,
    observation: item.observation.trim(),
    notes: item.notes.trim(),
  };
}

export function createEmptyInspectionItem(
  sequence = 1,
): InspectionItemFormValues {
  return {
    sequence: String(sequence),
    checklist_item: "",
    category: "",
    expected_result: "",
    max_score: "5.00",
    score: "",
    is_pass: "",
    observation: "",
    notes: "",
  };
}

export function sanitizeInspectionFormValues(
  values: InspectionFormValues,
): InspectionFormValues {
  return {
    ...values,
    title: values.title.trim(),
    inspection_template: values.inspection_template.trim(),
    remarks: values.remarks.trim(),
    items: values.items.filter(inspectionItemHasContent).map((item) => ({
      ...item,
      sequence: item.sequence.trim(),
      checklist_item: item.checklist_item.trim(),
      category: item.category.trim(),
      expected_result: item.expected_result.trim(),
      max_score: item.max_score.trim(),
      score: item.score.trim(),
      observation: item.observation.trim(),
      notes: item.notes.trim(),
    })),
  };
}

export function mapInspectionFormValuesToCreatePayload(
  values: InspectionFormValues,
): InspectionCreatePayload {
  const sanitizedValues = sanitizeInspectionFormValues(values);

  return {
    tenant: sanitizedValues.tenant,
    organization: sanitizedValues.organization,
    department: normalizeOptionalValue(sanitizedValues.department),
    building: sanitizedValues.building,
    floor: normalizeOptionalValue(sanitizedValues.floor),
    area: normalizeOptionalValue(sanitizedValues.area),
    title: sanitizedValues.title,
    inspection_type: sanitizedValues.inspection_type,
    five_s_category: sanitizedValues.five_s_category,
    inspection_template: normalizeOptionalValue(
      sanitizedValues.inspection_template,
    ),
    inspector: normalizeOptionalValue(sanitizedValues.inspector),
    supervisor: normalizeOptionalValue(sanitizedValues.supervisor),
    priority: sanitizedValues.priority,
    scheduled_date: normalizeDateTime(sanitizedValues.scheduled_date),
    remarks: sanitizedValues.remarks,
    items: sanitizedValues.items.map(mapInspectionItemToPayload),
  };
}

export function mapInspectionFormValuesToUpdatePayload(
  values: InspectionFormValues,
): InspectionUpdatePayload {
  return mapInspectionFormValuesToCreatePayload(values);
}

export function buildInspectionFormDefaults(
  user: AuthUser | null,
): InspectionFormValues {
  return {
    tenant: user?.tenant ?? "",
    organization: user?.organization ?? "",
    department: "",
    building: "",
    floor: "",
    area: "",
    title: "",
    inspection_type: "routine",
    five_s_category: "sustain",
    inspection_template: "",
    inspector: "",
    supervisor: "",
    priority: "medium",
    scheduled_date: "",
    remarks: "",
    items: [createEmptyInspectionItem(1)],
  };
}

export function mapInspectionDetailToFormValues(
  detail: InspectionDetail,
): InspectionFormValues {
  return {
    tenant: detail.tenant,
    organization: detail.organization,
    department: detail.department ?? "",
    building: detail.building,
    floor: detail.floor ?? "",
    area: detail.area ?? "",
    title: detail.title,
    inspection_type: detail.inspection_type,
    five_s_category: detail.five_s_category,
    inspection_template: detail.inspection_template,
    inspector: detail.inspector ?? "",
    supervisor: detail.supervisor ?? "",
    priority: detail.priority,
    scheduled_date: formatDateTimeLocalValue(detail.scheduled_date),
    remarks: detail.remarks,
    items:
      detail.items.length > 0
        ? detail.items.map((item) => ({
            sequence: String(item.sequence),
            checklist_item: item.checklist_item,
            category: item.category,
            expected_result: item.expected_result,
            max_score: item.max_score,
            score: item.score ?? "",
            is_pass:
              item.is_pass === null ? "" : item.is_pass ? "true" : "false",
            observation: item.observation,
            notes: item.notes,
          }))
        : [createEmptyInspectionItem(1)],
  };
}

export function writeInspectionFormFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(INSPECTION_FORM_FLASH_KEY, message);
}

export function readInspectionFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }

  const message = window.sessionStorage.getItem(INSPECTION_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(INSPECTION_FORM_FLASH_KEY);
  }
  return message;
}

export function getInspectionCapabilityNotes(options: InspectionFormOptions) {
  return {
    userDirectory: options.supports_user_directory
      ? null
      : options.user_directory_note,
  };
}
