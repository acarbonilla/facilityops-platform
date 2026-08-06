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

export interface ProjectTaskSummary {
  total: number;
  not_started: number;
  in_progress: number;
  blocked: number;
  on_hold: number;
  completed: number;
  cancelled: number;
}

export interface ProjectDetail extends ProjectListItem {
  members: ProjectMember[];
  recent_history: ProjectHistory[];
  task_summary?: ProjectTaskSummary;
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

// ---------------------------------------------------------------------------
// FO-104 Project tasks
// ---------------------------------------------------------------------------

export type ProjectTaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ProjectTaskPriority = "low" | "medium" | "high" | "critical";

export interface ProjectTaskListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  person_in_charge?: string;
  is_milestone?: boolean;
  planned_start_from?: string;
  planned_start_to?: string;
  planned_end_from?: string;
  planned_end_to?: string;
  actual_start_from?: string;
  actual_start_to?: string;
  actual_end_from?: string;
  actual_end_to?: string;
  progress_min?: string | number;
  progress_max?: string | number;
  delayed?: boolean;
  dependency_blocked?: boolean;
  unscheduled?: boolean;
  ordering?: string;
}

export interface ProjectTaskListFilters {
  search: string;
  status: ProjectTaskStatus | "";
  priority: ProjectTaskPriority | "";
  personInCharge: string;
  isMilestone: "" | "true" | "false";
  delayed: "" | "true" | "false";
  dependencyBlocked: "" | "true" | "false";
  unscheduled: "" | "true" | "false";
  plannedStartFrom: string;
  plannedStartTo: string;
  plannedEndFrom: string;
  plannedEndTo: string;
  progressMin: string;
  progressMax: string;
  sort: string;
  pageSize: number;
}

/** FO-105 derived readiness + delay fields on task list/detail. */
export interface ProjectTaskDerivedFields {
  is_dependency_ready: boolean;
  blocking_predecessor_count: number;
  predecessor_count: number;
  successor_count: number;
  is_delayed: boolean;
  is_completed_late: boolean;
  delay_days: number;
}

export interface ProjectTaskListItem extends ProjectTaskDerivedFields {
  id: string;
  tenant: string;
  project: string;
  task_code: string;
  name: string;
  description: string;
  person_in_charge: string | null;
  person_in_charge_email: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_percentage: string | number;
  sequence: number;
  is_milestone: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskChecklistItem {
  id: string;
  task: string;
  text: string;
  is_completed: boolean;
  sequence: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskComment {
  id: string;
  task: string;
  author: string;
  author_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskDetail extends ProjectTaskListItem {
  checklist_items: ProjectTaskChecklistItem[];
  comments: ProjectTaskComment[];
  comments_count: number;
}

export interface ProjectTaskFormValues {
  name: string;
  description: string;
  person_in_charge: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  planned_start: string;
  planned_end: string;
  actual_start: string;
  actual_end: string;
  progress_percentage: string;
  sequence: string;
  is_milestone: boolean;
}

export interface ProjectTaskCreatePayload {
  name: string;
  description?: string;
  person_in_charge?: string | null;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  progress_percentage?: string | number;
  sequence?: number;
  is_milestone?: boolean;
}

export type ProjectTaskUpdatePayload = ProjectTaskCreatePayload;

export interface ProjectTaskAssignPayload {
  person_in_charge: string;
}

export interface ProjectTaskReorderPayload {
  task_ids: string[];
}

export interface ProjectTaskChecklistCreatePayload {
  text: string;
  sequence?: number;
  is_completed?: boolean;
}

export interface ProjectTaskChecklistUpdatePayload {
  text?: string;
  sequence?: number;
  is_completed?: boolean;
}

export interface ProjectTaskCommentCreatePayload {
  body: string;
  is_internal?: boolean;
}

// ---------------------------------------------------------------------------
// FO-105 Gantt & task dependencies
// ---------------------------------------------------------------------------

export type ProjectDependencyType = "finish_to_start";

export interface ProjectTaskBlockingPredecessor {
  id: string;
  task_code: string;
  name: string;
  status: ProjectTaskStatus;
  planned_end: string | null;
}

export interface ProjectTaskDependencyReadiness {
  is_dependency_ready: boolean;
  blocking_predecessor_count: number;
  blocking_predecessors: ProjectTaskBlockingPredecessor[];
  predecessor_count: number;
  successor_count: number;
}

export interface ProjectTaskDependency {
  id: string;
  tenant: string;
  project: string;
  predecessor_task: string;
  predecessor_task_code: string;
  successor_task: string;
  successor_task_code: string;
  dependency_type: ProjectDependencyType;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskDependencyCreatePayload {
  predecessor_task: string;
  successor_task: string;
  dependency_type?: ProjectDependencyType;
}

export interface ProjectGanttProjectSummary {
  id: string;
  project_code: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  planned_start_date: string | null;
  planned_end_date: string | null;
  organization: string;
  tenant: string;
}

export interface ProjectGanttTask extends ProjectTaskDerivedFields {
  id: string;
  tenant: string;
  project: string;
  task_code: string;
  name: string;
  description: string;
  person_in_charge: string | null;
  person_in_charge_email: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_percentage: string | number;
  sequence: number;
  is_milestone: boolean;
  predecessor_ids: string[];
  successor_ids: string[];
  is_scheduled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectGanttDependency {
  id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: ProjectDependencyType;
}

export interface ProjectGanttSummary {
  total_tasks: number;
  scheduled_tasks: number;
  unscheduled_tasks: number;
  milestones: number;
  delayed_tasks: number;
  dependency_blocked_tasks: number;
}

export interface ProjectGanttResponse {
  project: ProjectGanttProjectSummary;
  tasks: ProjectGanttTask[];
  dependencies: ProjectGanttDependency[];
  summary: ProjectGanttSummary;
}

// ---------------------------------------------------------------------------
// FO-106 Timeline, Notes & Issues
// ---------------------------------------------------------------------------

export type ProjectNoteCategory =
  | "general"
  | "meeting"
  | "decision"
  | "safety"
  | "material"
  | "contractor"
  | "client"
  | "other";

export type ProjectIssueSeverity = "low" | "medium" | "high" | "critical";

export type ProjectIssueStatus =
  | "open"
  | "investigating"
  | "blocked"
  | "resolved"
  | "closed"
  | "cancelled";

export type ProjectTimelineEventCategory =
  | "project"
  | "task"
  | "issue"
  | "note"
  | "attachment"
  | "comment"
  | "status"
  | "assignment"
  | "dependency"
  | "checklist";

export interface ProjectNoteListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  category?: ProjectNoteCategory;
  author?: string;
  ordering?: string;
}

export interface ProjectNoteListFilters {
  search: string;
  category: ProjectNoteCategory | "";
  author: string;
  sort: string;
  pageSize: number;
}

export interface ProjectNote {
  id: string;
  tenant: string;
  project: string;
  title: string;
  note: string;
  author: string | null;
  author_email: string | null;
  author_name: string | null;
  category: ProjectNoteCategory;
  created_at: string;
  updated_at: string;
}

export interface ProjectNoteFormValues {
  title: string;
  note: string;
  category: ProjectNoteCategory;
}

export interface ProjectNoteCreatePayload {
  title: string;
  note: string;
  category?: ProjectNoteCategory;
}

export type ProjectNoteUpdatePayload = ProjectNoteCreatePayload;

export interface ProjectIssueListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ProjectIssueStatus;
  severity?: ProjectIssueSeverity;
  owner?: string;
  due_date_from?: string;
  due_date_to?: string;
  ordering?: string;
}

export interface ProjectIssueListFilters {
  search: string;
  status: ProjectIssueStatus | "";
  severity: ProjectIssueSeverity | "";
  owner: string;
  dueDateFrom: string;
  dueDateTo: string;
  sort: string;
  pageSize: number;
}

export interface ProjectIssueComment {
  id: string;
  issue: string;
  author: string;
  author_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectIssueListItem {
  id: string;
  tenant: string;
  project: string;
  title: string;
  description: string;
  severity: ProjectIssueSeverity;
  status: ProjectIssueStatus;
  owner: string | null;
  owner_email: string | null;
  due_date: string | null;
  resolved_at: string | null;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectIssueDetail extends ProjectIssueListItem {
  comments: ProjectIssueComment[];
}

export interface ProjectIssueFormValues {
  title: string;
  description: string;
  severity: ProjectIssueSeverity;
  status: ProjectIssueStatus;
  owner: string;
  due_date: string;
}

export interface ProjectIssueCreatePayload {
  title: string;
  description?: string;
  severity?: ProjectIssueSeverity;
  status?: ProjectIssueStatus;
  owner?: string | null;
  due_date?: string | null;
}

export type ProjectIssueUpdatePayload = ProjectIssueCreatePayload;

export interface ProjectIssueCommentCreatePayload {
  body: string;
  is_internal?: boolean;
}

export interface ProjectTimelineListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  category?: ProjectTimelineEventCategory;
  event_category?: ProjectTimelineEventCategory;
  event_type?: string;
  action?: string;
  actor?: string;
  date_from?: string;
  date_to?: string;
  ordering?: string;
}

export interface ProjectTimelineListFilters {
  search: string;
  category: ProjectTimelineEventCategory | "";
  eventType: string;
  actor: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  pageSize: number;
}

export interface ProjectTimelineActor {
  id: string;
  name: string;
  email: string;
}

export interface ProjectTimelineRelatedObject {
  type: string;
  id: string;
  code: string | null;
}

export interface ProjectTimelineEntry {
  id: string;
  timestamp: string;
  actor: ProjectTimelineActor | null;
  event_type: string;
  category: ProjectTimelineEventCategory | string;
  title: string;
  description: string;
  related_object: ProjectTimelineRelatedObject | null;
  icon: string;
  metadata: Record<string, unknown>;
}
