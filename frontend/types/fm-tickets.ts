export type FmTicketStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "resolved"
  | "closed"
  | "cancelled";

export type FmTicketPriority = "low" | "medium" | "high" | "urgent";

export type FmTicketCategory =
  | "electrical"
  | "plumbing"
  | "hvac"
  | "civil"
  | "safety"
  | "cleaning"
  | "security"
  | "other";

export type FmTicketSource =
  | "web"
  | "mobile"
  | "admin"
  | "inspection"
  | "system";

export type FmTicketSlaStatus =
  | "not_started"
  | "within_sla"
  | "at_risk"
  | "breached"
  | "met"
  | "missed"
  | "not_applicable";

export type FmTicketEscalationLevel =
  | "level_1"
  | "level_2"
  | "level_3"
  | "management";

export const FM_TICKET_WORKFLOW_STATUSES: FmTicketStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
];

export interface FmTicketListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: FmTicketStatus;
  priority?: FmTicketPriority;
  category?: FmTicketCategory;
  organization?: string;
  building?: string;
  assignee?: string;
}

export interface FmTicketFormOption {
  value: string;
  label: string;
}

interface FmTicketBaseRecord {
  id: string;
  ticket_number: string;
  tenant: string;
  tenant_name: string;
  organization: string;
  organization_name: string;
  building: string;
  building_name: string;
  floor: string | null;
  floor_name: string | null;
  area: string | null;
  area_name: string | null;
  asset: string | null;
  asset_name: string | null;
  title: string;
  category: FmTicketCategory;
  priority: FmTicketPriority;
  status: FmTicketStatus;
  source: FmTicketSource;
  requester: string;
  requester_email: string;
  assignee: string | null;
  assignee_email: string | null;
  reported_at: string;
  due_at: string | null;
}

export type FmTicketListItem = FmTicketBaseRecord;

export interface FmTicketSla {
  response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  response_met: boolean | null;
  resolution_met: boolean | null;
  sla_status: FmTicketSlaStatus;
}

export interface FmTicketEscalation {
  id: string;
  ticket: string;
  escalated_by: string | null;
  escalated_by_email: string | null;
  escalated_to: string | null;
  escalated_to_email: string | null;
  reason: string;
  level: FmTicketEscalationLevel;
  created_at: string;
  is_active: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_email: string | null;
}

export interface LinkedMaintenanceWorkOrderSummary {
  id: string;
  work_order_number: string;
  status: string;
  title: string;
}

export interface GeneratedWorkOrderSummary {
  id: string;
  work_order_number: string;
  status: string;
  title: string;
  source_ticket_id: string;
}

export interface FmTicketDetail extends FmTicketBaseRecord {
  department: string | null;
  department_name: string | null;
  description: string;
  sla: FmTicketSla;
  escalation_history: FmTicketEscalation[];
  linked_work_order: LinkedMaintenanceWorkOrderSummary | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FmTicket = FmTicketDetail;

export interface FmTicketComment {
  id: string;
  ticket: string;
  author: string;
  author_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface FmTicketHistory {
  id: string;
  ticket: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FmTicketStatusHistory {
  id: string;
  ticket: string;
  from_status: FmTicketStatus | null;
  to_status: FmTicketStatus;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
  note: string;
}

export interface FmTicketCommentCreatePayload {
  body: string;
  is_internal?: boolean;
}

export interface FmTicketAssignmentPayload {
  assignee: string;
  note?: string;
}

export type FmTicketAssignmentResponse = FmTicketDetail;

export interface FmTicketAssigneeOption {
  value: string;
  label: string;
  email: string;
  is_active?: boolean;
  is_technician?: boolean;
}

export type FmTicketAssignmentState =
  | "read_only"
  | "unavailable"
  | "directory_unavailable"
  | "ready";

export interface FmTicketStatusUpdatePayload {
  to_status: FmTicketStatus;
  note?: string;
}

export interface FmTicketEscalationPayload {
  escalated_to?: string;
  reason: string;
  level: FmTicketEscalationLevel;
}

export interface FmTicketStatusTransition {
  from: FmTicketStatus;
  to: FmTicketStatus[];
}

export interface FmTicketWorkflowAction {
  label: string;
  to_status: FmTicketStatus;
  requiresClosePermission: boolean;
}

export interface FmTicketCreatePayload {
  tenant: string;
  organization: string;
  department?: string | null;
  building: string;
  floor?: string | null;
  area?: string | null;
  asset?: string | null;
  title: string;
  description: string;
  category: FmTicketCategory;
  priority: FmTicketPriority;
  source: FmTicketSource;
  due_at?: string | null;
}

export type FmTicketUpdatePayload = FmTicketCreatePayload;

export interface FmTicketFormValues {
  tenant: string;
  organization: string;
  department: string;
  building: string;
  floor: string;
  area: string;
  asset: string;
  title: string;
  description: string;
  category: FmTicketCategory;
  priority: FmTicketPriority;
  source: FmTicketSource;
  due_at: string;
  status: FmTicketStatus;
  assignee?: string;
}

export const FM_TICKET_STATUS_TRANSITIONS: FmTicketStatusTransition[] = [
  {
    from: "open",
    to: ["assigned", "in_progress", "on_hold", "cancelled"],
  },
  {
    from: "assigned",
    to: ["in_progress", "on_hold", "resolved", "cancelled"],
  },
  {
    from: "in_progress",
    to: ["on_hold", "resolved", "cancelled"],
  },
  {
    from: "on_hold",
    to: ["in_progress", "cancelled"],
  },
  {
    from: "resolved",
    to: ["closed", "in_progress"],
  },
  {
    from: "closed",
    to: [],
  },
  {
    from: "cancelled",
    to: [],
  },
  {
    from: "draft",
    to: ["open", "cancelled"],
  },
];
