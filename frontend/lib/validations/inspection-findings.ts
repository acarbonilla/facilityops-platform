import { z } from "zod";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const optionalString = z.string().trim();

function parseDate(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return Number.NaN;
  }

  return parsed;
}

export const inspectionFindingFormSchema = z.object({
  inspection: requiredString("Inspection"),
  item: optionalString,
  finding_type: z.enum([
    "non_conformance",
    "observation",
    "improvement",
    "hazard",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: requiredString("Description"),
  root_cause: optionalString,
  recommendation: optionalString,
  ai_recommendation: optionalString,
  photo_path: optionalString,
  status: z.enum(["open", "in_progress", "resolved", "verified"]),
});

export const inspectionCorrectiveActionFormSchema = z
  .object({
    inspection: requiredString("Inspection"),
    finding: optionalString,
    assigned_to: optionalString,
    due_date: optionalString,
    status: z.enum([
      "open",
      "in_progress",
      "completed",
      "verified",
      "cancelled",
      "overdue",
    ]),
    verification_status: z.enum([
      "pending",
      "verified",
      "rejected",
      "not_required",
    ]),
    notes: optionalString,
  })
  .superRefine((values, ctx) => {
    const dueDate = parseDate(values.due_date);
    if (typeof dueDate === "number" && Number.isNaN(dueDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Due date must be a valid date and time.",
        path: ["due_date"],
      });
    }
  });
