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
  finding_type: string;
  severity: string;
  description: string;
  root_cause: string;
  recommendation: string;
  ai_recommendation: string;
  photo_path: string;
  status: string;
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

export interface InspectionCorrectiveAction {
  id: string;
  tenant: string | null;
  inspection: string;
  inspection_number: string;
  finding: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  due_date: string;
  status: string;
  completion_date: string | null;
  verification_status: string;
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
  corrective_actions: InspectionCorrectiveAction[];
  ai_analysis: InspectionAIAnalysis | null;
  sla: InspectionSLA | null;
  escalations: InspectionEscalation[];
}
