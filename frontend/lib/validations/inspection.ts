import { z } from "zod";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const optionalString = z.string().trim();

const inspectionItemSchema = z.object({
  sequence: optionalString,
  checklist_item: optionalString,
  category: optionalString,
  expected_result: optionalString,
  max_score: optionalString,
  score: optionalString,
  is_pass: z.enum(["", "true", "false"]),
  observation: optionalString,
  notes: optionalString,
});

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

function parseNumber(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = Number(trimmedValue);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return parsed;
}

function itemHasContent(item: z.infer<typeof inspectionItemSchema>) {
  return Boolean(
    item.sequence ||
      item.checklist_item ||
      item.category ||
      item.expected_result ||
      item.max_score ||
      item.score ||
      item.observation ||
      item.notes,
  );
}

export const inspectionFormSchema = z
  .object({
    tenant: requiredString("Tenant"),
    organization: requiredString("Organization"),
    department: optionalString,
    building: requiredString("Building"),
    floor: optionalString,
    area: optionalString,
    title: requiredString("Title"),
    inspection_type: z.enum(["routine", "audit", "spot_check", "follow_up"]),
    five_s_category: z.enum([
      "sort",
      "set_in_order",
      "shine",
      "standardize",
      "sustain",
    ]),
    inspection_template: optionalString,
    inspector: optionalString,
    supervisor: optionalString,
    priority: z.enum(["low", "medium", "high", "critical"]),
    scheduled_date: optionalString,
    remarks: optionalString,
    items: z.array(inspectionItemSchema),
  })
  .superRefine((values, ctx) => {
    const scheduledDate = parseDate(values.scheduled_date);
    if (typeof scheduledDate === "number" && Number.isNaN(scheduledDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled date must be a valid date and time.",
        path: ["scheduled_date"],
      });
    }

    values.items.forEach((item, index) => {
      if (!itemHasContent(item)) {
        return;
      }

      if (!item.checklist_item) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Checklist item is required.",
          path: ["items", index, "checklist_item"],
        });
      }

      const sequence = parseNumber(item.sequence);
      if (sequence !== null && !(sequence > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sequence must be a positive number.",
          path: ["items", index, "sequence"],
        });
      }

      const maxScore = parseNumber(item.max_score);
      if (maxScore !== null && !(maxScore > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max score must be a positive number.",
          path: ["items", index, "max_score"],
        });
      }

      const score = parseNumber(item.score);
      if (score !== null) {
        if (Number.isNaN(score)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Score must be a valid number.",
            path: ["items", index, "score"],
          });
        }

        if (maxScore === null || Number.isNaN(maxScore)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide a valid max score before entering a score.",
            path: ["items", index, "max_score"],
          });
        } else if (score < 0 || score > maxScore) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Score must be between 0 and the max score.",
            path: ["items", index, "score"],
          });
        }

        if (item.is_pass === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pass / fail is required when a score is provided.",
            path: ["items", index, "is_pass"],
          });
        }
      }
    });
  });
