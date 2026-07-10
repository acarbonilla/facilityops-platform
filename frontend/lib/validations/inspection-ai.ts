import { z } from "zod";

function parseJsonObject(value: string) {
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
      return false;
    }
    return parsed;
  } catch {
    return false;
  }
}

export const inspectionAIAnalysisFormSchema = z
  .object({
    summary: z.string().trim(),
    analysis: z.string().trim(),
    recommendation_summary: z.string().trim(),
    model_name: z.string().trim(),
    source_notes: z.string().trim(),
    payload_json: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (
      !values.summary &&
      !values.analysis &&
      !values.recommendation_summary
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one of summary, analysis, or recommendation summary is required.",
        path: ["summary"],
      });
    }

    const parsedPayload = parseJsonObject(values.payload_json);
    if (parsedPayload === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payload JSON must be a valid JSON object.",
        path: ["payload_json"],
      });
    }
  });
