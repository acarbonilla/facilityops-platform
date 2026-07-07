export type MaintenanceWorkOrderStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "closed";

export type MaintenanceWorkOrderPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type MaintenanceSlaStatus =
  | "not_started"
  | "within_sla"
  | "at_risk"
  | "breached"
  | "met"
  | "missed"
  | "not_applicable";

export type MaintenanceTimelineEventType =
  | "history"
  | "status"
  | "assignment"
  | "completion"
  | "escalation";

export interface MaintenanceDashboard {
  total_work_orders: number;
  open: number;
  assigned: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  high_priority: number;
  critical: number;
  recently_updated: number;
}

export interface MaintenanceListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: MaintenanceWorkOrderStatus;
  priority?: MaintenanceWorkOrderPriority;
  department?: string;
  building?: string;
  floor?: string;
  area?: string;
  assignee?: string;
  assignee_email?: string;
  requester_email?: string;
  overdue?: boolean;
  has_attachments?: boolean;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  due_from?: string;
  due_to?: string;
  ordering?: string;
}

export interface MaintenanceListFilters {
  search: string;
  status: MaintenanceWorkOrderStatus | "";
  priority: MaintenanceWorkOrderPriority | "";
  department: string;
  building: string;
  floor: string;
  area: string;
  assigneeEmail: string;
  requesterEmail: string;
  overdue: boolean;
  hasAttachments: boolean;
  createdFrom: string;
  createdTo: string;
  sort: string;
  pageSize: number;
}

export interface MaintenanceWorkOrderListItem {
  id: string;
  work_order_number: string;
  tenant: string;
  tenant_name: string;
  organization: string;
  organization_name: string;
  department: string | null;
  department_name: string | null;
  building: string;
  building_name: string;
  floor: string | null;
  floor_name: string | null;
  area: string | null;
  area_name: string | null;
  asset: string;
  asset_name: string;
  asset_code: string;
  title: string;
  priority: MaintenanceWorkOrderPriority;
  status: MaintenanceWorkOrderStatus;
  requester: string;
  requester_email: string;
  assignee: string | null;
  assignee_email: string | null;
  requested_at: string;
  due_at: string | null;
  attachments_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceAssignment {
  id: string;
  work_order: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  assigned_by: string | null;
  assigned_by_email: string | null;
  note: string;
  assigned_at: string;
  is_active: boolean;
  unassigned_at: string | null;
}

export interface MaintenanceTask {
  id: string;
  work_order: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  title: string;
  description: string;
  sequence: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  completed_at: string | null;
}

export interface MaintenanceMaterial {
  id: string;
  work_order: string;
  task: string | null;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

export interface MaintenanceLabor {
  id: string;
  work_order: string;
  task: string | null;
  performed_by: string | null;
  performed_by_email: string | null;
  description: string;
  hours: string;
  labor_date: string;
}

export interface MaintenanceAttachment {
  id: string;
  work_order: string;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  file_name: string;
  file_path: string;
  content_type: string;
  size_bytes: number | null;
  note: string;
  created_at: string;
}

export interface MaintenanceAiSummary {
  id: string;
  work_order: string;
  summary: string;
  model_name: string;
  source_notes: string;
  generated_at: string;
}

export interface MaintenanceSla {
  id: string;
  work_order: string;
  response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  response_met: boolean | null;
  resolution_met: boolean | null;
  sla_status: MaintenanceSlaStatus;
}

export interface MaintenanceStatusHistory {
  id: string;
  work_order: string;
  from_status: MaintenanceWorkOrderStatus | null;
  to_status: MaintenanceWorkOrderStatus;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
  note: string;
}

export interface MaintenanceEscalation {
  id: string;
  work_order: string;
  escalated_by: string | null;
  escalated_by_email: string | null;
  escalated_to: string | null;
  escalated_to_email: string | null;
  reason: string;
  level: string;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface MaintenanceCompletion {
  id: string;
  work_order: string;
  completed_by: string | null;
  completed_by_email: string | null;
  completion_notes: string;
  resolution_summary: string;
  downtime_minutes: number | null;
  follow_up_required: boolean;
  completed_at: string;
}

export interface MaintenanceSupervisorApproval {
  id: string;
  work_order: string;
  approved_by: string | null;
  approved_by_email: string | null;
  status: "pending" | "approved" | "rejected";
  comments: string;
  approved_at: string | null;
}

export interface MaintenanceHistory {
  id: string;
  work_order: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MaintenanceWorkOrderDetail
  extends MaintenanceWorkOrderListItem {
  description: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  cancellation_reason: string;
  assignments: MaintenanceAssignment[];
  tasks: MaintenanceTask[];
  materials: MaintenanceMaterial[];
  labor_entries: MaintenanceLabor[];
  completion_record: MaintenanceCompletion | null;
  sla: MaintenanceSla | null;
  status_history: MaintenanceStatusHistory[];
  escalations: MaintenanceEscalation[];
  attachments: MaintenanceAttachment[];
  ai_summary: MaintenanceAiSummary | null;
  supervisor_approval: MaintenanceSupervisorApproval | null;
}

export interface MaintenanceTimelineEvent {
  id: string;
  type: MaintenanceTimelineEventType;
  title: string;
  description: string;
  actor: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}
