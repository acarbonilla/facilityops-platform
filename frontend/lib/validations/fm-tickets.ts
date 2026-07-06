import { z } from "zod";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const optionalString = z.string().trim();

const FM_TICKET_STATUS_VALUES = [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
] as const;

const FM_TICKET_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

const FM_TICKET_CATEGORY_VALUES = [
  "electrical",
  "plumbing",
  "hvac",
  "civil",
  "safety",
  "cleaning",
  "security",
  "other",
] as const;

const FM_TICKET_SOURCE_VALUES = [
  "web",
  "mobile",
  "admin",
  "inspection",
  "system",
] as const;

export const fmTicketSchema = z.object({
  title: requiredString("Title"),
  description: requiredString("Description"),
  tenant: requiredString("Tenant"),
  organization: requiredString("Organization"),
  department: optionalString,
  building: requiredString("Building"),
  floor: optionalString,
  area: optionalString,
  asset: optionalString,
  priority: z.enum(FM_TICKET_PRIORITY_VALUES),
  category: z.enum(FM_TICKET_CATEGORY_VALUES),
  source: z.enum(FM_TICKET_SOURCE_VALUES),
  status: z.enum(FM_TICKET_STATUS_VALUES),
  assignee: optionalString.optional(),
  due_at: optionalString,
});

export const fmTicketCommentSchema = z.object({
  body: z.string().trim().min(3, "Comment body must be at least 3 characters."),
  is_internal: z.boolean().optional(),
});

export const fmTicketAssignmentSchema = z.object({
  assignee: requiredString("Assignee"),
  note: optionalString.optional(),
});

export const fmTicketStatusUpdateSchema = z.object({
  to_status: z.enum(FM_TICKET_STATUS_VALUES),
  note: optionalString,
});
