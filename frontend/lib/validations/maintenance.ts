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
    return null;
  }

  return parsed;
}

export const maintenanceWorkOrderSchema = z
  .object({
    tenant: requiredString("Tenant"),
    organization: requiredString("Organization"),
    department: optionalString,
    requested_by: requiredString("Requested by"),
    title: requiredString("Title"),
    description: requiredString("Description"),
    priority: z.enum(["low", "medium", "high", "critical"]),
    asset: requiredString("Asset"),
    building: requiredString("Building"),
    floor: optionalString,
    area: optionalString,
    requested_at: requiredString("Requested date"),
    due_at: requiredString("Due date"),
    estimated_start_at: optionalString,
    estimated_completion_at: optionalString,
  })
  .superRefine((values, ctx) => {
    const requestedAt = parseDate(values.requested_at);
    const dueAt = parseDate(values.due_at);
    if (requestedAt && dueAt && dueAt < requestedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Due date cannot be before requested date.",
        path: ["due_at"],
      });
    }

    const estimatedStartAt = parseDate(values.estimated_start_at);
    const estimatedCompletionAt = parseDate(values.estimated_completion_at);
    if (
      estimatedStartAt &&
      estimatedCompletionAt &&
      estimatedCompletionAt < estimatedStartAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Estimated completion date cannot be before estimated start date.",
        path: ["estimated_completion_at"],
      });
    }
  });
