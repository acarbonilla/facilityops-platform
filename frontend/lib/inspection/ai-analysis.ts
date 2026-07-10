import type {
  InspectionAIAnalysis,
  InspectionAIAnalysisFormValues,
  InspectionAIAnalysisPayload,
} from "@/types/inspection";

function normalizeOptionalString(value: string): string {
  return value.trim();
}

function formatJsonObject(value: Record<string, unknown>): string {
  return Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : "";
}

export function safeParseInspectionAIAnalysisJson(
  value: string,
): Record<string, unknown> | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createEmptyInspectionAIAnalysisFormValues(): InspectionAIAnalysisFormValues {
  return {
    summary: "",
    analysis: "",
    recommendation_summary: "",
    model_name: "manual",
    source_notes: "",
    payload_json: "",
  };
}

export function mapInspectionAIAnalysisToFormValues(
  aiAnalysis?: InspectionAIAnalysis | null,
): InspectionAIAnalysisFormValues {
  if (!aiAnalysis) {
    return createEmptyInspectionAIAnalysisFormValues();
  }

  return {
    summary: aiAnalysis.summary,
    analysis: aiAnalysis.analysis,
    recommendation_summary: aiAnalysis.recommendation_summary,
    model_name: aiAnalysis.model_name || "manual",
    source_notes: aiAnalysis.source_notes,
    payload_json: formatJsonObject(aiAnalysis.payload),
  };
}

export function mapInspectionAIAnalysisFormValuesToPayload(
  values: InspectionAIAnalysisFormValues,
): InspectionAIAnalysisPayload {
  return {
    summary: normalizeOptionalString(values.summary),
    analysis: normalizeOptionalString(values.analysis),
    recommendation_summary: normalizeOptionalString(values.recommendation_summary),
    model_name: normalizeOptionalString(values.model_name) || "manual",
    source_notes: normalizeOptionalString(values.source_notes),
    payload: safeParseInspectionAIAnalysisJson(values.payload_json) ?? {},
  };
}
