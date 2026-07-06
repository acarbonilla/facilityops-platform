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

export interface FmTicketListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: FmTicketStatus;
  priority?: FmTicketPriority;
  category?: FmTicketCategory;
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

export interface FmTicketDetail extends FmTicketBaseRecord {
  department: string | null;
  department_name: string | null;
  description: string;
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
