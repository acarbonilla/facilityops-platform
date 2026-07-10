export type InspectionStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "verified"
  | "cancelled"
  | "reopened";

export type InspectionPriority = "low" | "medium" | "high" | "critical";

export type InspectionType =
  | "routine"
  | "audit"
  | "spot_check"
  | "follow_up";

export type InspectionFiveSCategory =
  | "sort"
  | "set_in_order"
  | "shine"
  | "standardize"
  | "sustain";

export type InspectionFindingType =
  | "non_conformance"
  | "observation"
  | "improvement"
  | "hazard";

export type InspectionFindingSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type InspectionFindingStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "verified";

export type InspectionCorrectiveActionStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "verified"
  | "cancelled"
  | "overdue";

export type InspectionCorrectiveActionVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "not_required";

export interface InspectionListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: InspectionStatus;
  priority?: InspectionPriority;
  five_s_category?: InspectionFiveSCategory;
  inspection_type?: InspectionType;
  department?: string;
  building?: string;
  floor?: string;
  area?: string;
  ordering?: string;
}

export interface InspectionListFilters {
  search: string;
  status: InspectionStatus | "";
  priority: InspectionPriority | "";
  fiveSCategory: InspectionFiveSCategory | "";
  inspectionType: InspectionType | "";
  department: string;
  building: string;
  floor: string;
  area: string;
  sort: string;
  pageSize: number;
}

export interface InspectionItem {
  id: string;
  inspection: string;
  sequence: number;
  checklist_item: string;
  category: string;
  expected_result: string;
  max_score: string;
  score: string | null;
  is_pass: boolean | null;
  observation: string;
  notes: string;
}

export interface InspectionFinding {
  id: string;
  inspection: string;
  inspection_number: string;
  item: string | null;
  finding_type: InspectionFindingType;
  severity: InspectionFindingSeverity;
  description: string;
  root_cause: string;
  recommendation: string;
  ai_recommendation: string;
  photo_path: string;
  status: InspectionFindingStatus;
  created_at: string;
  updated_at: string;
}

export interface InspectionAttachment {
  id: string;
  inspection: string;
  finding: string | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  file_name: string;
  file_path: string;
  content_type: string;
  size_bytes: number | null;
  note: string;
  created_at: string;
}

export interface InspectionComment {
  id: string;
  inspection: string;
  author: string | null;
  author_email: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface InspectionHistory {
  id: string;
  inspection: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InspectionStatusHistory {
  id: string;
  inspection: string;
  from_status: InspectionStatus | null;
  to_status: InspectionStatus;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
  action:
    | "schedule"
    | "start"
    | "complete"
    | "verify"
    | "cancel"
    | "reopen"
    | "system";
  reason: string;
  note: string;
}

export interface InspectionCorrectiveAction {
  id: string;
  tenant: string | null;
  inspection: string;
  inspection_number: string;
  finding: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  due_date: string;
  status: InspectionCorrectiveActionStatus;
  completion_date: string | null;
  verification_status: InspectionCorrectiveActionVerificationStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionAIAnalysis {
  id: string;
  inspection: string;
  summary: string;
  analysis: string;
  recommendation_summary: string;
  payload: Record<string, unknown>;
  model_name: string;
  source_notes: string;
  generated_at: string;
  context_preview?: Record<string, unknown> | null;
}

export interface InspectionSLA {
  id: string;
  inspection: string;
  tenant: string | null;
  target_minutes: number;
  warning_minutes: number;
  due_at: string | null;
  verification_due_at: string | null;
  completion_met: boolean | null;
  verification_met: boolean | null;
  completion_breached: boolean;
  verification_breached: boolean;
  sla_status: string;
  last_recalculated_at: string | null;
}

export interface InspectionEscalation {
  id: string;
  tenant: string | null;
  inspection: string;
  sla: string | null;
  corrective_action: string | null;
  escalated_by: string | null;
  escalated_by_email: string | null;
  escalated_to: string | null;
  escalated_to_email: string | null;
  acknowledged_by: string | null;
  acknowledged_by_email: string | null;
  resolved_by: string | null;
  resolved_by_email: string | null;
  acknowledged_at: string | null;
  reason: string;
  escalation_type: string;
  level: string;
  status: string;
  notes: string;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface InspectionListItem {
  id: string;
  inspection_number: string;
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
  title: string;
  inspection_type: InspectionType;
  five_s_category: InspectionFiveSCategory;
  inspection_template: string;
  inspector: string | null;
  inspector_email: string | null;
  supervisor: string | null;
  supervisor_email: string | null;
  status: InspectionStatus;
  priority: InspectionPriority;
  scheduled_date: string | null;
  started_date: string | null;
  completed_date: string | null;
  score: string | null;
  item_count: number;
  finding_count: number;
  open_corrective_action_count: number;
  created_at: string;
  updated_at: string;
}

export interface InspectionDetail extends InspectionListItem {
  remarks: string;
  verified_date: string | null;
  calculated_score: number | string | null;
  items: InspectionItem[];
  findings: InspectionFinding[];
  attachments: InspectionAttachment[];
  comments: InspectionComment[];
  history: InspectionHistory[];
  status_history: InspectionStatusHistory[];
  corrective_actions: InspectionCorrectiveAction[];
  ai_analysis: InspectionAIAnalysis | null;
  ai_analysis_exists: boolean;
  sla: InspectionSLA | null;
  escalations: InspectionEscalation[];
}

export interface InspectionItemFormValues {
  sequence: string;
  checklist_item: string;
  category: string;
  expected_result: string;
  max_score: string;
  score: string;
  is_pass: "" | "true" | "false";
  observation: string;
  notes: string;
}

export interface InspectionFormValues {
  tenant: string;
  organization: string;
  department: string;
  building: string;
  floor: string;
  area: string;
  title: string;
  inspection_type: InspectionType;
  five_s_category: InspectionFiveSCategory;
  inspection_template: string;
  inspector: string;
  supervisor: string;
  priority: InspectionPriority;
  scheduled_date: string;
  remarks: string;
  items: InspectionItemFormValues[];
}

export interface InspectionFindingFormValues {
  inspection: string;
  item: string;
  finding_type: InspectionFindingType;
  severity: InspectionFindingSeverity;
  description: string;
  root_cause: string;
  recommendation: string;
  ai_recommendation: string;
  photo_path: string;
  status: InspectionFindingStatus;
}

export interface InspectionCorrectiveActionFormValues {
  inspection: string;
  finding: string;
  assigned_to: string;
  due_date: string;
  status: InspectionCorrectiveActionStatus;
  verification_status: InspectionCorrectiveActionVerificationStatus;
  notes: string;
}

export interface InspectionAIAnalysisFormValues {
  summary: string;
  analysis: string;
  recommendation_summary: string;
  model_name: string;
  source_notes: string;
  payload_json: string;
}

export interface InspectionItemPayload {
  sequence: number;
  checklist_item: string;
  category?: string;
  expected_result?: string;
  max_score?: string;
  score?: string | null;
  is_pass?: boolean | null;
  observation?: string;
  notes?: string;
}

export interface InspectionCreatePayload {
  tenant: string;
  organization: string;
  department?: string | null;
  building: string;
  floor?: string | null;
  area?: string | null;
  title: string;
  inspection_type: InspectionType;
  five_s_category: InspectionFiveSCategory;
  inspection_template?: string;
  inspector?: string | null;
  supervisor?: string | null;
  priority: InspectionPriority;
  scheduled_date?: string | null;
  remarks?: string;
  items?: InspectionItemPayload[];
}

export type InspectionUpdatePayload = InspectionCreatePayload;

export interface InspectionFindingCreatePayload {
  inspection: string;
  item?: string | null;
  finding_type: InspectionFindingType;
  severity: InspectionFindingSeverity;
  description: string;
  root_cause?: string;
  recommendation?: string;
  ai_recommendation?: string;
  photo_path?: string;
  status: InspectionFindingStatus;
}

export type InspectionFindingUpdatePayload = InspectionFindingCreatePayload;

export interface InspectionCorrectiveActionCreatePayload {
  inspection: string;
  finding?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  status: InspectionCorrectiveActionStatus;
  verification_status: InspectionCorrectiveActionVerificationStatus;
  notes?: string;
}

export type InspectionCorrectiveActionUpdatePayload =
  InspectionCorrectiveActionCreatePayload;

export interface InspectionAIAnalysisPayload {
  summary: string;
  analysis: string;
  recommendation_summary: string;
  model_name: string;
  source_notes: string;
  payload: Record<string, unknown>;
}

export interface InspectionWorkflowAction {
  key: "assign" | "start" | "complete" | "verify" | "cancel" | "reopen";
  label: string;
  description: string;
  to_status: InspectionStatus;
  permission: import("./rbac").PermissionCode;
  requiresDialog: boolean;
}

export interface InspectionSimpleWorkflowPayload {
  note?: string;
}

export interface InspectionAssignPayload extends InspectionSimpleWorkflowPayload {
  inspector?: string | null;
  supervisor?: string | null;
}

export interface InspectionCancelPayload extends InspectionSimpleWorkflowPayload {
  reason: string;
}

export interface InspectionReopenPayload extends InspectionSimpleWorkflowPayload {
  reason: string;
}

export interface InspectionFormOptions {
  tenants: import("./master-data").Tenant[];
  organizations: import("./master-data").Organization[];
  departments: import("./master-data").Department[];
  buildings: import("./master-data").Building[];
  floors: import("./master-data").Floor[];
  areas: import("./master-data").Area[];
  supports_user_directory: boolean;
  user_directory_note: string | null;
}
