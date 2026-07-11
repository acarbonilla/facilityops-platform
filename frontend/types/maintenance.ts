export type MaintenanceWorkOrderStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "reopened"
  | "closed";

export type MaintenanceWorkOrderPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type MaintenanceCategory =
  | "preventive"
  | "corrective"
  | "emergency"
  | "inspection"
  | "installation"
  | "other";

export type MaintenanceType =
  | "planned"
  | "reactive"
  | "preventive"
  | "predictive"
  | "breakdown"
  | "other";

export type MaintenanceSlaStatus =
  | "not_started"
  | "within_sla"
  | "at_risk"
  | "breached"
  | "met"
  | "missed"
  | "not_applicable"
  | "warning"
  | "paused"
  | "completed"
  | "cancelled";

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
  is_overdue?: boolean;
  sla_status?: MaintenanceSlaStatus;
  has_active_escalation?: boolean;
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
  slaStatus: MaintenanceSlaStatus | "";
  hasActiveEscalation: boolean;
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
  sla_status: MaintenanceSlaStatus;
  sla_is_overdue: boolean;
  has_active_escalation: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceAssignment {
  id: string;
  work_order: string;
  tenant: string | null;
  assigned_to: string | null;
  assigned_to_email: string | null;
  supervisor: string | null;
  supervisor_email: string | null;
  previous_assigned_to: string | null;
  previous_assigned_to_email: string | null;
  previous_supervisor: string | null;
  previous_supervisor_email: string | null;
  assigned_by: string | null;
  assigned_by_email: string | null;
  assignment_type: "technician" | "supervisor" | "combined" | "unassigned";
  assignment_status:
    | "assigned"
    | "reassigned"
    | "unassigned"
    | "accepted"
    | "declined"
    | "completed";
  reason: string;
  note: string;
  notes: string;
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
  tenant: string | null;
  priority: MaintenanceWorkOrderPriority;
  response_target_minutes: number;
  completion_target_minutes: number;
  response_due_at: string | null;
  resolution_due_at: string | null;
  completion_due_at: string | null;
  first_responded_at: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  completed_at: string | null;
  response_met: boolean | null;
  resolution_met: boolean | null;
  response_breached: boolean;
  completion_breached: boolean;
  sla_status: MaintenanceSlaStatus;
  is_overdue: boolean;
  last_recalculated_at: string | null;
}

export interface MaintenanceStatusHistory {
  id: string;
  work_order: string;
  from_status: MaintenanceWorkOrderStatus | null;
  to_status: MaintenanceWorkOrderStatus;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
  action:
    | "submit"
    | "assign"
    | "start"
    | "hold"
    | "resume"
    | "complete"
    | "cancel"
    | "reopen"
    | "system";
  reason: string;
  note: string;
}

export interface MaintenanceEscalation {
  id: string;
  work_order: string;
  tenant: string | null;
  sla: string | null;
  escalated_by: string | null;
  escalated_by_email: string | null;
  escalated_to: string | null;
  escalated_to_email: string | null;
  reason: string;
  escalation_type:
    | "response_warning"
    | "response_breach"
    | "completion_warning"
    | "completion_breach";
  level: string;
  status: "open" | "acknowledged" | "resolved" | "cancelled";
  acknowledged_by: string | null;
  acknowledged_by_email: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_by_email: string | null;
  is_active: boolean;
  resolved_at: string | null;
  notes: string;
  created_at: string;
}

export interface MaintenanceEscalationActionPayload {
  notes?: string;
}

export interface MaintenanceCompletion {
  id: string;
  work_order: string;
  completed_by: string | null;
  completed_by_email: string | null;
  completion_notes: string;
  resolution_summary: string;
  actual_hours: string | null;
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

export interface MaintenanceTaskFormValues {
  title: string;
  description: string;
  estimated_hours: string;
  sequence: string;
  required: boolean;
}

export interface MaintenanceMaterialFormValues {
  name: string;
  quantity: string;
  unit: string;
  estimated_cost: string;
  notes: string;
}

export interface MaintenanceLaborFormValues {
  estimated_hours: string;
  rate: string;
  notes: string;
}

export interface MaintenanceWorkOrderFormValues {
  tenant: string;
  organization: string;
  department: string;
  requested_by: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  maintenance_type: MaintenanceType;
  priority: MaintenanceWorkOrderPriority;
  notes: string;
  asset: string;
  building: string;
  floor: string;
  area: string;
  location_description: string;
  requested_at: string;
  due_at: string;
  estimated_start_at: string;
  estimated_completion_at: string;
  estimated_hours: string;
  assignment_team: string;
  tasks: MaintenanceTaskFormValues[];
  materials: MaintenanceMaterialFormValues[];
  labor: MaintenanceLaborFormValues[];
}

export interface MaintenanceWorkOrderCreatePayload {
  tenant: string;
  organization: string;
  department?: string | null;
  building: string;
  floor?: string | null;
  area?: string | null;
  asset: string;
  title: string;
  description: string;
  priority: MaintenanceWorkOrderPriority;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  due_at?: string | null;
}

export interface MaintenanceWorkOrderUpdatePayload
  extends MaintenanceWorkOrderCreatePayload {
  cancellation_reason?: string;
}

export interface MaintenanceFormOptions {
  tenants: import("./master-data").Tenant[];
  organizations: import("./master-data").Organization[];
  departments: import("./master-data").Department[];
  buildings: import("./master-data").Building[];
  floors: import("./master-data").Floor[];
  areas: import("./master-data").Area[];
  assets: import("./master-data").Asset[];
  supports_attachments: boolean;
  supports_save_draft: boolean;
  supports_assignment_persistence: boolean;
  supports_task_persistence: boolean;
  supports_material_persistence: boolean;
  supports_labor_persistence: boolean;
  supports_requester_selection: boolean;
}

export interface MaintenanceWorkflowAction {
  key:
    | "submit"
    | "start"
    | "hold"
    | "resume"
    | "complete"
    | "cancel"
    | "reopen";
  label: string;
  description: string;
  to_status: MaintenanceWorkOrderStatus;
  permission: string;
  requiresDialog: boolean;
}

export interface MaintenanceAssignPayload {
  assigned_to: string;
  supervisor?: string | null;
  notes?: string;
}

export interface MaintenanceReassignPayload extends MaintenanceAssignPayload {
  reason: string;
}

export interface MaintenanceUnassignPayload {
  reason: string;
  notes?: string;
}

export interface MaintenanceAssignmentCandidate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

export interface MaintenanceSimpleWorkflowPayload {
  note?: string;
}

export interface MaintenanceHoldPayload {
  reason: string;
  notes?: string;
}

export interface MaintenanceCompletePayload {
  completion_notes: string;
  actual_hours: string;
  completed_at?: string;
  resolution_summary?: string;
  downtime_minutes?: number;
  follow_up_required?: boolean;
}

export interface MaintenanceCancelPayload {
  reason: string;
  notes?: string;
}

export interface MaintenanceReopenPayload {
  reason: string;
  notes?: string;
}
