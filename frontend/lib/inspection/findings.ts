import type {
  InspectionCorrectiveAction,
  InspectionCorrectiveActionCreatePayload,
  InspectionCorrectiveActionFormValues,
  InspectionCorrectiveActionUpdatePayload,
  InspectionFinding,
  InspectionFindingCreatePayload,
  InspectionFindingFormValues,
  InspectionFindingUpdatePayload,
} from "@/types/inspection";

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

export function createEmptyFindingFormValues(
  inspectionId: string,
): InspectionFindingFormValues {
  return {
    inspection: inspectionId,
    item: "",
    finding_type: "observation",
    severity: "medium",
    description: "",
    root_cause: "",
    recommendation: "",
    ai_recommendation: "",
    photo_path: "",
    status: "open",
  };
}

export function mapFindingToFormValues(
  finding: InspectionFinding,
): InspectionFindingFormValues {
  return {
    inspection: finding.inspection,
    item: finding.item ?? "",
    finding_type: finding.finding_type,
    severity: finding.severity,
    description: finding.description,
    root_cause: finding.root_cause,
    recommendation: finding.recommendation,
    ai_recommendation: finding.ai_recommendation,
    photo_path: finding.photo_path,
    status: finding.status,
  };
}

export function mapFindingFormValuesToCreatePayload(
  values: InspectionFindingFormValues,
): InspectionFindingCreatePayload {
  return {
    inspection: values.inspection,
    item: normalizeOptionalValue(values.item),
    finding_type: values.finding_type,
    severity: values.severity,
    description: values.description.trim(),
    root_cause: values.root_cause.trim(),
    recommendation: values.recommendation.trim(),
    ai_recommendation: values.ai_recommendation.trim(),
    photo_path: values.photo_path.trim(),
    status: values.status,
  };
}

export function mapFindingFormValuesToUpdatePayload(
  values: InspectionFindingFormValues,
): InspectionFindingUpdatePayload {
  return mapFindingFormValuesToCreatePayload(values);
}

export function createEmptyCorrectiveActionFormValues(
  inspectionId: string,
  findingId = "",
): InspectionCorrectiveActionFormValues {
  return {
    inspection: inspectionId,
    finding: findingId,
    assigned_to: "",
    due_date: "",
    status: "open",
    verification_status: "pending",
    notes: "",
  };
}

export function mapCorrectiveActionToFormValues(
  action: InspectionCorrectiveAction,
): InspectionCorrectiveActionFormValues {
  return {
    inspection: action.inspection,
    finding: action.finding,
    assigned_to: action.assigned_to ?? "",
    due_date: formatDateTimeLocalValue(action.due_date),
    status: action.status,
    verification_status: action.verification_status,
    notes: action.notes,
  };
}

export function mapCorrectiveActionFormValuesToCreatePayload(
  values: InspectionCorrectiveActionFormValues,
): InspectionCorrectiveActionCreatePayload {
  return {
    inspection: values.inspection,
    finding: normalizeOptionalValue(values.finding),
    assigned_to: normalizeOptionalValue(values.assigned_to),
    due_date: normalizeDateTime(values.due_date),
    status: values.status,
    verification_status: values.verification_status,
    notes: values.notes.trim(),
  };
}

export function mapCorrectiveActionFormValuesToUpdatePayload(
  values: InspectionCorrectiveActionFormValues,
): InspectionCorrectiveActionUpdatePayload {
  return mapCorrectiveActionFormValuesToCreatePayload(values);
}
