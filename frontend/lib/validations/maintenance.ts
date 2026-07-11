import { z } from "zod";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const optionalString = z.string().trim();

const maintenanceTaskSchema = z.object({
  title: optionalString,
  description: optionalString,
  estimated_hours: optionalString,
  sequence: optionalString,
  required: z.boolean(),
});

const maintenanceMaterialSchema = z.object({
  name: optionalString,
  quantity: optionalString,
  unit: optionalString,
  estimated_cost: optionalString,
  notes: optionalString,
});

const maintenanceLaborSchema = z.object({
  estimated_hours: optionalString,
  rate: optionalString,
  notes: optionalString,
});

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

function parsePositiveNumber(value: string) {
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

function taskHasContent(task: z.infer<typeof maintenanceTaskSchema>) {
  return Boolean(
    task.title ||
      task.description ||
      task.estimated_hours ||
      task.sequence,
  );
}

function materialHasContent(material: z.infer<typeof maintenanceMaterialSchema>) {
  return Boolean(
    material.name ||
      material.quantity ||
      material.unit ||
      material.estimated_cost ||
      material.notes,
  );
}

function laborHasContent(labor: z.infer<typeof maintenanceLaborSchema>) {
  return Boolean(
    labor.estimated_hours ||
      labor.rate ||
      labor.notes,
  );
}

export const maintenanceWorkOrderSchema = z
  .object({
    tenant: requiredString("Tenant"),
    organization: requiredString("Organization"),
    department: optionalString,
    requested_by: requiredString("Requested by"),
    title: requiredString("Title"),
    description: requiredString("Description"),
    category: z.enum([
      "preventive",
      "corrective",
      "emergency",
      "inspection",
      "installation",
      "other",
    ]),
    maintenance_type: z.enum([
      "planned",
      "reactive",
      "preventive",
      "predictive",
      "breakdown",
      "other",
    ]),
    priority: z.enum(["low", "medium", "high", "critical"]),
    notes: optionalString,
    asset: optionalString,
    building: optionalString,
    floor: optionalString,
    area: optionalString,
    location_description: optionalString,
    requested_at: requiredString("Requested date"),
    due_at: requiredString("Due date"),
    estimated_start_at: optionalString,
    estimated_completion_at: optionalString,
    estimated_hours: optionalString,
    assignment_team: optionalString,
    tasks: z.array(maintenanceTaskSchema),
    materials: z.array(maintenanceMaterialSchema),
    labor: z.array(maintenanceLaborSchema),
  })
  .superRefine((values, ctx) => {
    if (
      !values.asset &&
      !values.building &&
      !values.floor &&
      !values.area &&
      !values.location_description
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an asset or provide location context.",
        path: ["asset"],
      });
    }

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
        message: "Estimated completion date cannot be before estimated start date.",
        path: ["estimated_completion_at"],
      });
    }

    const estimatedHours = parsePositiveNumber(values.estimated_hours);
    if (estimatedHours !== null && !(estimatedHours > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated hours must be positive.",
        path: ["estimated_hours"],
      });
    }

    values.tasks.forEach((task, index) => {
      if (!taskHasContent(task)) {
        return;
      }

      if (!task.title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Task name is required.",
          path: ["tasks", index, "title"],
        });
      }

      const taskHours = parsePositiveNumber(task.estimated_hours);
      if (taskHours === null || !(taskHours > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Task estimated hours must be positive.",
          path: ["tasks", index, "estimated_hours"],
        });
      }

      const taskSequence = parsePositiveNumber(task.sequence);
      if (taskSequence === null || !(taskSequence > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sequence must be a positive number.",
          path: ["tasks", index, "sequence"],
        });
      }
    });

    values.materials.forEach((material, index) => {
      if (!materialHasContent(material)) {
        return;
      }

      if (!material.name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Material name is required.",
          path: ["materials", index, "name"],
        });
      }

      const quantity = parsePositiveNumber(material.quantity);
      if (quantity === null || !(quantity > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Material quantity must be positive.",
          path: ["materials", index, "quantity"],
        });
      }
    });

    values.labor.forEach((entry, index) => {
      if (!laborHasContent(entry)) {
        return;
      }

      const laborHours = parsePositiveNumber(entry.estimated_hours);
      if (laborHours === null || !(laborHours > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Labor estimated hours must be positive.",
          path: ["labor", index, "estimated_hours"],
        });
      }
    });
  });
