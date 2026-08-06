export type ProjectStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "on_hold"
  | "delayed"
  | "completed"
  | "cancelled";

export type ProjectPriority = "low" | "medium" | "high" | "critical";

export type ProjectMemberRole = "project_manager" | "member" | "viewer";

export interface ProjectListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  organization?: string;
  building?: string;
  project_manager?: string;
  planned_start_date_from?: string;
  planned_start_date_to?: string;
  planned_end_date_from?: string;
  planned_end_date_to?: string;
  ordering?: string;
}

export interface ProjectListFilters {
  search: string;
  status: ProjectStatus | "";
  priority: ProjectPriority | "";
  organization: string;
  building: string;
  projectManager: string;
  plannedStartFrom: string;
  plannedStartTo: string;
  plannedEndFrom: string;
  plannedEndTo: string;
  sort: string;
  pageSize: number;
}

export interface ProjectMetrics {
  total: number;
  draft: number;
  planned: number;
  in_progress: number;
  on_hold: number;
  delayed: number;
  completed: number;
  cancelled: number;
}

export interface ProjectMember {
  id: string;
  tenant: string;
  project: string;
  user: string;
  user_email: string;
  user_name: string;
  role: ProjectMemberRole;
  is_active: boolean;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberCreatePayload {
  user: string;
  role?: ProjectMemberRole;
}

export interface ProjectHistory {
  id: string;
  project: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProjectListItem {
  id: string;
  tenant: string;
  organization: string;
  organization_name: string;
  building: string | null;
  building_name: string | null;
  project_code: string;
  name: string;
  description: string;
  project_manager: string | null;
  project_manager_email: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  completion_percentage: string | number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends ProjectListItem {
  members: ProjectMember[];
  recent_history: ProjectHistory[];
}

export interface ProjectFormValues {
  organization: string;
  building: string;
  project_code: string;
  name: string;
  description: string;
  project_manager: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
}

export interface ProjectCreatePayload {
  organization: string;
  building?: string | null;
  project_code?: string;
  name: string;
  description?: string;
  project_manager?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export type ProjectUpdatePayload = ProjectCreatePayload;

export interface ProjectFormOptions {
  organizations: import("./master-data").Organization[];
  buildings: import("./master-data").Building[];
  supports_user_directory: boolean;
  user_directory_note: string | null;
}
